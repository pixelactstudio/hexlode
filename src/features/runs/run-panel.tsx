import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { ProgressBar } from '@astryxdesign/core/ProgressBar'
import { HStack, VStack } from '@astryxdesign/core/Stack'
import { Heading, Text } from '@astryxdesign/core/Text'

import { describeEstimate } from '#/features/engine/estimate'
import { FileDrop } from '#/features/runs/file-drop'
import { ResultsTable, resultRows } from '#/features/runs/results-table'
import {
  downloadDelivery,
  type RunController,
  type RunControllerState,
} from '#/features/runs/run-controller'
import { formatBytes, formatCount, formatDuration } from '#/lib/format'

export function FilesCard({
  controller,
  state,
}: {
  controller: RunController
  state: RunControllerState
}) {
  return (
    <Card>
      <VStack gap={3}>
        <Heading level={2}>Images</Heading>
        <FileDrop onFiles={(files) => void controller.addFiles(files)} isDisabled={state.running} />
      </VStack>
    </Card>
  )
}

/** Run controls, progress, results and download for a pipeline with one Output node. */
export function ResultsCard({
  controller,
  state,
  outputNodeId,
  runLabel,
  surface,
}: {
  controller: RunController
  state: RunControllerState
  outputNodeId: string
  runLabel: string
  surface: 'quick-tool' | 'pipeline-tool'
}) {
  const { stats, sources, running } = state
  const delivery = stats.deliveries[outputNodeId]
  const rows = resultRows(state)
  const canRun = sources.length > 0 && !running && !state.preparing
  const count = sources.length
  const done = stats.status !== 'idle' && stats.status !== 'running'
  const delivered = delivery?.files.length ?? 0
  const totalIn = sources.reduce((sum, source) => sum + (source.meta.size ?? 0), 0)
  if (rows.length === 0 && !state.error) return null

  const heading = running
    ? `Working on ${formatCount(Math.min(count, stats.finishedItems + 1))} of ${formatCount(count)}`
    : done
      ? `${formatCount(delivered)} of ${formatCount(count)} image${count === 1 ? '' : 's'} done`
      : `${formatCount(count)} image${count === 1 ? '' : 's'} ready`
  const summary =
    done && stats.status === 'complete'
      ? `Finished in ${formatDuration(stats.ms)}. ${formatBytes(totalIn)} became ${formatBytes(delivery?.bytes ?? 0)}.`
      : done && stats.status === 'cancelled'
        ? 'Cancelled. Finished images are still available.'
        : state.estimate && count > 0
          ? `Estimate: ${describeEstimate(state.estimate)}.`
          : 'Add images to start.'

  return (
    <VStack gap={4}>
      {state.error ? (
        <Banner status="error" title="The run stopped" description={state.error} />
      ) : null}
      <Card padding={0}>
        <VStack gap={0}>
          <HStack gap={3} padding={4} vAlign="center" hAlign="between" wrap="wrap">
            <VStack gap={1}>
              <Heading level={2}>{heading}</Heading>
              <Text type="supporting">{summary}</Text>
            </VStack>
            <HStack gap={2}>
              {running ? (
                <Button label="Cancel" variant="secondary" onClick={() => controller.cancel()} />
              ) : (
                <Button
                  label="Clear"
                  variant="ghost"
                  onClick={() => void controller.clearFiles()}
                />
              )}
              {delivery?.archive && !running ? (
                <Button
                  label={
                    delivery.files.length === 1
                      ? 'Download'
                      : `Download ZIP of ${formatCount(delivery.files.length)}`
                  }
                  variant="primary"
                  onClick={() => downloadDelivery(delivery, surface)}
                />
              ) : (
                <Button
                  label={runLabel}
                  variant="primary"
                  isDisabled={!canRun}
                  isLoading={running}
                  clickAction={async () => {
                    await controller.start({ singleFileAsIs: true })
                  }}
                />
              )}
            </HStack>
          </HStack>
          {running ? (
            <HStack paddingInline={4} paddingBlock={2}>
              <ProgressBar
                label="Progress"
                isLabelHidden
                value={stats.finishedItems}
                max={Math.max(1, count)}
              />
            </HStack>
          ) : null}
          <ResultsTable rows={rows} />
        </VStack>
      </Card>
    </VStack>
  )
}
