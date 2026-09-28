import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { CommandPalette } from '@astryxdesign/core/CommandPalette'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { Divider } from '@astryxdesign/core/Divider'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Icon } from '@astryxdesign/core/Icon'
import { Kbd } from '@astryxdesign/core/Kbd'
import { List, ListItem } from '@astryxdesign/core/List'
import { MetadataList, MetadataListItem } from '@astryxdesign/core/MetadataList'
import { NumberInput } from '@astryxdesign/core/NumberInput'
import { HStack, VStack } from '@astryxdesign/core/Stack'
import { Heading, Text } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import { createStaticSource, type SearchableItem } from '@astryxdesign/core/Typeahead'
import { FilePlus, FolderOpen, History, Upload } from 'lucide-react'
import { useEffect, useState } from 'react'
import { IconTile } from '#/features/app-shell/icon-tile'
import { GIGABYTE } from '#/features/engine/constants'
import type { NodeRegistry } from '#/features/engine/types'
import { MAX_PIPELINE_NAME_LENGTH, SAVE_NOTICE } from '#/features/pipelines/constants'
import type { RecoverableDraft } from '#/features/pipelines/draft'
import { availableTemplates } from '#/features/pipelines/templates'
import type { SavedPipeline, Template } from '#/features/pipelines/types'
import { engineRuntime } from '#/features/runs/engine-runtime'
import { MAX_STEP_CACHE_GIGABYTES, MIN_STEP_CACHE_GIGABYTES } from '#/features/settings/constants'
import { readSettings, writeSettings } from '#/features/settings/settings'
import { CATEGORIES, NODE_ICONS, toneOf } from '#/features/studio/node-ui'
import { PipelineSteps } from '#/features/studio/pipeline-steps'
import { track } from '#/features/usage/usage'
import { formatAge, formatBytes } from '#/lib/format'

export function TemplatePicker({
  isOpen,
  onOpenChange,
  registry,
  hasSaved,
  recovery,
  onRecover,
  onDiscardRecovery,
  onChoose,
  onImport,
  onOpenSaved,
}: {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  registry: NodeRegistry
  /** The browser has saved pipelines to open. */
  hasSaved: boolean
  /** Unsaved changes from another tab, possibly closed, to continue with. */
  recovery: RecoverableDraft | null
  onRecover: (draft: RecoverableDraft) => void
  onDiscardRecovery: () => void
  onChoose: (template: Template) => void
  onImport: () => void
  onOpenSaved: () => void
}) {
  const templates = availableTemplates(registry)
  const blank = templates.find((template) => template.id === 'blank')
  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange} width={640}>
      <DialogHeader
        title="Start a pipeline"
        subtitle="Pick a template to begin with. You can change every step afterwards."
        onOpenChange={onOpenChange}
      />
      <VStack gap={4} padding={4}>
        {recovery ? (
          <Card variant="muted" padding={3}>
            <HStack gap={3} vAlign="center" hAlign="between" wrap="wrap">
              <HStack gap={3} vAlign="center">
                <Icon icon={History} size="md" color="secondary" />
                <VStack gap={0.5}>
                  <Text type="body">Continue “{recovery.name}”</Text>
                  <Text type="supporting">
                    Unsaved changes from another tab, {formatAge(Date.now() - recovery.updatedAt)}
                  </Text>
                </VStack>
              </HStack>
              <HStack gap={1}>
                <Button label="Discard" variant="ghost" size="sm" onClick={onDiscardRecovery} />
                <Button label="Continue" size="sm" onClick={() => onRecover(recovery)} />
              </HStack>
            </HStack>
          </Card>
        ) : null}
        <List hasDividers>
          {templates
            .filter((template) => template.id !== 'blank')
            .map((template) => (
              <ListItem
                key={template.id}
                label={template.name}
                description={
                  <VStack gap={2} paddingBlock={1}>
                    <Text type="supporting">{template.description}</Text>
                    <PipelineSteps pipeline={template.pipeline} registry={registry} />
                  </VStack>
                }
                onClick={() => onChoose(template)}
              />
            ))}
        </List>
        <HStack gap={2} vAlign="center" wrap="wrap">
          {blank ? (
            <Button
              label="Start blank"
              icon={<Icon icon={FilePlus} size="sm" />}
              onClick={() => onChoose(blank)}
            />
          ) : null}
          <Button
            label="Import a .hexlode file"
            variant="ghost"
            icon={<Icon icon={Upload} size="sm" />}
            onClick={onImport}
          />
          {hasSaved ? (
            <Button
              label="Open a saved pipeline"
              variant="ghost"
              icon={<Icon icon={FolderOpen} size="sm" />}
              onClick={onOpenSaved}
            />
          ) : null}
        </HStack>
      </VStack>
    </Dialog>
  )
}

interface NodeChoice extends SearchableItem<{ group: string; description: string }> {}

/** A searchable list of node types, for adding a node from the keyboard or the canvas menu. */
export function NodePicker({
  isOpen,
  onOpenChange,
  registry,
  hasFiles,
  onChoose,
}: {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  registry: NodeRegistry
  hasFiles: boolean
  onChoose: (type: string) => void
}) {
  const choices: NodeChoice[] = registry
    .list()
    .filter((node) => !(node.type === 'files' && hasFiles))
    .map((node) => ({
      id: node.type,
      label: node.label,
      auxiliaryData: {
        group: CATEGORIES.find((category) => category.id === node.category)?.label ?? '',
        description: node.description,
      },
    }))
  return (
    <CommandPalette<NodeChoice>
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      label="Add a node"
      width={520}
      maxHeight={600}
      searchSource={createStaticSource(choices, {
        keywords: (item) => [item.auxiliaryData?.description ?? ''],
      })}
      emptyBootstrapText="Type to find a node"
      onValueChange={(type) => {
        onChoose(type)
        onOpenChange(false)
      }}
      renderItem={(item) => {
        const icon = NODE_ICONS[item.id]
        const definition = registry.get(item.id)
        return (
          <span className="flex w-full min-w-0 items-center gap-3 overflow-hidden">
            {icon ? <IconTile icon={icon} tone={toneOf(definition?.category)} size="sm" /> : null}
            <span className="min-w-0 flex-1 overflow-hidden">
              <Text type="label" maxLines={1}>
                {item.label}
              </Text>
              <Text type="supporting" maxLines={1} hasTruncateTooltip={false}>
                {item.auxiliaryData?.description}
              </Text>
            </span>
          </span>
        )
      }}
    />
  )
}

const GUIDE_STEPS = [
  ['Add images', 'Drop images on the canvas, or select the Files node.'],
  ['Connect steps', 'Drag from the right edge of a node to the left edge of the next one.'],
  ['Adjust', 'Select a node to change its settings. Each node previews the first image.'],
  ['Run', 'Press Run. Every Output node collects its results into a ZIP.'],
] as const

const SHORTCUTS = [
  ['Add a node', 'mod+k'],
  ['Duplicate the selected node', 'mod+d'],
  ['Delete the selection', 'delete'],
  ['Undo', 'mod+z'],
  ['Redo', 'mod+shift+z'],
  ['Save', 'mod+s'],
] as const

/** How the Studio works, in four steps, and its shortcuts. */
export function StudioHelp() {
  return (
    <VStack gap={4} padding={4} width={340}>
      <VStack gap={3}>
        <Text type="label" weight="semibold">
          How the Studio works
        </Text>
        {GUIDE_STEPS.map(([title, description], index) => (
          <HStack key={title} gap={3} vAlign="start">
            <Text type="supporting" weight="semibold" hasTabularNumbers>
              {index + 1}
            </Text>
            <VStack gap={0.5}>
              <Text type="label">{title}</Text>
              <Text type="supporting">{description}</Text>
            </VStack>
          </HStack>
        ))}
      </VStack>
      <Divider />
      <VStack gap={2}>
        <Text type="label" weight="semibold">
          Shortcuts
        </Text>
        {SHORTCUTS.map(([action, keys]) => (
          <HStack key={action} gap={3} hAlign="between" vAlign="center">
            <Text type="supporting">{action}</Text>
            <Kbd keys={keys} />
          </HStack>
        ))}
        <Text type="supporting">
          Right-click a node, a connection or the canvas for more. Hold Shift to get the
          browser&apos;s own menu.
        </Text>
      </VStack>
    </VStack>
  )
}

export function SaveDialog({
  isOpen,
  onOpenChange,
  name,
  onSave,
}: {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  name: string
  onSave: (name: string) => void
}) {
  const [value, setValue] = useState(name)
  useEffect(() => {
    if (isOpen) setValue(name)
  }, [isOpen, name])
  const trimmed = value.trim()
  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange} purpose="form" width={440}>
      <DialogHeader title="Save pipeline" onOpenChange={onOpenChange} />
      <VStack gap={4} padding={4}>
        <TextInput
          label="Name"
          value={value}
          onChange={(next) => setValue(next.slice(0, MAX_PIPELINE_NAME_LENGTH))}
          hasAutoFocus
        />
        <Text type="supporting">{SAVE_NOTICE}</Text>
        <HStack gap={2} hAlign="end">
          <Button label="Cancel" variant="ghost" onClick={() => onOpenChange(false)} />
          <Button
            label="Save"
            variant="primary"
            isDisabled={!trimmed}
            onClick={() => onSave(trimmed)}
          />
        </HStack>
      </VStack>
    </Dialog>
  )
}

export function OpenDialog({
  isOpen,
  onOpenChange,
  pipelines,
  onOpen,
  onDelete,
}: {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  pipelines: SavedPipeline[]
  onOpen: (pipeline: SavedPipeline) => void
  onDelete: (pipeline: SavedPipeline) => void
}) {
  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange} width={520}>
      <DialogHeader
        title="Open a saved pipeline"
        subtitle="Pipelines saved in this browser."
        onOpenChange={onOpenChange}
      />
      <VStack padding={4}>
        {pipelines.length === 0 ? (
          <EmptyState
            title="No saved pipelines"
            description="Save a pipeline to find it here and on the home page."
            isCompact
          />
        ) : (
          <List hasDividers>
            {pipelines.map((pipeline) => (
              <ListItem
                key={pipeline.id}
                label={pipeline.name}
                description={`${pipeline.pipeline.nodes.length} nodes · saved ${new Date(pipeline.updatedAt).toLocaleString()}`}
                onClick={() => onOpen(pipeline)}
                endContent={
                  <Button
                    label="Delete"
                    size="sm"
                    variant="ghost"
                    onClick={() => onDelete(pipeline)}
                  />
                }
              />
            ))}
          </List>
        )}
      </VStack>
    </Dialog>
  )
}

export function SettingsDialog({
  isOpen,
  onOpenChange,
}: {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [budget, setBudget] = useState(() => readSettings().stepCacheGigabytes)
  const [used, setUsed] = useState<number | null>(null)
  useEffect(() => {
    if (!isOpen) return
    setBudget(readSettings().stepCacheGigabytes)
    void engineRuntime().then(({ index }) => setUsed(index?.usedBytes() ?? 0))
  }, [isOpen])
  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange} width={480}>
      <DialogHeader title="Settings" onOpenChange={onOpenChange} />
      <VStack gap={4} padding={4}>
        <Heading level={3}>Step cache</Heading>
        <Text type="supporting">
          The Studio keeps each node's last results so that changing one node runs only that node
          and the nodes after it. When the cache is full, the oldest results are deleted.
        </Text>
        <MetadataList>
          <MetadataListItem label="In use">
            {used === null ? '…' : formatBytes(used)}
          </MetadataListItem>
        </MetadataList>
        <NumberInput
          label="Size limit"
          units="GB"
          min={MIN_STEP_CACHE_GIGABYTES}
          max={MAX_STEP_CACHE_GIGABYTES}
          step={0.5}
          value={budget}
          onChange={setBudget}
        />
        <HStack gap={2} hAlign="between">
          <Button
            label="Clear the step cache"
            variant="destructive"
            clickAction={async () => {
              const { index } = await engineRuntime()
              await index?.clear()
              setUsed(0)
              track('step_cache_changed', { action: 'clear' })
            }}
          />
          <Button
            label="Save"
            variant="primary"
            clickAction={async () => {
              const saved = writeSettings({ stepCacheGigabytes: budget })
              const { index } = await engineRuntime()
              await index?.setBudget(saved.stepCacheGigabytes * GIGABYTE)
              setUsed(index?.usedBytes() ?? 0)
              track('step_cache_changed', {
                action: 'budget',
                budgetGigabytes: saved.stepCacheGigabytes,
              })
              onOpenChange(false)
            }}
          />
        </HStack>
      </VStack>
    </Dialog>
  )
}
