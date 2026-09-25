import { AspectRatio } from '@astryxdesign/core/AspectRatio'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Divider } from '@astryxdesign/core/Divider'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Icon } from '@astryxdesign/core/Icon'
import { List, ListItem } from '@astryxdesign/core/List'
import { MetadataList, MetadataListItem } from '@astryxdesign/core/MetadataList'
import { Selector } from '@astryxdesign/core/Selector'
import { Slider } from '@astryxdesign/core/Slider'
import { HStack, VStack } from '@astryxdesign/core/Stack'
import { pixel, proportional, Table } from '@astryxdesign/core/Table'
import { Heading, Text } from '@astryxdesign/core/Text'
import { useState } from 'react'

import { describeTypes } from '#/features/engine/item-types'
import type { NodeRegistry, PipelineNode } from '#/features/engine/types'
import { FORMAT_NAMES } from '#/features/images/image-item'
import { FileDrop } from '#/features/runs/file-drop'
import { downloadDelivery, type RunControllerState } from '#/features/runs/run-controller'
import { NodeSettings } from '#/features/studio/node-settings'
import { NODE_ICONS } from '#/features/studio/node-ui'
import type { PreviewState, PreviewView, StudioSession } from '#/features/studio/studio-session'
import { formatBytes, formatCount, formatDuration } from '#/lib/format'

const MAX_LISTED_FILES = 50

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <VStack gap={3}>
      <Heading level={3}>{title}</Heading>
      {children}
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
  const { sources, refused, accepts } = run
  return (
    <VStack gap={5}>
      <FileDrop
        onFiles={(files) => void session.runs.addFiles(files)}
        isDisabled={run.running}
        description="You can also drop images anywhere on the canvas."
      />
      <Text type="supporting">
        {accepts.size > 0
          ? `This pipeline accepts ${describeTypes(accepts)}.`
          : 'Connect Files to another node to choose what it accepts.'}
      </Text>
      {refused.length > 0 ? (
        <Banner
          status="warning"
          title={`${formatCount(refused.length)} file${refused.length === 1 ? '' : 's'} refused`}
          description={refused[0].reason}
        >
          <List density="compact">
            {refused.slice(0, MAX_LISTED_FILES).map((file) => (
              <ListItem key={file.name} label={file.name} description={file.reason} />
            ))}
          </List>
        </Banner>
      ) : null}
      {sources.length > 0 ? (
        <Section title={`${formatCount(sources.length)} image${sources.length === 1 ? '' : 's'}`}>
          <Selector
            label="Sample image for previews"
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
          <List density="compact" hasDividers>
            {sources.slice(0, MAX_LISTED_FILES).map((source) => (
              <ListItem
                key={source.key}
                label={source.meta.name}
                description={`${FORMAT_NAMES[source.meta.format as keyof typeof FORMAT_NAMES]} · ${source.meta.width}×${source.meta.height} · ${formatBytes(source.meta.size ?? 0)}`}
              />
            ))}
          </List>
          {sources.length > MAX_LISTED_FILES ? (
            <Text type="supporting">and {formatCount(sources.length - MAX_LISTED_FILES)} more</Text>
          ) : null}
          <HStack>
            <Button
              label="Remove all images"
              variant="ghost"
              size="sm"
              onClick={() => void session.runs.clearFiles()}
              isDisabled={run.running}
            />
          </HStack>
        </Section>
      ) : null}
    </VStack>
  )
}

function PreviewSection({ preview }: { preview: PreviewView }) {
  return (
    <Section title="Preview">
      {preview.thumbnail ? (
        <AspectRatio ratio={4 / 3} fit="contain">
          <img src={preview.thumbnail} alt="Node preview" className="rounded-md bg-muted" />
        </AspectRatio>
      ) : null}
      {preview.status === 'skipped' ? (
        <Text type="supporting">
          The sample image does not enter this node, so it skips this branch.
        </Text>
      ) : null}
      {preview.status === 'failed' ? (
        <Banner status="error" title="The sample failed here" description={preview.error} />
      ) : null}
      {preview.format ? (
        <MetadataList columns={2}>
          <MetadataListItem label="Format">
            {FORMAT_NAMES[preview.format as keyof typeof FORMAT_NAMES] ?? preview.format}
          </MetadataListItem>
          <MetadataListItem label="Size">
            {preview.size !== undefined ? formatBytes(preview.size) : 'Encoded at Output'}
          </MetadataListItem>
          <MetadataListItem label="Dimensions">{`${preview.width}×${preview.height}`}</MetadataListItem>
        </MetadataList>
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
}: {
  session: StudioSession
  registry: NodeRegistry
  node: PipelineNode | undefined
  run: RunControllerState
  previews: PreviewState
}) {
  if (!node) {
    return (
      <EmptyState
        title="Nothing selected"
        description="Select a node to see its settings, its preview and what it did in the last run."
        isCompact
      />
    )
  }
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

  return (
    <VStack gap={5}>
      <VStack gap={2}>
        <HStack gap={2} vAlign="center" hAlign="between">
          <HStack gap={2} vAlign="center">
            {icon ? <Icon icon={icon} color="secondary" /> : null}
            <Heading level={2}>{definition.label}</Heading>
          </HStack>
          {definition.hasInput ? (
            <Button
              label="Delete"
              size="sm"
              variant="ghost"
              onClick={() => session.store.removeNodes([node.id])}
              isDisabled={run.running}
            />
          ) : null}
        </HStack>
        <Text type="supporting">{definition.description}</Text>
      </VStack>
      <Divider />
      {node.type === 'files' ? (
        <FilesPanel session={session} run={run} previews={previews} />
      ) : (
        <NodeSettings
          definition={definition}
          settings={settings}
          onChange={(changes) => session.store.updateSettings(node.id, changes)}
          isDisabled={run.running}
        />
      )}
      {preview && node.type !== 'files' ? <PreviewSection preview={preview} /> : null}
      {node.type === 'compare' && preview?.before && preview.after ? (
        <Section title="Before and after">
          <CompareSlider before={preview.before} after={preview.after} />
        </Section>
      ) : null}
      {delivery ? (
        <Section title="Delivery">
          <Text type="body">
            {`${formatCount(delivery.files.length)} file${delivery.files.length === 1 ? '' : 's'}, ${formatBytes(delivery.bytes)}`}
          </Text>
          {delivery.archive ? (
            <HStack>
              <Button
                label="Download ZIP"
                variant="primary"
                onClick={() => downloadDelivery(delivery, 'studio')}
              />
            </HStack>
          ) : (
            <Text type="supporting">Saved to the folder you chose.</Text>
          )}
        </Section>
      ) : null}
      {stats ? (
        <Section title="Last run">
          <MetadataList columns={2}>
            <MetadataListItem label="Processed">{formatCount(stats.processed)}</MetadataListItem>
            <MetadataListItem label="From step cache">{formatCount(stats.cached)}</MetadataListItem>
            <MetadataListItem label="Skipped">{formatCount(stats.skipped)}</MetadataListItem>
            <MetadataListItem label="Failed">{formatCount(stats.failed)}</MetadataListItem>
            <MetadataListItem label="Bytes in">{formatBytes(stats.bytesIn)}</MetadataListItem>
            <MetadataListItem label="Bytes out">{formatBytes(stats.bytesOut)}</MetadataListItem>
            <MetadataListItem label="Time">{formatDuration(stats.ms)}</MetadataListItem>
            <MetadataListItem label="Warnings">{formatCount(stats.warnings)}</MetadataListItem>
          </MetadataList>
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
