import { describe, expect, it } from 'vitest'

import { BACKGROUND_MODEL } from '#/features/background-removal/constants'
import { cutOut, logitsToMask, scaleMask, toModelInput } from '#/features/background-removal/mask'

function pixels(width: number, height: number, paint: (x: number, y: number) => number[]) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) data.set(paint(x, y), (y * width + x) * 4)
  }
  return { data, width, height }
}

const at = (image: { data: Uint8ClampedArray; width: number }, x: number, y: number) =>
  Array.from(image.data.subarray((y * image.width + x) * 4, (y * image.width + x) * 4 + 4))

describe('toModelInput', () => {
  it('lays out normalised red, green and blue planes', () => {
    const input = toModelInput(
      pixels(2, 1, (x) => (x === 0 ? [255, 0, 0, 255] : [0, 0, 255, 255])),
      BACKGROUND_MODEL,
    )
    // ImageNet statistics: (1 - 0.485) / 0.229 = 2.2489 and (0 - 0.485) / 0.229 = -2.1179.
    expect(Array.from(input).map((value) => Number(value.toFixed(4)))).toEqual([
      2.2489, -2.1179, -2.0357, -2.0357, -1.8044, 2.64,
    ])
  })
})

describe('logitsToMask', () => {
  it('turns logits into a mask with a clean background and a solid subject', () => {
    const mask = logitsToMask(Float32Array.from([-12, -4, 0, 4, 12]))
    // sigmoid(-4) is 4.6 of 255, faint enough to be background; sigmoid(4) is 250.4, solid.
    expect(Array.from(mask)).toEqual([0, 0, 128, 255, 255])
  })
})

describe('scaleMask', () => {
  it('stretches a small mask over the image smoothly', () => {
    const scaled = scaleMask(Uint8Array.from([0, 255, 0, 255]), 2, 8, 2)
    expect(scaled).toHaveLength(16)
    const row = Array.from(scaled.subarray(0, 8))
    expect(row[0]).toBe(0)
    expect(row[7]).toBe(255)
    for (let index = 1; index < row.length; index += 1) {
      expect(row[index]).toBeGreaterThanOrEqual(row[index - 1])
    }
    expect(row[3]).toBeGreaterThan(0)
    expect(row[4]).toBeLessThan(255)
  })
})

describe('cutOut', () => {
  it('keeps the subject and clears the background', () => {
    const image = pixels(4, 1, () => [200, 100, 50, 255])
    const result = cutOut(image, Uint8Array.from([0, 0, 255, 255]))
    expect(at(result, 0, 0)[3]).toBe(0)
    expect(at(result, 3, 0)).toEqual([200, 100, 50, 255])
  })

  it('keeps transparency the image already had', () => {
    const image = pixels(2, 1, (x) => [10, 20, 30, x === 0 ? 255 : 0])
    const result = cutOut(image, Uint8Array.from([255, 255]))
    expect(at(result, 0, 0)[3]).toBe(255)
    expect(at(result, 1, 0)[3]).toBe(0)
  })

  it('takes the old background out of the colour of soft edges', () => {
    // A red subject on a green background. The edge column is half subject, half background,
    // so the photo shows it olive: on white, that would read as a green fringe.
    const width = 64
    const edge = 32
    const image = pixels(width, 8, (x) =>
      x < edge ? [255, 0, 0, 255] : x === edge ? [128, 128, 0, 255] : [0, 255, 0, 255],
    )
    const mask = new Uint8Array(width * 8)
    for (let y = 0; y < 8; y += 1) {
      for (let x = 0; x < width; x += 1) mask[y * width + x] = x < edge ? 255 : x === edge ? 128 : 0
    }
    const [red, green, , alpha] = at(cutOut(image, mask), edge, 4)
    expect(alpha).toBe(128)
    expect(red).toBeGreaterThan(220)
    expect(green).toBeLessThan(40)
  })
})
