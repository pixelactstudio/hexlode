import { Badge } from '@astryxdesign/core/Badge'
import {
  BaseEdge,
  type Edge,
  EdgeLabelRenderer,
  type EdgeProps,
  getBezierPath,
} from '@xyflow/react'

import type { ConnectionCheck } from '#/features/engine/compatibility'
import { FORMAT_LABELS } from '#/features/engine/item-types'
import type { ConnectionStats } from '#/features/runs/run-stats'
import { formatBytes, formatCount } from '#/lib/format'

export interface PipelineEdgeData extends Record<string, unknown> {
  check?: ConnectionCheck
  stats?: ConnectionStats
  running: boolean
}

export type PipelineFlowEdge = Edge<PipelineEdgeData, 'pipeline'>

function formatsLabel(stats: ConnectionStats) {
  const names = stats.formats.map((format) => FORMAT_LABELS[format])
  return names.length > 2 ? `${names.length} formats` : names.join(', ')
}

export function PipelineEdgeView(props: EdgeProps<PipelineFlowEdge>) {
  const { data, selected } = props
  const [path, labelX, labelY] = getBezierPath(props)
  const refused = data?.check?.status === 'refused'
  const stats = data?.stats
  const saved = stats && stats.sourceBytes > stats.bytes ? stats.sourceBytes - stats.bytes : 0
  const parts: string[] = []
  if (refused) parts.push('Refused')
  else if (data?.check?.status === 'narrows') parts.push(data.check.label)
  if (stats) {
    parts.push(
      stats.formats.length <= 2
        ? `${formatCount(stats.items)} ${formatsLabel(stats)}`
        : formatCount(stats.items),
    )
    if (saved > 0) parts.push(`−${formatBytes(saved)}`)
  }
  const variant = refused ? 'error' : data?.check?.status === 'narrows' ? 'info' : 'neutral'
  return (
    <>
      <BaseEdge
        id={props.id}
        path={path}
        markerEnd={props.markerEnd}
        className={[
          refused ? 'stroke-error!' : selected ? 'stroke-accent!' : 'stroke-border-strong!',
          selected ? '[stroke-width:2.5]!' : '[stroke-width:1.5]!',
        ].join(' ')}
      />
      {parts.length > 0 ? (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-auto absolute"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            <Badge label={parts.join(' · ')} variant={variant} />
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  )
}
