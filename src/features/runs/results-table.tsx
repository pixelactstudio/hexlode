import { Badge } from '@astryxdesign/core/Badge'
import { HStack, VStack } from '@astryxdesign/core/Stack'
import { StatusDot } from '@astryxdesign/core/StatusDot'
import { pixel, proportional, Table } from '@astryxdesign/core/Table'
import { Text } from '@astryxdesign/core/Text'

import type { RunControllerState } from '#/features/runs/run-controller'
import { formatBytes, formatChange } from '#/lib/format'

interface ResultRow extends Record<string, unknown> {
  id: string
  name: string
  before: number | null
  after: number | null
  status: 'waiting' | 'running' | 'done' | 'skipped' | 'failed' | 'refused'
  detail: string
}

const STATUS = {
  waiting: { dot: 'neutral', label: 'Waiting' },
  running: { dot: 'accent', label: 'Working' },
  done: { dot: 'success', label: 'Done' },
  skipped: { dot: 'warning', label: 'Skipped' },
  failed: { dot: 'error', label: 'Failed' },
  refused: { dot: 'error', label: 'Refused' },
} as const

export function resultRows(state: RunControllerState): ResultRow[] {
  const { stats } = state
  const running = state.running || stats.status === 'running'
  const rows: ResultRow[] = state.sources.map((source) => {
    const row = stats.sources[source.index]
    const finished = stats.status !== 'idle' && row !== undefined && row.status !== 'pending'
    const inFlight = running && source.index < stats.finishedItems + state.workers
    let status: ResultRow['status'] = inFlight ? 'running' : 'waiting'
    if (finished) status = row.status as ResultRow['status']
    return {
      id: source.key,
      name: source.meta.name,
      before: source.meta.size ?? null,
      after: finished && row.status === 'done' ? (row.outputBytes ?? null) : null,
      status,
      detail: row?.error ?? row?.warnings[0] ?? '',
    }
  })
  for (const refused of state.refused) {
    rows.push({
      id: `refused:${refused.name}`,
      name: refused.name,
      before: null,
      after: null,
      status: 'refused',
      detail: refused.reason,
    })
  }
  return rows
}

export function ResultsTable({ rows }: { rows: ResultRow[] }) {
  return (
    <Table<ResultRow>
      data={rows}
      idKey="id"
      density="compact"
      textOverflow="truncate"
      columns={[
        {
          key: 'name',
          header: 'File',
          width: proportional(3),
          renderCell: (row) => (
            <VStack gap={0.5}>
              <Text type="body" maxLines={1}>
                {row.name}
              </Text>
              {row.detail ? (
                <Text type="supporting" maxLines={2}>
                  {row.detail}
                </Text>
              ) : null}
            </VStack>
          ),
        },
        {
          key: 'before',
          header: 'Before',
          width: pixel(110),
          align: 'end',
          renderCell: (row) => (
            <Text type="body" hasTabularNumbers>
              {row.before === null ? '—' : formatBytes(row.before)}
            </Text>
          ),
        },
        {
          key: 'after',
          header: 'After',
          width: pixel(110),
          align: 'end',
          renderCell: (row) => (
            <Text type="body" hasTabularNumbers>
              {row.after === null ? '—' : formatBytes(row.after)}
            </Text>
          ),
        },
        {
          key: 'change',
          header: 'Change',
          width: pixel(96),
          align: 'end',
          renderCell: (row) =>
            row.before !== null && row.after !== null ? (
              <Badge
                variant={row.after <= row.before ? 'success' : 'warning'}
                label={formatChange(row.before, row.after)}
              />
            ) : (
              <Text type="supporting">—</Text>
            ),
        },
        {
          key: 'status',
          header: 'Status',
          width: pixel(120),
          renderCell: (row) => (
            <HStack gap={2} vAlign="center">
              <StatusDot
                variant={STATUS[row.status].dot}
                label={STATUS[row.status].label}
                isPulsing={row.status === 'running'}
              />
              <Text type="body">{STATUS[row.status].label}</Text>
            </HStack>
          ),
        },
      ]}
    />
  )
}
