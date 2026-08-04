import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Heading } from '@astryxdesign/core/Heading'
import { List, ListItem } from '@astryxdesign/core/List'
import { NumberInput } from '@astryxdesign/core/NumberInput'
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl'
import { VStack } from '@astryxdesign/core/Stack'
import { Text } from '@astryxdesign/core/Text'
import { Token } from '@astryxdesign/core/Token'
import { useState } from 'react'

import type { SelectedImage } from '#/features/canvas/types'
import { ImageComparison } from '#/features/comparison/image-comparison'
import type { ConstraintResult } from '#/features/processing/constraint-solver'
import { getOutputDetails } from '#/features/processing/output'
import type { OutputFormat, ProcessedImage, TournamentResult } from '#/features/processing/types'
import { formatBytes } from '#/lib/format-bytes'

export interface TournamentViewResult extends TournamentResult {
  previewUrl: string
}

interface ImageLabProps {
  constraint: ConstraintResult | null
  constraintMaxKilobytes: number
  isBusy: boolean
  onRunConstraint: () => void
  onRunTournament: () => void
  onUseTournamentResult: (format: OutputFormat) => void
  result: ProcessedImage | null
  resultUrl: string | null
  selectedImage: SelectedImage | null
  setConstraintMaxKilobytes: (value: number) => void
  tournament: TournamentViewResult[]
}

export function ImageLab({
  constraint,
  constraintMaxKilobytes,
  isBusy,
  onRunConstraint,
  onRunTournament,
  onUseTournamentResult,
  result,
  resultUrl,
  selectedImage,
  setConstraintMaxKilobytes,
  tournament,
}: ImageLabProps) {
  const [view, setView] = useState('tournament')

  if (!selectedImage) {
    return (
      <EmptyState
        title="Choose a source image"
        description="The image lab reuses the selected file and the same local worker as the pipeline."
        isCompact
      />
    )
  }

  const tournamentView = (
    <VStack gap={4}>
      <VStack gap={1}>
        <Heading level={2}>Codec tournament</Heading>
        <Text color="secondary">Compare each browser encoder against the same input.</Text>
      </VStack>
      <Button
        label={tournament.length ? 'Run again' : 'Run tournament'}
        variant="primary"
        isDisabled={isBusy}
        onClick={onRunTournament}
      />
      {tournament.length ? (
        <List density="compact" hasDividers header={<Text type="label">Measured results</Text>}>
          {tournament.map((entry) => (
            <ListItem
              key={entry.format}
              label={getOutputDetails(entry.format).label}
              description={`${formatBytes(entry.size)} · ${Math.round(entry.durationMs)} ms · ${entry.format === 'png' ? 'lossless' : 'configured quality'} · ${entry.compatibility}`}
              endContent={
                <Button
                  label="Use"
                  variant="secondary"
                  size="sm"
                  onClick={() => onUseTournamentResult(entry.format)}
                />
              }
            />
          ))}
        </List>
      ) : null}
      {tournament.some(({ transparency }) => transparency === 'flattened') ? (
        <Banner
          status="warning"
          title="JPEG transparency policy"
          description="JPEG results flatten transparent pixels onto white. WebP and PNG preserve transparency."
        />
      ) : null}
    </VStack>
  )

  const constraintView = (
    <VStack gap={4}>
      <VStack gap={1}>
        <Heading level={2}>Constraint solver</Heading>
        <Text color="secondary">Find the highest WebP quality under a hard size limit.</Text>
      </VStack>
      <NumberInput
        label="Maximum file size"
        value={constraintMaxKilobytes}
        onChange={setConstraintMaxKilobytes}
        min={1}
        max={30_000}
        step={10}
        units="KB"
        isIntegerOnly
        width="100%"
        isDisabled={isBusy}
      />
      <Button
        label={constraint ? 'Search again' : 'Find best quality'}
        variant="primary"
        isDisabled={isBusy}
        onClick={onRunConstraint}
      />
      {constraint ? (
        constraint.best ? (
          <Banner
            status="success"
            title={`Quality ${constraint.best.quality} meets the limit`}
            description={`${formatBytes(constraint.best.size)} after ${constraint.attempts.length} bounded attempts.`}
          />
        ) : (
          <Banner
            status="warning"
            title="No valid output"
            description={`The smallest tested output still exceeded ${formatBytes(constraintMaxKilobytes * 1024)}.`}
          />
        )
      ) : null}
      {constraint?.attempts.length ? (
        <List density="compact" hasDividers header={<Text type="label">Search trace</Text>}>
          {constraint.attempts.map((attempt) => (
            <ListItem
              key={attempt.quality}
              label={`Quality ${attempt.quality}`}
              description={formatBytes(attempt.size)}
              endContent={
                <Token
                  label={attempt.size <= constraintMaxKilobytes * 1024 ? 'pass' : 'over'}
                  color={attempt.size <= constraintMaxKilobytes * 1024 ? 'green' : 'orange'}
                  size="sm"
                />
              }
            />
          ))}
        </List>
      ) : null}
    </VStack>
  )

  const differenceView =
    result && resultUrl ? (
      <VStack gap={4}>
        <VStack gap={1}>
          <Heading level={2}>Visual difference lab</Heading>
          <Text color="secondary">
            Drag the split to inspect the source against the real output.
          </Text>
        </VStack>
        <ImageComparison
          mode="slider"
          source={{
            label: 'Source',
            url: selectedImage.previewUrl,
            width: selectedImage.info.width,
            height: selectedImage.info.height,
            size: selectedImage.file.size,
          }}
          result={{
            label: getOutputDetails(result.format).label,
            url: resultUrl,
            width: result.width,
            height: result.height,
            size: result.size,
          }}
        />
      </VStack>
    ) : (
      <EmptyState
        title="No output to compare"
        description="Run the pipeline, tournament, or constraint solver first."
        isCompact
      />
    )

  return (
    <VStack gap={5}>
      <SegmentedControl
        label="Image lab view"
        value={view}
        onChange={setView}
        layout="fill"
        size="sm"
      >
        <SegmentedControlItem value="tournament" label="Codecs" />
        <SegmentedControlItem value="constraint" label="Solver" />
        <SegmentedControlItem value="difference" label="Difference" />
      </SegmentedControl>
      {view === 'tournament'
        ? tournamentView
        : view === 'constraint'
          ? constraintView
          : differenceView}
    </VStack>
  )
}
