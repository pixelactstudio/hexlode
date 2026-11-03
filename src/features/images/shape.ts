/**
 * Changes to an image's outline: trimming borders, cutting tiles and scaling pixel art.
 */
import type { Pixels } from '#/features/images/types'

export interface Area {
  x: number
  y: number
  width: number
  height: number
}

/**
 * The smallest area holding everything that differs from the top-left pixel by more than
 * `tolerance` (0 to 100). When that pixel is fully transparent, every pixel at most that
 * transparent counts as border. Returns null when the whole image is border.
 */
export function trimBounds(pixels: Pixels, tolerance: number): Area | null {
  const { data, width, height } = pixels
  const limit = (tolerance / 100) * 255
  const reference = [data[0], data[1], data[2], data[3]]
  const transparent = reference[3] === 0
  const isBorder = (at: number) => {
    if (transparent) return data[at + 3] <= limit
    return (
      Math.abs(data[at] - reference[0]) <= limit &&
      Math.abs(data[at + 1] - reference[1]) <= limit &&
      Math.abs(data[at + 2] - reference[2]) <= limit &&
      Math.abs(data[at + 3] - reference[3]) <= limit
    )
  }
  const rowIsBorder = (y: number) => {
    for (let x = 0; x < width; x += 1) if (!isBorder((y * width + x) * 4)) return false
    return true
  }
  const columnIsBorder = (x: number, top: number, bottom: number) => {
    for (let y = top; y <= bottom; y += 1) if (!isBorder((y * width + x) * 4)) return false
    return true
  }
  let top = 0
  while (top < height && rowIsBorder(top)) top += 1
  if (top === height) return null
  let bottom = height - 1
  while (bottom > top && rowIsBorder(bottom)) bottom -= 1
  let left = 0
  while (left < width && columnIsBorder(left, top, bottom)) left += 1
  let right = width - 1
  while (right > left && columnIsBorder(right, top, bottom)) right -= 1
  return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 }
}

/** Grows an area by `padding` on every side, within the image. */
export function padArea(area: Area, padding: number, width: number, height: number): Area {
  const x = Math.max(0, area.x - padding)
  const y = Math.max(0, area.y - padding)
  return {
    x,
    y,
    width: Math.min(width, area.x + area.width + padding) - x,
    height: Math.min(height, area.y + area.height + padding) - y,
  }
}

function words(pixels: Pixels) {
  return new Uint32Array(pixels.data.buffer, pixels.data.byteOffset, pixels.width * pixels.height)
}

/** Each pixel becomes a `scale` by `scale` block. */
function scaleNearest(pixels: Pixels, scale: number): Pixels {
  const width = pixels.width * scale
  const height = pixels.height * scale
  const data = new Uint8ClampedArray(width * height * 4)
  const source = words(pixels)
  const target = new Uint32Array(data.buffer)
  for (let y = 0; y < height; y += 1) {
    const from = Math.floor(y / scale) * pixels.width
    for (let x = 0; x < width; x += 1) target[y * width + x] = source[from + Math.floor(x / scale)]
  }
  return { data, width, height }
}

/**
 * Scale2x and Scale3x (Andrea Mazzoleni): enlarge like nearest neighbour, but where two
 * neighbouring pixels of one colour meet on a diagonal, continue that colour into the corner.
 * Output pixels are always source colours, so edges stay sharp.
 */
function scaleSmooth(pixels: Pixels, scale: 2 | 3): Pixels {
  const { width, height } = pixels
  const source = words(pixels)
  const outWidth = width * scale
  const data = new Uint8ClampedArray(outWidth * height * scale * 4)
  const target = new Uint32Array(data.buffer)
  const at = (x: number, y: number) =>
    source[Math.min(height - 1, Math.max(0, y)) * width + Math.min(width - 1, Math.max(0, x))]
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const a = at(x - 1, y - 1)
      const b = at(x, y - 1)
      const c = at(x + 1, y - 1)
      const d = at(x - 1, y)
      const e = at(x, y)
      const f = at(x + 1, y)
      const g = at(x - 1, y + 1)
      const h = at(x, y + 1)
      const i = at(x + 1, y + 1)
      const set = (column: number, row: number, value: number) => {
        target[(y * scale + row) * outWidth + x * scale + column] = value
      }
      if (scale === 2) {
        set(0, 0, d === b && b !== f && d !== h ? d : e)
        set(1, 0, b === f && b !== d && f !== h ? f : e)
        set(0, 1, d === h && d !== b && h !== f ? d : e)
        set(1, 1, h === f && d !== h && b !== f ? f : e)
        continue
      }
      const db = d === b && d !== h && b !== f
      const bf = b === f && b !== d && f !== h
      const dh = d === h && d !== b && h !== f
      const hf = h === f && h !== d && f !== b
      set(0, 0, db ? d : e)
      set(1, 0, (db && e !== c) || (bf && e !== a) ? b : e)
      set(2, 0, bf ? f : e)
      set(0, 1, (db && e !== g) || (dh && e !== a) ? d : e)
      set(1, 1, e)
      set(2, 1, (bf && e !== i) || (hf && e !== c) ? f : e)
      set(0, 2, dh ? d : e)
      set(1, 2, (dh && e !== i) || (hf && e !== g) ? h : e)
      set(2, 2, hf ? f : e)
    }
  }
  return { data, width: outWidth, height: height * scale }
}

export function scalePixelArt(pixels: Pixels, scale: 2 | 3 | 4, method: 'nearest' | 'smooth') {
  if (method === 'nearest') return scaleNearest(pixels, scale)
  if (scale === 4) return scaleSmooth(scaleSmooth(pixels, 2), 2)
  return scaleSmooth(pixels, scale)
}
