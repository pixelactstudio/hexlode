import { Button } from '@astryxdesign/core/Button'
import { ClickableCard } from '@astryxdesign/core/ClickableCard'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Grid } from '@astryxdesign/core/Grid'
import { List, ListItem } from '@astryxdesign/core/List'
import { MetadataList, MetadataListItem } from '@astryxdesign/core/MetadataList'
import { NumberInput } from '@astryxdesign/core/NumberInput'
import { HStack, VStack } from '@astryxdesign/core/Stack'
import { Heading, Text } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import { useEffect, useState } from 'react'

import { track } from '#/features/analytics/analytics'
import { IconTile } from '#/features/app-shell/icon-tile'
import { GIGABYTE } from '#/features/engine/constants'
import type { NodeRegistry } from '#/features/engine/types'
import { MAX_PIPELINE_NAME_LENGTH, SAVE_NOTICE } from '#/features/pipelines/constants'
import { availableTemplates } from '#/features/pipelines/templates'
import type { SavedPipeline, Template } from '#/features/pipelines/types'
import { engineRuntime } from '#/features/runs/engine-runtime'
import { MAX_STEP_CACHE_GIGABYTES, MIN_STEP_CACHE_GIGABYTES } from '#/features/settings/constants'
import { readSettings, writeSettings } from '#/features/settings/settings'
import { NODE_ICONS, toneOf } from '#/features/studio/node-ui'
import { formatBytes } from '#/lib/format'

export function TemplatePicker({
  isOpen,
  onOpenChange,
  registry,
  onChoose,
}: {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  registry: NodeRegistry
  onChoose: (template: Template) => void
}) {
  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange} width={720}>
      <DialogHeader
        title="Start a pipeline"
        subtitle="Pick a starting point. You can change, add or remove every node afterwards."
        onOpenChange={onOpenChange}
      />
      <VStack padding={6}>
        <Grid columns={{ minWidth: 260, max: 2 }} gap={3}>
          {availableTemplates(registry).map((template) => (
            <ClickableCard
              key={template.id}
              label={template.name}
              elevation="low"
              padding={5}
              height="100%"
              onClick={() => onChoose(template)}
            >
              <VStack gap={3}>
                <HStack gap={1} wrap="wrap">
                  {template.pipeline.nodes.map((node) => {
                    const definition = registry.get(node.type)
                    const icon = NODE_ICONS[node.type]
                    return icon ? (
                      <IconTile
                        key={node.id}
                        icon={icon}
                        tone={toneOf(definition?.category)}
                        size="sm"
                      />
                    ) : null
                  })}
                </HStack>
                <VStack gap={1}>
                  <Heading level={3}>{template.name}</Heading>
                  <Text type="supporting">{template.description}</Text>
                </VStack>
                <Text type="supporting" color="primary">
                  {template.pipeline.nodes
                    .map((node) => registry.get(node.type)?.label ?? node.type)
                    .join(' → ')}
                </Text>
              </VStack>
            </ClickableCard>
          ))}
        </Grid>
      </VStack>
    </Dialog>
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
