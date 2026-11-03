/**
 * Colour and tone changes that map each pixel on its own: Adjust and Filters. Alpha is kept.
 */
import { lumaOf, type Rgba } from '#/features/images/colour'
import type { Pixels } from '#/features/images/types'

export interface ToneAdjustments {
  /** −100 to 100: shifts every level by up to 128. */
  brightness: number
  /** −100 to 100: scales the distance from the middle level, from flat grey to double. */
  contrast: number
  /** −100 to 100: −100 leaves only luminance, 100 doubles the distance from it. */
  saturation: number
  /** Stops of light, −3 to 3. Each stop doubles or halves linear light. */
  exposure: number
}

const toLinear = (value: number) => {
  const v = value / 255
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}

const toStored = (linear: number) => {
  const v = linear <= 0.0031308 ? linear * 12.92 : 1.055 * linear ** (1 / 2.4) - 0.055
  return v * 255
}

const clamp = (value: number) => Math.min(255, Math.max(0, value))

/** One lookup table for exposure, brightness and contrast, in that order. */
function levelTable({ brightness, contrast, exposure }: ToneAdjustments) {
  const gain = 2 ** exposure
  const shift = (brightness / 100) * 128
  const spread = 1 + contrast / 100
  const table = new Uint8ClampedArray(256)
  for (let level = 0; level < 256; level += 1) {
    let value = exposure === 0 ? level : toStored(Math.min(1, toLinear(level) * gain))
    value = clamp(value + shift)
    value = (value - 128) * spread + 128
    table[level] = Math.round(clamp(value))
  }
  return table
}

export function isNeutral(adjustments: ToneAdjustments) {
  return (
    adjustments.brightness === 0 &&
    adjustments.contrast === 0 &&
    adjustments.saturation === 0 &&
    adjustments.exposure === 0
  )
}

export function adjustTone(pixels: Pixels, adjustments: ToneAdjustments): Pixels {
  const table = levelTable(adjustments)
  const colourScale = 1 + adjustments.saturation / 100
  const source = pixels.data
  const data = new Uint8ClampedArray(source.length)
  for (let at = 0; at < source.length; at += 4) {
    let red = table[source[at]]
    let green = table[source[at + 1]]
    let blue = table[source[at + 2]]
    if (colourScale !== 1) {
      const luma = lumaOf(red, green, blue)
      red = luma + (red - luma) * colourScale
      green = luma + (green - luma) * colourScale
      blue = luma + (blue - luma) * colourScale
    }
    data[at] = red
    data[at + 1] = green
    data[at + 2] = blue
    data[at + 3] = source[at + 3]
  }
  return { data, width: pixels.width, height: pixels.height }
}

export type FilterName = 'grayscale' | 'sepia' | 'duotone' | 'invert'

export interface FilterOptions {
  filter: FilterName
  /** 0 to 100: how much of the filtered colour replaces the original. */
  strength: number
  /** Duotone maps dark levels to `shadows` and light levels to `highlights`. */
  shadows: Rgba
  highlights: Rgba
}

/** The classic sepia matrix. */
const SEPIA = [
  [0.393, 0.769, 0.189],
  [0.349, 0.686, 0.168],
  [0.272, 0.534, 0.131],
]

export function applyFilter(pixels: Pixels, options: FilterOptions): Pixels {
  const mix = options.strength / 100
  const source = pixels.data
  const data = new Uint8ClampedArray(source.length)
  const filtered: [number, number, number] = [0, 0, 0]
  const { shadows, highlights } = options
  for (let at = 0; at < source.length; at += 4) {
    const red = source[at]
    const green = source[at + 1]
    const blue = source[at + 2]
    switch (options.filter) {
      case 'grayscale': {
        const luma = lumaOf(red, green, blue)
        filtered[0] = luma
        filtered[1] = luma
        filtered[2] = luma
        break
      }
      case 'sepia':
        for (let channel = 0; channel < 3; channel += 1) {
          const [r, g, b] = SEPIA[channel]
          filtered[channel] = r * red + g * green + b * blue
        }
        break
      case 'duotone': {
        const t = lumaOf(red, green, blue) / 255
        for (let channel = 0; channel < 3; channel += 1) {
          filtered[channel] = shadows[channel] + (highlights[channel] - shadows[channel]) * t
        }
        break
      }
      case 'invert':
        filtered[0] = 255 - red
        filtered[1] = 255 - green
        filtered[2] = 255 - blue
        break
    }
    data[at] = red + (filtered[0] - red) * mix
    data[at + 1] = green + (filtered[1] - green) * mix
    data[at + 2] = blue + (filtered[2] - blue) * mix
    data[at + 3] = source[at + 3]
  }
  return { data, width: pixels.width, height: pixels.height }
}
