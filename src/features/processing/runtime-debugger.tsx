import { Banner } from '@astryxdesign/core/Banner'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Heading } from '@astryxdesign/core/Heading'
import { List, ListItem } from '@astryxdesign/core/List'
import { VStack } from '@astryxdesign/core/Stack'
import { Text } from '@astryxdesign/core/Text'
import { Token } from '@astryxdesign/core/Token'
import { useEffect, useState } from 'react'

import type { RuntimeEvent } from '#/features/canvas/types'
import { usePrivacy } from '#/features/privacy/privacy-provider'
import { listRuns } from '#/features/recipes/local-store'
import type { RunRecord } from '#/features/recipes/types'
import { formatBytes } from '#/lib/format-bytes'

interface RuntimeDebuggerProps {
  events: RuntimeEvent[]
  refreshKey: number
}

export function RuntimeDebugger({ events, refreshKey }: RuntimeDebuggerProps) {
  const privacy = usePrivacy()
  const [runs, setRuns] = useState<RunRecord[]>([])

  useEffect(() => {
    void refreshKey
    if (privacy.mode === 'private') {
      setRuns([])
      return
    }
    listRuns()
      .then(setRuns)
      .catch(() => setRuns([]))
  }, [privacy.mode, refreshKey])

  return (
    <VStack gap={5}>
      <VStack gap={1}>
        <Heading level={2}>Pipeline debugger</Heading>
        <Text color="secondary">Observed worker events and file-free local run summaries.</Text>
      </VStack>
      {events.length ? (
        <List density="compact" hasDividers header={<Text type="label">Current trace</Text>}>
          {events.map((event) => (
            <ListItem
              key={event.id}
              label={event.label}
              description={`${Math.round(event.elapsedMs)} ms elapsed`}
              endContent={<Token label={`${event.progress}%`} color="blue" size="sm" />}
            />
          ))}
        </List>
      ) : (
        <EmptyState
          title="No runtime events"
          description="Run the pipeline to inspect real worker progress."
          isCompact
        />
      )}
      {privacy.mode === 'private' ? (
        <Banner
          status="info"
          title="History disabled"
          description="Private Session does not retain run summaries."
        />
      ) : runs.length ? (
        <List density="compact" hasDividers header={<Text type="label">Local run history</Text>}>
          {runs.map((run) => (
            <ListItem
              key={run.id}
              label={`${run.completed}/${run.sourceCount} completed · ${run.format.toUpperCase()}`}
              description={`${Math.round(run.durationMs)} ms · ${formatBytes(run.totalOutputBytes)} · ${run.failed} failed`}
              endContent={
                <Text type="supporting">{new Date(run.updatedAt).toLocaleDateString()}</Text>
              }
            />
          ))}
        </List>
      ) : null}
    </VStack>
  )
}
