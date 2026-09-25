import { AspectRatio } from '@astryxdesign/core/AspectRatio'
import { Card } from '@astryxdesign/core/Card'
import { Icon } from '@astryxdesign/core/Icon'
import { HStack, VStack } from '@astryxdesign/core/Stack'
import { StatusDot } from '@astryxdesign/core/StatusDot'
import { Text } from '@astryxdesign/core/Text'
import { Handle, type Node, type NodeProps, Position } from '@xyflow/react'

import type { Port } from '#/features/engine/types'
import { FORMAT_NAMES } from '#/features/images/image-item'
import type { NodeStats } from '#/features/runs/run-stats'
import { NODE_ICONS } from '#/features/studio/node-ui'
import type { PreviewView } from '#/features/studio/studio-session'
import { formatBytes, formatCount, formatDuration } from '#/lib/format'

export interface PipelineNodeData extends Record<string, unknown> {
  type: string
  label: string
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

function PreviewLine({ preview }: { preview: PreviewView }) {
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
  const parts = [
    preview.width && preview.height ? `${preview.width}×${preview.height}` : null,
    formatName(preview.format),
    preview.size !== undefined ? formatBytes(preview.size) : null,
  ].filter(Boolean)
  return <Text type="supporting">{parts.join(' · ')}</Text>
}

function StatsLines({ stats }: { stats: NodeStats }) {
  const done = stats.processed + stats.cached
  const counts = [
    `${formatCount(done)} done`,
    stats.cached ? `${formatCount(stats.cached)} cached` : null,
    stats.skipped ? `${formatCount(stats.skipped)} skipped` : null,
    stats.failed ? `${formatCount(stats.failed)} failed` : null,
  ].filter(Boolean)
  const bytes =
    stats.bytesIn > 0 || stats.bytesOut > 0
      ? `${formatBytes(stats.bytesIn)} → ${formatBytes(stats.bytesOut)}`
      : null
  return (
    <VStack gap={0.5}>
      <Text type="supporting" hasTabularNumbers>
        {counts.join(' · ')}
      </Text>
      <Text type="supporting" hasTabularNumbers>
        {[bytes, stats.ms > 0 ? formatDuration(stats.ms) : null].filter(Boolean).join(' · ')}
      </Text>
    </VStack>
  )
}

export function PipelineNodeView({ data, selected }: NodeProps<PipelineFlowNode>) {
  const icon = NODE_ICONS[data.type]
  const dot = status(data)
  const single = data.ports.length === 1
  return (
    <Card
      className="overflow-visible!"
      padding={0}
      width={208}
      elevation={selected ? 'med' : 'low'}
      variant={selected ? 'blue' : 'default'}
    >
      {data.hasInput ? (
        <Handle type="target" position={Position.Left} className="z-10 size-2.5!" />
      ) : null}
      <VStack gap={2} padding={3}>
        <HStack gap={2} vAlign="center" hAlign="between">
          <HStack gap={2} vAlign="center">
            {icon ? <Icon icon={icon} size="sm" color="secondary" /> : null}
            <Text type="label" weight="semibold">
              {data.label}
            </Text>
          </HStack>
          {dot ? (
            <StatusDot
              variant={dot.variant}
              label={dot.label}
              tooltip={dot.label}
              isPulsing={'pulse' in dot}
            />
          ) : null}
        </HStack>
        {data.preview?.thumbnail ? (
          <AspectRatio ratio={16 / 10} fit="contain">
            <img
              src={data.preview.thumbnail}
              alt={`Preview of ${data.label}`}
              className="rounded-md bg-muted"
            />
          </AspectRatio>
        ) : null}
        {data.preview ? (
          <PreviewLine preview={data.preview} />
        ) : data.hasSample ? (
          <Text type="supporting">The sample does not reach this node.</Text>
        ) : null}
        {data.stats ? <StatsLines stats={data.stats} /> : null}
      </VStack>
      {single ? (
        <Handle
          type="source"
          position={Position.Right}
          id={data.ports[0].id}
          className="z-10 size-2.5!"
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
                  className="z-10 size-2.5! -right-3!"
                />
              </span>
            </HStack>
          ))}
        </VStack>
      )}
    </Card>
  )
}
