import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { Divider } from '@astryxdesign/core/Divider'
import { Icon } from '@astryxdesign/core/Icon'
import { ProgressBar } from '@astryxdesign/core/ProgressBar'
import { HStack, VStack } from '@astryxdesign/core/Stack'
import { Heading, Text } from '@astryxdesign/core/Text'
import { Download } from 'lucide-react'
import type { ReactNode } from 'react'

import { describeEstimate } from '#/features/engine/estimate'
import { FileDrop } from '#/features/runs/file-drop'
import { ResultsTable, resultRows } from '#/features/runs/results-table'
import {
  downloadDelivery,
  type RunController,
  type RunControllerState,
} from '#/features/runs/run-controller'
import { formatBytes, formatCount, formatDuration } from '#/lib/format'

function plural(count: number, noun: string) {
  return `${formatCount(count)} ${noun}${count === 1 ? '' : 's'}`
}

/** A numbered step of a tool page: add images, choose settings, run. */
export function StepCard({
  step,
  title,
  description,
  endContent,
  padding = 6,
  children,
}: {
  step: number
  title: string
  description?: string
  endContent?: ReactNode
  padding?: 0 | 6
  children?: ReactNode
}) {
  const header = (
    <HStack gap={3} vAlign="start" hAlign="between">
      <HStack gap={3} vAlign="start">
        <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-muted text-accent">
          <Text type="label" weight="semibold" color="inherit">
            {step}
          </Text>
        </span>
        <VStack gap={1}>
          <Heading level={2}>{title}</Heading>
          {description ? <Text type="supporting">{description}</Text> : null}
        </VStack>
      </HStack>
      {endContent}
    </HStack>
  )
  return (
    <Card padding={padding} elevation="low" height="100%">
      {padding === 0 ? (
        <VStack gap={0}>
          <VStack padding={6}>{header}</VStack>
          {children}
        </VStack>
      ) : (
        <VStack gap={5}>
          {header}
          {children}
        </VStack>
      )}
    </Card>
  )
}

export function FilesCard({
  controller,
  state,
  step = 1,
}: {
  controller: RunController
  state: RunControllerState
  step?: number
}) {
  const count = state.sources.length
  const bytes = state.sources.reduce((sum, source) => sum + (source.meta.size ?? 0), 0)
  return (
    <StepCard
      step={step}
      title="Add images"
      description="Drop as many as you like. They are read on this device and never uploaded."
    >
      <FileDrop onFiles={(files) => void controller.addFiles(files)} isDisabled={state.running} />
      {count > 0 ? (
        <HStack gap={2} vAlign="center" hAlign="between">
          <Text type="body" weight="semibold">
            {`${plural(count, 'image')} added · ${formatBytes(bytes)}`}
          </Text>
          <Button
            label="Remove all"
            size="sm"
            variant="ghost"
            onClick={() => void controller.clearFiles()}
            isDisabled={state.running}
          />
        </HStack>
      ) : null}
    </StepCard>
  )
}

/** Run controls, progress, results and download for a pipeline with one Output node. */
export function ResultsCard({
  controller,
  state,
  outputNodeId,
  runLabel,
  surface,
  step = 3,
}: {
  controller: RunController
  state: RunControllerState
  outputNodeId: string
  runLabel: string
  surface: 'quick-tool' | 'pipeline-tool'
  step?: number
}) {
  const { stats, sources, running } = state
  const delivery = stats.deliveries[outputNodeId]
  const rows = resultRows(state)
  const canRun = sources.length > 0 && !running && !state.preparing
  const count = sources.length
  const done = stats.status !== 'idle' && stats.status !== 'running'
  const delivered = delivery?.files.length ?? 0
  const totalIn = sources.reduce((sum, source) => sum + (source.meta.size ?? 0), 0)

  const title = running
    ? `Working on ${formatCount(Math.min(count, stats.finishedItems + 1))} of ${formatCount(count)}`
    : done
      ? `${formatCount(delivered)} of ${plural(count, 'image')} done`
      : 'Run and download'
  const description =
    done && stats.status === 'complete'
      ? `Finished in ${formatDuration(stats.ms)}. ${formatBytes(totalIn)} became ${formatBytes(delivery?.bytes ?? 0)}.`
      : done && stats.status === 'cancelled'
        ? 'Cancelled. The images that finished can still be downloaded.'
        : count === 0
          ? 'Add images in step 1 first. The results appear here.'
          : state.estimate
            ? `${plural(count, 'image')} ready. Estimated time: ${describeEstimate(state.estimate)}.`
            : `${plural(count, 'image')} ready.`

  const actions = (
    <HStack gap={2} vAlign="center">
      {running ? (
        <Button label="Cancel" variant="secondary" onClick={() => controller.cancel()} />
      ) : null}
      {delivery?.archive && !running ? (
        <Button
          label={
            delivery.files.length === 1 ? 'Download' : `Download ZIP of ${delivery.files.length}`
          }
          variant="primary"
          size="lg"
          icon={<Icon icon={Download} size="sm" />}
          onClick={() => downloadDelivery(delivery, surface)}
        />
      ) : (
        <Button
          label={runLabel}
          variant="primary"
          size="lg"
          isDisabled={!canRun}
          isLoading={running}
          clickAction={async () => {
            await controller.start({ singleFileAsIs: true })
          }}
        />
      )}
    </HStack>
  )

  return (
    <VStack gap={4}>
      {state.error ? (
        <Banner status="error" title="The run stopped" description={state.error} />
      ) : null}
      <StepCard
        step={step}
        title={title}
        description={description}
        endContent={actions}
        padding={0}
      >
        {running ? (
          <VStack paddingInline={6} paddingBlock={2}>
            <ProgressBar
              label="Progress"
              isLabelHidden
              value={stats.finishedItems}
              max={Math.max(1, count)}
            />
          </VStack>
        ) : null}
        {rows.length > 0 ? (
          <>
            <Divider />
            <ResultsTable rows={rows} />
          </>
        ) : null}
      </StepCard>
    </VStack>
  )
}
