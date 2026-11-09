import type { Segmenter } from '#/features/background-removal/types'

/**
 * Stands in for the inference worker where a test is about what happens around the model: it
 * sees red things as the subject. The worker and the real model have their own tests.
 */
export function redSubjectSegmenter(inputSize = 64): Segmenter & { sizes: number[] } {
  const sizes: number[] = []
  return {
    inputSize,
    sizes,
    async segment(pixels) {
      sizes.push(pixels.width, pixels.height)
      const mask = new Uint8Array(pixels.width * pixels.height)
      for (let index = 0; index < mask.length; index += 1) {
        const [red, green, blue] = pixels.data.subarray(index * 4, index * 4 + 3)
        mask[index] = red > 128 && green < 100 && blue < 100 ? 255 : 0
      }
      return mask
    },
  }
}
