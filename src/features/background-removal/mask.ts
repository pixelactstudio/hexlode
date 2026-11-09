/**
 * The pixel work around a segmentation model: the tensor it takes, the mask it gives back, and
 * the cut-out made from that mask at the image's own size. Plain functions, used by the inference
 * worker and by the Remove background node in the engine workers.
 */
import {
  FOREGROUND_BLUR_SIZES,
  MASK_CLEAR,
  MASK_OPAQUE,
} from '#/features/background-removal/constants'
import type { SegmentationModel } from '#/features/background-removal/types'
import type { Pixels } from '#/features/images/types'

/** Normalised red, green and blue planes, one after another, as the model's input tensor. */
export function toModelInput(pixels: Pixels, model: Pick<SegmentationModel, 'mean' | 'std'>) {
  const count = pixels.width * pixels.height
  const input = new Float32Array(count * 3)
  for (let channel = 0; channel < 3; channel += 1) {
    const mean = model.mean[channel]
    const std = model.std[channel]
    const plane = channel * count
    for (let index = 0; index < count; index += 1) {
      input[plane + index] = (pixels.data[index * 4 + channel] / 255 - mean) / std
    }
  }
  return input
}

/** The model's logits as a mask from 0 to 255, with near-certain values made certain. */
export function logitsToMask(logits: Float32Array) {
  const mask = new Uint8Array(logits.length)
  for (let index = 0; index < logits.length; index += 1) {
    const value = Math.round(255 / (1 + Math.exp(-logits[index])))
    mask[index] = value <= MASK_CLEAR ? 0 : value >= MASK_OPAQUE ? 255 : value
  }
  return mask
}

/** Stretches a square mask of `size` pixels a side over an image, with bilinear filtering. */
export function scaleMask(mask: Uint8Array, size: number, width: number, height: number) {
  const scaled = new Uint8Array(width * height)
  const xs = samplePositions(size, width)
  const ys = samplePositions(size, height)
  for (let y = 0; y < height; y += 1) {
    const { low: y0, high: y1, weight: wy } = ys[y]
    for (let x = 0; x < width; x += 1) {
      const { low: x0, high: x1, weight: wx } = xs[x]
      const top = mask[y0 * size + x0] * (1 - wx) + mask[y0 * size + x1] * wx
      const bottom = mask[y1 * size + x0] * (1 - wx) + mask[y1 * size + x1] * wx
      scaled[y * width + x] = Math.round(top * (1 - wy) + bottom * wy)
    }
  }
  return scaled
}

/** For each target pixel, the two source pixels around its centre and how far it is between. */
function samplePositions(source: number, target: number) {
  return Array.from({ length: target }, (_, index) => {
    const position = Math.min(source - 1, Math.max(0, ((index + 0.5) * source) / target - 0.5))
    const low = Math.floor(position)
    return { low, high: Math.min(source - 1, low + 1), weight: position - low }
  })
}

/**
 * The image with the mask as its transparency, multiplied with any it had. Where the edge is
 * soft, the colour is the subject's own, estimated from nearby pixels, so no fringe of the old
 * background shows on a new one.
 */
export function cutOut(pixels: Pixels, mask: Uint8Array): Pixels {
  const { width, height } = pixels
  const count = width * height
  const data = new Uint8ClampedArray(pixels.data)
  let soft = false
  for (let index = 0; index < count; index += 1) {
    const alpha = Math.round((data[index * 4 + 3] * mask[index]) / 255)
    data[index * 4 + 3] = alpha
    if (alpha > 0 && alpha < 255) soft = true
  }
  if (soft) estimateForeground(pixels, data)
  return { data, width, height }
}

/**
 * Approximate fast foreground colour estimation (Forte and Pitié, 2021): blur the subject's and
 * the background's colours separately, then take from each partly transparent pixel the part of
 * its colour that the background explains. Writes the colours into `result`, whose alpha holds
 * the mask. Works one channel at a time, so it holds three float planes at most.
 */
function estimateForeground(image: Pixels, result: Uint8ClampedArray) {
  const { width, height } = image
  const count = width * height
  const alphaAt = (index: number) => result[index * 4 + 3] / 255
  const blurredAlpha = new Float32Array(count)
  const weighted = new Float32Array(count)
  const behind = new Float32Array(count)
  const background = new Uint8ClampedArray(count * 3)
  for (let index = 0; index < count; index += 1) {
    for (let channel = 0; channel < 3; channel += 1) {
      background[index * 3 + channel] = image.data[index * 4 + channel]
    }
  }
  for (const size of FOREGROUND_BLUR_SIZES) {
    for (let index = 0; index < count; index += 1) blurredAlpha[index] = alphaAt(index)
    boxBlur(blurredAlpha, width, height, size)
    for (let channel = 0; channel < 3; channel += 1) {
      // The subject's colour near each pixel: blur(F × α) / blur(α).
      for (let index = 0; index < count; index += 1) {
        weighted[index] = (result[index * 4 + channel] / 255) * alphaAt(index)
      }
      boxBlur(weighted, width, height, size)
      const subject = weighted
      for (let index = 0; index < count; index += 1) {
        subject[index] /= blurredAlpha[index] + 1e-5
      }
      // The background's colour near each pixel: blur(B × (1 − α)) / (1 − blur(α)).
      for (let index = 0; index < count; index += 1) {
        behind[index] = (background[index * 3 + channel] / 255) * (1 - alphaAt(index))
      }
      boxBlur(behind, width, height, size)
      for (let index = 0; index < count; index += 1) {
        const a = alphaAt(index)
        const b = behind[index] / (1 - blurredAlpha[index] + 1e-5)
        background[index * 3 + channel] = b * 255
        if (a === 0 || a === 1) continue
        const observed = image.data[index * 4 + channel] / 255
        const f = subject[index] + a * (observed - a * subject[index] - (1 - a) * b)
        result[index * 4 + channel] = f * 255
      }
    }
  }
}

/** Replaces each value with the mean of a `size` × `size` box around it, clipped at the edges. */
function boxBlur(values: Float32Array, width: number, height: number, size: number) {
  const before = Math.floor(size / 2)
  const after = size - before - 1
  const line = new Float32Array(Math.max(width, height))
  const pass = (length: number, lines: number, at: (line: number, index: number) => number) => {
    for (let current = 0; current < lines; current += 1) {
      for (let index = 0; index < length; index += 1) line[index] = values[at(current, index)]
      let sum = 0
      let low = 0
      let high = -1
      for (let index = 0; index < length; index += 1) {
        const start = Math.max(0, index - before)
        const end = Math.min(length - 1, index + after)
        while (high < end) sum += line[++high]
        while (low < start) sum -= line[low++]
        values[at(current, index)] = sum / (end - start + 1)
      }
    }
  }
  pass(width, height, (row, x) => row * width + x)
  pass(height, width, (column, y) => y * width + column)
}
