/**
 * `threshold.onnx`, a tiny stand-in for the background removal model with the same input and
 * output, made by `scripts/generate-model-fixture.mjs`. It sees bright pixels as the subject.
 * Tests keep it under the real model's name, so workers load it as they would the real one.
 */
import { BACKGROUND_MODEL } from '#/features/background-removal/constants'
import { downloadModel } from '#/features/background-removal/model-files'

export const STAND_IN_MODEL_URL = new URL('./fixtures/threshold.onnx', import.meta.url).href

export const STAND_IN_MODEL = {
  ...BACKGROUND_MODEL,
  bytes: 305,
  sha256: '88faaa3049f5bdccf2573b9eb35905ddf41134660e021cda851ea4341dad8ccf',
}

/** Puts the stand-in where the real model would be kept after its download. */
export function storeStandInModel() {
  return downloadModel(STAND_IN_MODEL, { from: STAND_IN_MODEL_URL })
}

/** A white disc on black: the subject the stand-in finds. */
export function brightDisc(width = 64, height = 48) {
  const data = new Uint8ClampedArray(width * height * 4)
  const radius = Math.min(width, height) / 3
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const inside = (x - width / 2) ** 2 + (y - height / 2) ** 2 < radius ** 2
      data.set(inside ? [250, 250, 250, 255] : [5, 5, 5, 255], (y * width + x) * 4)
    }
  }
  return { data, width, height }
}
