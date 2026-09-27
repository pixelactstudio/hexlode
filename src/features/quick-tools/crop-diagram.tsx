import { HStack, VStack } from '@astryxdesign/core/Stack'
import { Text } from '@astryxdesign/core/Text'

import { planCrop } from '#/features/nodes/definitions/crop'
import type { CropToolSettings } from '#/features/quick-tools/tools'

/** Photo shapes the diagram draws the crop on, in pixels. */
const SAMPLES = [
  { label: 'Landscape', width: 3000, height: 2000 },
  { label: 'Portrait', width: 2000, height: 3000 },
] as const

/** Longest side of each drawing, in CSS pixels. */
const DRAWN = 96

/** A small rectangle in the shape of an aspect ratio, for the ratio buttons. */
export function AspectShape({ ratio }: { ratio: number }) {
  const width = ratio >= 1 ? 14 : Math.max(5, 14 * ratio)
  const height = ratio >= 1 ? Math.max(5, 14 / ratio) : 14
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none">
      <rect
        x={(16 - width) / 2}
        y={(16 - height) / 2}
        width={width}
        height={height}
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  )
}

/** What the crop keeps from a landscape and a portrait photo. */
export function CropDiagram({ settings }: { settings: CropToolSettings }) {
  return (
    <HStack gap={4} vAlign="end">
      {SAMPLES.map((sample) => {
        const scale = DRAWN / Math.max(sample.width, sample.height)
        const width = sample.width * scale
        const height = sample.height * scale
        const kept = planCrop(settings, sample.width, sample.height)
        const box = {
          x: kept.x * scale,
          y: kept.y * scale,
          width: kept.width * scale,
          height: kept.height * scale,
        }
        return (
          <VStack key={sample.label} gap={1.5} hAlign="center">
            <svg
              width={width}
              height={height}
              viewBox={`0 0 ${width} ${height}`}
              role="img"
              aria-label={`${sample.label} photo: the highlighted part is kept`}
              fill="none"
            >
              <rect width={width} height={height} rx="4" className="fill-muted" />
              <path
                d={`M0 ${height} L${width * 0.4} ${height * 0.45} L${width * 0.7} ${height} Z`}
                className="fill-border-strong"
              />
              <circle
                cx={width * 0.74}
                cy={height * 0.28}
                r={Math.min(width, height) * 0.09}
                className="fill-border-strong"
              />
              <path
                d={`M0 0H${width}V${height}H0Z M${box.x} ${box.y}v${box.height}h${box.width}v${-box.height}Z`}
                fillRule="evenodd"
                className="fill-body"
                opacity="0.72"
              />
              <rect
                x={box.x + 0.75}
                y={box.y + 0.75}
                width={Math.max(0, box.width - 1.5)}
                height={Math.max(0, box.height - 1.5)}
                rx="2"
                className="text-purple-vivid"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <rect
                x="0.5"
                y="0.5"
                width={width - 1}
                height={height - 1}
                rx="4"
                className="stroke-border-strong"
              />
            </svg>
            <Text type="supporting">{sample.label}</Text>
          </VStack>
        )
      })}
    </HStack>
  )
}
