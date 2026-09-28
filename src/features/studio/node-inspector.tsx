import { AspectRatio } from '@astryxdesign/core/AspectRatio'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Grid } from '@astryxdesign/core/Grid'
import { Icon } from '@astryxdesign/core/Icon'
import { IconButton } from '@astryxdesign/core/IconButton'
import { Selector } from '@astryxdesign/core/Selector'
import { Slider } from '@astryxdesign/core/Slider'
import { HStack, VStack } from '@astryxdesign/core/Stack'
import { pixel, proportional, Table } from '@astryxdesign/core/Table'
import { Heading, Text } from '@astryxdesign/core/Text'
import { Token } from '@astryxdesign/core/Token'
import { Download, Trash2, X } from 'lucide-react'
import { useState } from 'react'

import { IconTile } from '#/features/app-shell/icon-tile'
import { describeTypes } from '#/features/engine/item-types'
import type { NodeRegistry, PipelineNode } from '#/features/engine/types'
import { FORMAT_NAMES } from '#/features/images/image-item'
import { FileDrop } from '#/features/runs/file-drop'
import { downloadDelivery, type RunControllerState } from '#/features/runs/run-controller'
import type { NodeStats } from '#/features/runs/run-stats'
import { SourceList } from '#/features/runs/source-list'
import { NODE_TYPES_WITH_SETTINGS, NodeSettings } from '#/features/studio/node-settings'
import { NODE_ICONS, toneOf } from '#/features/studio/node-ui'
import type { PreviewState, PreviewView, StudioSession } from '#/features/studio/studio-session'
import { track } from '#/features/usage/usage'
import { formatBytes, formatChange, formatCount, formatDuration } from '#/lib/format'

/** A part of the inspector: a small uppercase title, then its content, under a divider. */
function Section({
  title,
  end,
  children,
}: {
  title: string
  end?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <span className="block border-border border-t">
      <VStack gap={3} padding={4}>
        <HStack gap={2} vAlign="center" hAlign="between">
          <span className="font-semibold text-secondary text-xs uppercase tracking-[0.08em]">
            {title}
          </span>
          {end}
        </HStack>
        {children}
      </VStack>
    </span>
  )
}

/** One number over its name, in a tinted tile. */
function Stat({ value, label, tone }: { value: string; label: string; tone?: 'error' }) {
  return (
    <span className="block rounded-lg bg-muted px-3 py-2">
      <VStack gap={0}>
        <span className={tone === 'error' ? 'text-red-vivid' : 'text-primary'}>
          <Text type="large" color="inherit" hasTabularNumbers>
            {value}
          </Text>
        </span>
        <Text type="supporting">{label}</Text>
      </VStack>
    </span>
  )
}

/** The size change as "−42%", coloured green when smaller and orange when larger. */
function sizeChange(before: number, after: number) {
  if (before <= 0) return null
  return {
    text: formatChange(before, after),
    tone:
      after < before ? 'text-green-vivid' : after > before ? 'text-orange-vivid' : 'text-secondary',
  }
}

function RunStats({ stats }: { stats: NodeStats }) {
  const done = stats.processed + stats.cached
  const change = sizeChange(stats.bytesIn, stats.bytesOut)
  const extra = [
    stats.cached > 0 ? `${formatCount(stats.cached)} from the step cache` : null,
    stats.warnings > 0
      ? `${formatCount(stats.warnings)} warning${stats.warnings === 1 ? '' : 's'}`
      : null,
  ].filter(Boolean)
  return (
    <VStack gap={3}>
      <Grid columns={3} gap={2}>
        <Stat value={formatCount(done)} label="Done" />
        <Stat value={formatCount(stats.skipped)} label="Skipped" />
        <Stat
          value={formatCount(stats.failed)}
          label="Failed"
          tone={stats.failed > 0 ? 'error' : undefined}
        />
      </Grid>
      {stats.bytesIn > 0 || stats.bytesOut > 0 ? (
        <HStack gap={2} vAlign="center" hAlign="between" wrap="wrap">
          <Text type="body" hasTabularNumbers>
            {stats.bytesIn > 0
              ? `${formatBytes(stats.bytesIn)} → ${formatBytes(stats.bytesOut)}`
              : `${formatBytes(stats.bytesOut)} passed on`}
          </Text>
          {change ? (
            <span className={change.tone}>
              <Text type="supporting" color="inherit" hasTabularNumbers>
                {change.text}
              </Text>
            </span>
          ) : null}
        </HStack>
      ) : null}
      {extra.length > 0 ? <Text type="supporting">{extra.join(' · ')}</Text> : null}
    </VStack>
  )
}

function FilesPanel({
  session,
  run,
  previews,
}: {
  session: StudioSession
  run: RunControllerState
  previews: PreviewState
}) {
  const { sources, accepts } = run
  return (
    <VStack gap={4}>
      <FileDrop
        onFiles={(files) => void session.runs.addFiles(files)}
        isDisabled={run.running}
        description="Or drop them on the canvas"
        size="md"
      />
      <Text type="supporting">
        {accepts.size > 0
          ? `This pipeline takes ${describeTypes(accepts)}.`
          : 'Connect Files to another node to choose what it takes.'}
      </Text>
      <SourceList controller={session.runs} state={run} />
      {sources.length > 1 ? (
        <Selector
          label="Sample for previews"
          description="Every node previews its result on this image."
          size="sm"
          value={previews.sampleFile?.name ?? ''}
          hasSearch={sources.length > 8}
          onChange={(name) => {
            const source = sources.find((item) => item.meta.name === name)
            if (source?.file instanceof File) void session.setSample(source.file)
          }}
          options={sources
            .slice(0, 500)
            .map((source) => ({ value: source.meta.name, label: source.meta.name }))}
        />
      ) : null}
    </VStack>
  )
}

function PreviewSection({ preview }: { preview: PreviewView }) {
  const format = preview.format
    ? (FORMAT_NAMES[preview.format as keyof typeof FORMAT_NAMES] ?? preview.format)
    : null
  return (
    <Section title="Preview">
      {preview.thumbnail ? (
        <span className="flex h-56 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
          <img
            src={preview.thumbnail}
            alt="The sample after this node"
            className="max-h-full max-w-full object-contain"
          />
        </span>
      ) : null}
      {format ? (
        <HStack gap={2} vAlign="center" hAlign="between">
          <HStack gap={2} vAlign="center">
            <Token label={format} size="sm" />
            {preview.width && preview.height ? (
              <Text type="supporting" hasTabularNumbers>
                {`${preview.width} × ${preview.height}`}
              </Text>
            ) : null}
          </HStack>
          <Text type="supporting" hasTabularNumbers>
            {preview.size !== undefined ? formatBytes(preview.size) : 'Size set at Output'}
          </Text>
        </HStack>
      ) : null}
      {preview.status === 'skipped' ? (
        <Text type="supporting">
          The sample image does not enter this node, so it skips this branch.
        </Text>
      ) : null}
      {preview.status === 'failed' ? (
        <Banner status="error" title="The sample failed here" description={preview.error} />
      ) : null}
      {preview.warnings.map((warning) => (
        <Banner key={warning} status="warning" title={warning} />
      ))}
    </Section>
  )
}

function CompareSlider({ before, after }: { before: string; after: string }) {
  const [reveal, setReveal] = useState(50)
  return (
    <VStack gap={2}>
      <AspectRatio ratio={4 / 3} fit="contain">
        <span className="relative block h-full w-full overflow-hidden rounded-md bg-muted">
          <img src={after} alt="After" className="absolute inset-0 h-full w-full object-contain" />
          <img
            src={before}
            alt="Before"
            className="absolute inset-0 h-full w-full object-contain [clip-path:inset(0_calc(100%-var(--reveal))_0_0)]"
            style={{ '--reveal': `${reveal}%` } as React.CSSProperties}
          />
        </span>
      </AspectRatio>
      <Slider
        label="Before and after"
        isLabelHidden
        min={0}
        max={100}
        value={reveal}
        valueDisplay="none"
        onChange={(value: number) => setReveal(value)}
      />
      <HStack hAlign="between">
        <Text type="supporting">Before</Text>
        <Text type="supporting">After</Text>
      </HStack>
    </VStack>
  )
}

interface RecordRow extends Record<string, unknown> {
  id: string
  name: string
}

function RecordsTable({
  records,
  columns,
}: {
  records: RecordRow[]
  columns: { key: string; header: string; format?: (value: unknown) => string }[]
}) {
  return (
    <Table<RecordRow>
      data={records}
      idKey="id"
      density="compact"
      textOverflow="truncate"
      columns={[
        { key: 'name', header: 'File', width: proportional(2) },
        ...columns.map((column) => ({
          key: column.key,
          header: column.header,
          width: pixel(96),
          renderCell: (row: RecordRow) => (
            <Text type="body" hasTabularNumbers maxLines={1}>
              {row[column.key] === null || row[column.key] === undefined
                ? '—'
                : column.format
                  ? column.format(row[column.key])
                  : String(row[column.key])}
            </Text>
          ),
        })),
      ]}
    />
  )
}

export function NodeInspector({
  session,
  registry,
  node,
  run,
  previews,
  onClose,
}: {
  session: StudioSession
  registry: NodeRegistry
  node: PipelineNode
  run: RunControllerState
  previews: PreviewState
  onClose: () => void
}) {
  const definition = registry.get(node.type)
  if (!definition) return null
  let settings: Record<string, unknown> = {}
  try {
    settings = definition.parseSettings(node.settings)
  } catch {
    settings = definition.defaults
  }
  const stats = run.stats.status === 'idle' ? undefined : run.stats.nodes[node.id]
  const preview = previews.nodes[node.id]
  const records = (run.stats.records[node.id] ?? []).map((record, index) => ({
    id: `${index}`,
    name: record.name,
    ...record.fields,
  }))
  const delivery = run.stats.deliveries[node.id]
  const icon = NODE_ICONS[node.type]
  const hasSettings = NODE_TYPES_WITH_SETTINGS.has(node.type)

  return (
    <VStack gap={0}>
      <VStack gap={2} padding={4}>
        <HStack gap={2} vAlign="center" hAlign="between">
          <HStack gap={2} vAlign="center">
            {icon ? <IconTile icon={icon} tone={toneOf(definition.category)} size="sm" /> : null}
            <Heading level={3}>{definition.label}</Heading>
          </HStack>
          <HStack gap={1} vAlign="center">
            {definition.hasInput ? (
              <IconButton
                label="Delete node"
                tooltip="Delete node"
                icon={<Trash2 size={16} />}
                size="sm"
                variant="ghost"
                onClick={() => {
                  session.store.removeNodes([node.id])
                  track('node_removed', { nodeType: node.type, method: 'inspector' })
                }}
                isDisabled={run.running}
              />
            ) : null}
            <IconButton
              label="Close"
              tooltip="Close"
              icon={<X size={16} />}
              size="sm"
              variant="ghost"
              onClick={onClose}
            />
          </HStack>
        </HStack>
        <Text type="supporting">{definition.description}</Text>
      </VStack>
      {node.type === 'files' ? (
        <Section title="Images">
          <FilesPanel session={session} run={run} previews={previews} />
        </Section>
      ) : hasSettings ? (
        <Section title="Settings">
          <NodeSettings
            definition={definition}
            settings={settings}
            onChange={(changes) => session.store.updateSettings(node.id, changes)}
            isDisabled={run.running}
          />
        </Section>
      ) : null}
      {preview && node.type !== 'files' ? <PreviewSection preview={preview} /> : null}
      {node.type === 'compare' && preview?.before && preview.after ? (
        <Section title="Before and after">
          <CompareSlider before={preview.before} after={preview.after} />
        </Section>
      ) : null}
      {delivery ? (
        <Section title="Delivery">
          <HStack gap={3} vAlign="center" hAlign="between">
            <Text type="body" hasTabularNumbers>
              {`${formatCount(delivery.files.length)} file${delivery.files.length === 1 ? '' : 's'} · ${formatBytes(delivery.bytes)}`}
            </Text>
            {delivery.archive ? (
              <Button
                label="Download ZIP"
                variant="primary"
                size="sm"
                icon={<Icon icon={Download} size="sm" />}
                onClick={() => downloadDelivery(delivery, 'studio')}
              />
            ) : (
              <Text type="supporting">Saved to the folder you chose.</Text>
            )}
          </HStack>
        </Section>
      ) : null}
      {stats ? (
        <Section
          title="Last run"
          end={
            stats.ms > 0 ? (
              <Text type="supporting" hasTabularNumbers>
                {formatDuration(stats.ms)}
              </Text>
            ) : undefined
          }
        >
          <RunStats stats={stats} />
        </Section>
      ) : null}
      {node.type === 'inspect' && records.length > 0 ? (
        <Section title="Items">
          <RecordsTable
            records={records}
            columns={[
              { key: 'format', header: 'Format' },
              { key: 'width', header: 'Width' },
              { key: 'height', header: 'Height' },
              { key: 'size', header: 'Size', format: (value) => formatBytes(Number(value)) },
              { key: 'camera', header: 'Camera' },
              { key: 'dateTaken', header: 'Taken' },
              { key: 'location', header: 'Location' },
              { key: 'copyright', header: 'Copyright' },
            ]}
          />
        </Section>
      ) : null}
      {node.type === 'compare' && records.length > 0 ? (
        <Section title="Size difference">
          <RecordsTable
            records={records}
            columns={[
              {
                key: 'sourceSize',
                header: 'Before',
                format: (value) => formatBytes(Number(value)),
              },
              { key: 'size', header: 'After', format: (value) => formatBytes(Number(value)) },
              { key: 'savedPercent', header: 'Saved', format: (value) => `${value}%` },
            ]}
          />
        </Section>
      ) : null}
    </VStack>
  )
}
