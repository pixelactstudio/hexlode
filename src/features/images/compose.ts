/**
 * Building images from parts: blank canvases, placing one image over another, and replacing
 * transparency. Plain TypeScript on RGBA pixels, so it runs the same in every worker.
 */
import type { Rgba } from '#/features/images/colour'
import type { Pixels } from '#/features/images/types'

export function canvas(width: number, height: number, colour: Rgba = [0, 0, 0, 0]): Pixels {
  const data = new Uint8ClampedArray(width * height * 4)
  const [red, green, blue, alpha] = colour
  if (red || green || blue || alpha) {
    const packed = new Uint32Array(data.buffer)
    data.set([red, green, blue, alpha])
    packed.fill(packed[0])
  }
  return { data, width, height }
}

/** Blends one pixel over another with source-over compositing, in place. */
function blendAt(
  target: Uint8ClampedArray,
  at: number,
  red: number,
  green: number,
  blue: number,
  alpha: number,
) {
  if (alpha <= 0) return
  if (alpha >= 255) {
    target[at] = red
    target[at + 1] = green
    target[at + 2] = blue
    target[at + 3] = 255
    return
  }
  const a = alpha / 255
  const below = target[at + 3] / 255
  const out = a + below * (1 - a)
  if (out <= 0) return
  const mix = (top: number, bottom: number) => (top * a + bottom * below * (1 - a)) / out
  target[at] = mix(red, target[at])
  target[at + 1] = mix(green, target[at + 1])
  target[at + 2] = mix(blue, target[at + 2])
  target[at + 3] = out * 255
}

/** Draws `top` over `base` at (x, y), clipped to `base`, scaling top's alpha by `opacity`. */
export function drawOver(base: Pixels, top: Pixels, x: number, y: number, opacity = 1) {
  const left = Math.max(0, x)
  const right = Math.min(base.width, x + top.width)
  const upper = Math.max(0, y)
  const lower = Math.min(base.height, y + top.height)
  for (let row = upper; row < lower; row += 1) {
    for (let column = left; column < right; column += 1) {
      const from = ((row - y) * top.width + (column - x)) * 4
      const at = (row * base.width + column) * 4
      blendAt(
        base.data,
        at,
        top.data[from],
        top.data[from + 1],
        top.data[from + 2],
        top.data[from + 3] * opacity,
      )
    }
  }
  return base
}

/** The image over a solid colour, fully opaque when the colour is. */
export function flatten(pixels: Pixels, colour: Rgba) {
  return drawOver(canvas(pixels.width, pixels.height, colour), pixels, 0, 0)
}

/**
 * Rounds the corners with radius `radius`, smoothing the arc by how much of each pixel it
 * covers. Outside the arc, pixels become `fill`, or transparent when `fill` is null.
 */
export function roundCorners(pixels: Pixels, radius: number, fill: Rgba | null): Pixels {
  const { width, height } = pixels
  const data = new Uint8ClampedArray(pixels.data)
  const r = Math.min(radius, width / 2, height / 2)
  if (r <= 0) return { data, width, height }
  const span = Math.ceil(r)
  const corners = [
    { x0: 0, y0: 0, cx: r, cy: r },
    { x0: width - span, y0: 0, cx: width - r, cy: r },
    { x0: 0, y0: height - span, cx: r, cy: height - r },
    { x0: width - span, y0: height - span, cx: width - r, cy: height - r },
  ]
  for (const { x0, y0, cx, cy } of corners) {
    for (let y = y0; y < y0 + span; y += 1) {
      for (let x = x0; x < x0 + span; x += 1) {
        const inside =
          (x + 0.5 - cx) * (x0 === 0 ? -1 : 1) <= 0 || (y + 0.5 - cy) * (y0 === 0 ? -1 : 1) <= 0
        if (inside) continue
        const distance = Math.hypot(x + 0.5 - cx, y + 0.5 - cy)
        const coverage = Math.min(1, Math.max(0, r - distance + 0.5))
        if (coverage >= 1) continue
        const at = (y * width + x) * 4
        if (!fill) {
          data[at + 3] = data[at + 3] * coverage
          continue
        }
        const red = data[at]
        const green = data[at + 1]
        const blue = data[at + 2]
        const alpha = data[at + 3]
        data.set(fill, at)
        blendAt(data, at, red, green, blue, alpha * coverage)
      }
    }
  }
  return { data, width, height }
}
