/**
 * Renders text to pixels with an OffscreenCanvas, which workers have. Only the glyph shapes come
 * from the canvas; placing and blending them uses our own compositing, like every other node.
 */
import type { Rgba } from '#/features/images/colour'
import type { Pixels } from '#/features/images/types'

export type FontFamily = 'sans-serif' | 'serif' | 'monospace'

export interface TextOptions {
  /** Font size in pixels. */
  size: number
  colour: Rgba
  family: FontFamily
  bold: boolean
  /** Clockwise rotation in degrees. */
  angle?: number
}

function context2d(width: number, height: number) {
  if (typeof OffscreenCanvas === 'undefined') throw new Error('Text needs canvas support.')
  const context = new OffscreenCanvas(width, height).getContext('2d')
  if (!context) throw new Error('Text needs canvas support.')
  return context
}

/** The text in its colour on a transparent background, cropped close to the glyphs. */
export function renderText(text: string, options: TextOptions): Pixels {
  const font = `${options.bold ? 'bold' : 'normal'} ${Math.max(1, options.size)}px ${options.family}`
  const measure = context2d(1, 1)
  measure.font = font
  const metrics = measure.measureText(text)
  const left = metrics.actualBoundingBoxLeft
  const right = metrics.actualBoundingBoxRight
  const ascent = metrics.actualBoundingBoxAscent
  const descent = metrics.actualBoundingBoxDescent
  const padding = Math.ceil(options.size * 0.05) + 1
  const boxWidth = Math.ceil(left + right) + padding * 2
  const boxHeight = Math.ceil(ascent + descent) + padding * 2
  const radians = ((options.angle ?? 0) * Math.PI) / 180
  const cos = Math.abs(Math.cos(radians))
  const sin = Math.abs(Math.sin(radians))
  const width = Math.max(1, Math.ceil(boxWidth * cos + boxHeight * sin))
  const height = Math.max(1, Math.ceil(boxWidth * sin + boxHeight * cos))
  const context = context2d(width, height)
  const [red, green, blue] = options.colour
  context.font = font
  context.fillStyle = `rgb(${red} ${green} ${blue})`
  context.translate(width / 2, height / 2)
  context.rotate(radians)
  context.fillText(text, (left - right) / 2, (ascent - descent) / 2)
  const image = context.getImageData(0, 0, width, height)
  return { data: image.data, width, height }
}
