import type { Pixels } from '#/features/images/types'

function blank(width: number, height: number): Pixels {
  return { data: new Uint8ClampedArray(width * height * 4), width, height }
}

export function crop(pixels: Pixels, x: number, y: number, width: number, height: number) {
  const output = blank(width, height)
  const source = new Uint32Array(
    pixels.data.buffer,
    pixels.data.byteOffset,
    pixels.width * pixels.height,
  )
  const target = new Uint32Array(output.data.buffer)
  for (let row = 0; row < height; row += 1) {
    const start = (y + row) * pixels.width + x
    target.set(source.subarray(start, start + width), row * width)
  }
  return output
}

/** Maps each output pixel to a source pixel. Used by the rotations and flips below. */
function remap(
  pixels: Pixels,
  width: number,
  height: number,
  sourceIndex: (x: number, y: number) => number,
) {
  const output = blank(width, height)
  const source = new Uint32Array(
    pixels.data.buffer,
    pixels.data.byteOffset,
    pixels.width * pixels.height,
  )
  const target = new Uint32Array(output.data.buffer)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) target[y * width + x] = source[sourceIndex(x, y)]
  }
  return output
}

/** Rotates clockwise by a multiple of 90 degrees. */
export function rotate(pixels: Pixels, degrees: 0 | 90 | 180 | 270) {
  const { width: w, height: h } = pixels
  if (degrees === 90) return remap(pixels, h, w, (x, y) => (h - 1 - x) * w + y)
  if (degrees === 180) return remap(pixels, w, h, (x, y) => (h - 1 - y) * w + (w - 1 - x))
  if (degrees === 270) return remap(pixels, h, w, (x, y) => x * w + (w - 1 - y))
  return pixels
}

export function flip(pixels: Pixels, direction: 'horizontal' | 'vertical') {
  const { width: w, height: h } = pixels
  return direction === 'horizontal'
    ? remap(pixels, w, h, (x, y) => y * w + (w - 1 - x))
    : remap(pixels, w, h, (x, y) => (h - 1 - y) * w + x)
}

/** Turns stored pixels upright according to an EXIF orientation tag. */
export function applyOrientation(pixels: Pixels, orientation: number) {
  switch (orientation) {
    case 2:
      return flip(pixels, 'horizontal')
    case 3:
      return rotate(pixels, 180)
    case 4:
      return flip(pixels, 'vertical')
    case 5:
      return flip(rotate(pixels, 90), 'horizontal')
    case 6:
      return rotate(pixels, 90)
    case 7:
      return flip(rotate(pixels, 270), 'horizontal')
    case 8:
      return rotate(pixels, 270)
    default:
      return pixels
  }
}

export function hasTransparency(pixels: Pixels) {
  for (let index = 3; index < pixels.data.length; index += 4) {
    if (pixels.data[index] < 255) return true
  }
  return false
}

/** Width and height as a viewer shows them, after the orientation tag. */
export function displaySize(meta: { width?: number; height?: number; orientation?: number }) {
  const width = meta.width ?? 0
  const height = meta.height ?? 0
  return (meta.orientation ?? 1) >= 5 ? { width: height, height: width } : { width, height }
}
