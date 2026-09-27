import { Card } from '@astryxdesign/core/Card'
import { HStack, VStack } from '@astryxdesign/core/Stack'
import { StatusDot } from '@astryxdesign/core/StatusDot'
import { Text } from '@astryxdesign/core/Text'
import { Handle, type Node, type NodeProps, Position } from '@xyflow/react'

import { IconTile } from '#/features/app-shell/icon-tile'
import type { NodeCategory, Port } from '#/features/engine/types'
import { FORMAT_NAMES } from '#/features/images/image-item'
import type { NodeStats } from '#/features/runs/run-stats'
import { NODE_ICONS, toneOf } from '#/features/studio/node-ui'
import type { PreviewView } from '#/features/studio/studio-session'
import { formatBytes, formatCount, formatDuration } from '#/lib/format'

export const NODE_WIDTH = 224

export interface PipelineNodeData extends Record<string, unknown> {
  type: string
  label: string
  category?: NodeCategory
  /** One line saying what the settings do. */
  summary: string
  hasInput: boolean
  ports: Port[]
  stats?: NodeStats
  preview?: PreviewView
  running: boolean
  /** A sample image is set, so a missing preview means the sample never reached this node. */
  hasSample: boolean
}

export type PipelineFlowNode = Node<PipelineNodeData, 'pipeline'>

function formatName(format: string | undefined) {
  return format ? (FORMAT_NAMES[format as keyof typeof FORMAT_NAMES] ?? format) : ''
}

function status(data: PipelineNodeData) {
  const { stats, preview, running } = data
  if (stats?.failed) return { variant: 'error', label: `${stats.failed} failed` } as const
  if (running) return { variant: 'accent', label: 'Running', pulse: true } as const
  if (preview?.status === 'failed') return { variant: 'error', label: 'Sample failed' } as const
  if (preview?.status === 'skipped')
    return { variant: 'warning', label: 'Sample skips this node' } as const
  if (stats && stats.processed + stats.cached > 0)
    return { variant: 'success', label: 'Done' } as const
  return null
}

/** Two short facts at opposite ends of a line. */
function FactLine({ start, end }: { start: string; end?: string }) {
  return (
    <HStack gap={2} hAlign="between">
      <Text type="supporting" hasTabularNumbers maxLines={1}>
        {start}
      </Text>
      {end ? (
        <Text type="supporting" hasTabularNumbers maxLines={1}>
          {end}
        </Text>
      ) : null}
    </HStack>
  )
}

/** The sample image after this node, shown whole whatever its shape. */
function Preview({ data }: { data: PipelineNodeData }) {
  const { preview } = data
  if (!preview) {
    return data.hasSample ? (
      <Text type="supporting">The sample does not reach this node.</Text>
    ) : null
  }
  if (preview.status === 'skipped') {
    return <Text type="supporting">The sample skips this node.</Text>
  }
  if (preview.status === 'failed') {
    return (
      <Text type="supporting" maxLines={2}>
        {preview.error ?? 'The sample failed here.'}
      </Text>
    )
  }
  return (
    <VStack gap={1.5}>
      {preview.thumbnail ? (
        <span className="flex h-28 items-center justify-center overflow-hidden rounded-md bg-muted">
          <img
            src={preview.thumbnail}
            alt={`Sample after ${data.label}`}
            className="max-h-full max-w-full object-contain"
          />
        </span>
      ) : null}
      <FactLine
        start={
          preview.width && preview.height
            ? `${formatName(preview.format)} · ${preview.width} × ${preview.height}`
            : formatName(preview.format)
        }
        end={preview.size !== undefined ? formatBytes(preview.size) : undefined}
      />
    </VStack>
  )
}

function RunLine({ stats }: { stats: NodeStats }) {
  const done = stats.processed + stats.cached
  const extra = [
    stats.skipped ? `${formatCount(stats.skipped)} skipped` : null,
    stats.failed ? `${formatCount(stats.failed)} failed` : null,
  ].filter(Boolean)
  return (
    <FactLine
      start={[`${formatCount(done)} done`, ...extra].join(' · ')}
      end={stats.ms > 0 ? formatDuration(stats.ms) : undefined}
    />
  )
}

export function PipelineNodeView({ data, selected }: NodeProps<PipelineFlowNode>) {
  const icon = NODE_ICONS[data.type]
  const dot = status(data)
  const single = data.ports.length === 1
  const hasBody = Boolean(data.preview || data.hasSample || data.stats)
  return (
    <Card
      className="overflow-visible!"
      padding={0}
      width={NODE_WIDTH}
      elevation={selected ? 'med' : 'low'}
      variant={selected ? 'blue' : 'default'}
    >
      {data.hasInput ? (
        <Handle type="target" position={Position.Left} className="z-10 size-3!" />
      ) : null}
      <VStack gap={2} padding={3}>
        <HStack gap={2} vAlign="center">
          {icon ? <IconTile icon={icon} tone={toneOf(data.category)} size="sm" /> : null}
          <span className="min-w-0 flex-1">
            <VStack gap={0}>
              <Text type="label" weight="semibold" maxLines={1}>
                {data.label}
              </Text>
              {data.summary ? (
                <Text type="supporting" maxLines={1}>
                  {data.summary}
                </Text>
              ) : null}
            </VStack>
          </span>
          {dot ? (
            <StatusDot
              variant={dot.variant}
              label={dot.label}
              tooltip={dot.label}
              isPulsing={'pulse' in dot}
            />
          ) : null}
        </HStack>
        {hasBody ? (
          <VStack gap={1.5}>
            <Preview data={data} />
            {data.stats ? <RunLine stats={data.stats} /> : null}
          </VStack>
        ) : null}
      </VStack>
      {single ? (
        <Handle
          type="source"
          position={Position.Right}
          id={data.ports[0].id}
          className="z-10 size-3!"
        />
      ) : (
        <VStack gap={0} paddingBlock={1}>
          {data.ports.map((port) => (
            <HStack key={port.id} paddingInline={3} paddingBlock={1} hAlign="end">
              <span className="relative block w-full text-end">
                <Text type="supporting" maxLines={1}>
                  {port.label}
                </Text>
                <Handle
                  type="source"
                  position={Position.Right}
                  id={port.id}
                  className="z-10 size-3! -right-3!"
                />
              </span>
            </HStack>
          ))}
        </VStack>
      )}
    </Card>
  )
}
