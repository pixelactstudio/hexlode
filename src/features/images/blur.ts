/**
 * Gaussian blur, approximated by three box blurs per direction, and unsharp-mask sharpening.
 * Colours are premultiplied by alpha while blurring, so edges next to transparent pixels keep
 * their colour instead of darkening.
 */
import type { Pixels } from '#/features/images/types'

const PASSES = 3

/** Box widths whose three passes approximate a Gaussian with this standard deviation. */
function boxRadii(sigma: number) {
  const ideal = Math.sqrt((12 * sigma * sigma) / PASSES + 1)
  let lower = Math.floor(ideal)
  if (lower % 2 === 0) lower -= 1
  const upper = lower + 2
  const lowerCount = Math.round(
    (12 * sigma * sigma - PASSES * lower * lower - 4 * PASSES * lower - 3 * PASSES) /
      (-4 * lower - 4),
  )
  return Array.from({ length: PASSES }, (_, pass) =>
    Math.max(0, ((pass < lowerCount ? lower : upper) - 1) / 2),
  )
}

/** Box-blurs `length` RGBA values from `from` into `to`, repeating edge values past the ends. */
function boxLine(from: Float32Array, to: Float32Array, length: number, radius: number) {
  if (radius === 0) {
    to.set(from.subarray(0, length * 4))
    return
  }
  const width = radius * 2 + 1
  for (let channel = 0; channel < 4; channel += 1) {
    const at = (index: number) => from[Math.min(length - 1, Math.max(0, index)) * 4 + channel]
    let sum = 0
    for (let index = -radius; index <= radius; index += 1) sum += at(index)
    for (let index = 0; index < length; index += 1) {
      to[index * 4 + channel] = sum / width
      sum += at(index + radius + 1) - at(index - radius)
    }
  }
}

function blurLine(line: Float32Array, scratch: Float32Array, length: number, radii: number[]) {
  let from = line
  let to = scratch
  for (const radius of radii) {
    boxLine(from, to, length, radius)
    ;[from, to] = [to, from]
  }
  if (from !== line) line.set(from.subarray(0, length * 4))
}

export function gaussianBlur(pixels: Pixels, sigma: number): Pixels {
  const { width, height } = pixels
  const data = new Uint8ClampedArray(pixels.data)
  if (sigma <= 0) return { data, width, height }
  const radii = boxRadii(sigma).map(Math.round)
  const longest = Math.max(width, height)
  const line = new Float32Array(longest * 4)
  const scratch = new Float32Array(longest * 4)

  for (let y = 0; y < height; y += 1) {
    const row = y * width * 4
    for (let x = 0; x < width; x += 1) {
      const at = row + x * 4
      const alpha = data[at + 3] / 255
      line[x * 4] = data[at] * alpha
      line[x * 4 + 1] = data[at + 1] * alpha
      line[x * 4 + 2] = data[at + 2] * alpha
      line[x * 4 + 3] = data[at + 3]
    }
    blurLine(line, scratch, width, radii)
    data.set(line.subarray(0, width * 4), row)
  }
  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      const at = (y * width + x) * 4
      line.set(data.subarray(at, at + 4), y * 4)
    }
    blurLine(line, scratch, height, radii)
    for (let y = 0; y < height; y += 1) {
      const at = (y * width + x) * 4
      const alpha = line[y * 4 + 3]
      const scale = alpha > 0 ? 255 / alpha : 0
      data[at] = line[y * 4] * scale
      data[at + 1] = line[y * 4 + 1] * scale
      data[at + 2] = line[y * 4 + 2] * scale
      data[at + 3] = alpha
    }
  }
  return { data, width, height }
}

/** Unsharp mask: adds `amount` times the difference between the image and its blur. */
export function sharpen(pixels: Pixels, sigma: number, amount: number): Pixels {
  const blurred = gaussianBlur(pixels, sigma)
  const source = pixels.data
  const data = new Uint8ClampedArray(source.length)
  for (let at = 0; at < source.length; at += 4) {
    for (let channel = 0; channel < 3; channel += 1) {
      const value = source[at + channel]
      data[at + channel] = value + (value - blurred.data[at + channel]) * amount
    }
    data[at + 3] = source[at + 3]
  }
  return { data, width: pixels.width, height: pixels.height }
}
