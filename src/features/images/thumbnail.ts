import type { Codecs, Pixels } from '#/features/images/types'

/** Scales pixels down so the longest edge is at most `edge`. Never enlarges. */
export async function scaleDown(pixels: Pixels, edge: number, codecs: Codecs) {
  const scale = Math.min(1, edge / Math.max(pixels.width, pixels.height))
  if (scale === 1) return pixels
  const width = Math.max(1, Math.round(pixels.width * scale))
  const height = Math.max(1, Math.round(pixels.height * scale))
  return codecs.resize(pixels, width, height, 'triangle')
}

/** A PNG for showing pixels in the interface. Not used for any output file. */
export async function displayBlob(pixels: Pixels) {
  const canvas = new OffscreenCanvas(pixels.width, pixels.height)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Previews need canvas support.')
  context.putImageData(
    new ImageData(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height),
    0,
    0,
  )
  return canvas.convertToBlob({ type: 'image/png' })
}
