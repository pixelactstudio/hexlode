/**
 * The main colours of an image by median cut: start with one box holding every colour, split
 * the box with the widest channel range at its median, and average each box at the end.
 */
import { hexOf } from '#/features/images/colour'
import type { Pixels } from '#/features/images/types'

/** At most this many pixels are read, spread evenly over the image. */
const SAMPLE_PIXELS = 16_384
/** Pixels less opaque than this are left out. */
const MIN_ALPHA = 128

export interface PaletteColour {
  hex: string
  /** Share of the counted pixels, rounded to four decimals. */
  share: number
}

type Box = number[][]

function sample(pixels: Pixels) {
  const { data, width, height } = pixels
  const step = Math.max(1, Math.ceil(Math.sqrt((width * height) / SAMPLE_PIXELS)))
  const colours: number[][] = []
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const at = (y * width + x) * 4
      if (data[at + 3] >= MIN_ALPHA) colours.push([data[at], data[at + 1], data[at + 2]])
    }
  }
  return colours
}

function widestChannel(box: Box) {
  let best = { channel: 0, range: -1 }
  for (let channel = 0; channel < 3; channel += 1) {
    let low = 255
    let high = 0
    for (const colour of box) {
      low = Math.min(low, colour[channel])
      high = Math.max(high, colour[channel])
    }
    if (high - low > best.range) best = { channel, range: high - low }
  }
  return best
}

/** Splits at the median, moved to the nearest change of value so equal colours stay together. */
function split(box: Box, channel: number): [Box, Box] {
  const sorted = [...box].sort((a, b) => a[channel] - b[channel])
  const end = sorted.length
  const same = (index: number) => sorted[index - 1][channel] === sorted[index][channel]
  const middle = Math.floor(end / 2)
  let below = middle
  while (below > 0 && same(below)) below -= 1
  let above = middle
  while (above < end && same(above)) above += 1
  // The box has a range, so at least one side has a change of value.
  const at =
    below === 0 ? above : above === end ? below : middle - below <= above - middle ? below : above
  return [sorted.slice(0, at), sorted.slice(at)]
}

export function extractPalette(pixels: Pixels, count: number): PaletteColour[] {
  const colours = sample(pixels)
  if (colours.length === 0) return []
  const boxes: Box[] = [colours]
  while (boxes.length < count) {
    let target = -1
    let widest = 0
    for (const [index, box] of boxes.entries()) {
      const { range } = widestChannel(box)
      // Weigh by size so a few stray pixels do not take a colour from a large area.
      const score = range * Math.sqrt(box.length)
      if (range > 0 && score > widest) {
        widest = score
        target = index
      }
    }
    if (target === -1) break
    const [first, second] = split(boxes[target], widestChannel(boxes[target]).channel)
    boxes.splice(target, 1, first, second)
  }
  const shares = new Map<string, number>()
  for (const box of boxes) {
    const average = [0, 1, 2].map(
      (channel) => box.reduce((total, colour) => total + colour[channel], 0) / box.length,
    )
    const hex = hexOf(average[0], average[1], average[2])
    shares.set(hex, (shares.get(hex) ?? 0) + box.length)
  }
  return [...shares]
    .map(([hex, size]) => ({ hex, share: Math.round((size / colours.length) * 10_000) / 10_000 }))
    .sort((a, b) => b.share - a.share || (a.hex < b.hex ? -1 : 1))
}
