import { AspectRatio } from '@astryxdesign/core/AspectRatio'
import { Overlay } from '@astryxdesign/core/Overlay'
import { Section } from '@astryxdesign/core/Section'
import { Slider } from '@astryxdesign/core/Slider'
import { HStack, VStack } from '@astryxdesign/core/Stack'
import { Text } from '@astryxdesign/core/Text'
import { useEffect, useRef, useState } from 'react'

import { formatBytes } from '#/lib/format-bytes'

interface Preview {
  height: number
  label: string
  size: number
  url: string
  width: number
}

interface ImageComparisonProps {
  mode?: 'slider' | 'stacked'
  source: Preview
  result: Preview | null
}

function previewDetails(preview: Preview) {
  return `${preview.width} × ${preview.height} · ${formatBytes(preview.size)}`
}

function ComparisonPreview({ preview }: { preview: Preview | null }) {
  const label = preview?.label ?? 'WebP'
  const details = preview ? previewDetails(preview) : 'Run the pipeline to create an output.'

  return (
    <VStack gap={2}>
      <HStack gap={2} hAlign="between" vAlign="center">
        <Text type="label">{label}</Text>
        <Text type="supporting" hasTabularNumbers>
          {details}
        </Text>
      </HStack>
      <Section variant="muted" padding={0}>
        <AspectRatio ratio={16 / 9} fit={preview ? 'contain' : 'center'}>
          {preview ? (
            <img src={preview.url} alt={`${preview.label} preview`} />
          ) : (
            <Text type="supporting" color="secondary">
              WebP preview pending
            </Text>
          )}
        </AspectRatio>
      </Section>
    </VStack>
  )
}

export function ImageComparison({ source, result, mode = 'stacked' }: ImageComparisonProps) {
  const [reveal, setReveal] = useState(50)
  const sliderPreviewRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    sliderPreviewRef.current?.style.setProperty('--difference-reveal', `${reveal}%`)
  }, [reveal])

  if (mode === 'slider' && result) {
    return (
      <VStack gap={3}>
        <HStack gap={2} hAlign="between" vAlign="center">
          <Text type="label">Source</Text>
          <Text type="label">{result.label}</Text>
        </HStack>
        <Section variant="muted" padding={0}>
          <AspectRatio ratio={16 / 9} fit="contain">
            <Overlay
              ref={sliderPreviewRef}
              className="difference-preview"
              scrim={false}
              content={
                <img
                  className="difference-preview__source"
                  src={source.url}
                  alt="Source side of the comparison"
                />
              }
            >
              <img src={result.url} alt={`${result.label} side of the comparison`} />
            </Overlay>
          </AspectRatio>
        </Section>
        <Slider
          label="Comparison split"
          value={reveal}
          onChange={(value: number | [number, number]) => {
            if (typeof value === 'number') setReveal(value)
          }}
          min={0}
          max={100}
          step={1}
          formatValue={(value: number) => `${value}% source`}
          valueDisplay="text"
          width="100%"
        />
      </VStack>
    )
  }

  return (
    <VStack gap={4}>
      <ComparisonPreview preview={source} />
      <ComparisonPreview preview={result} />
    </VStack>
  )
}
