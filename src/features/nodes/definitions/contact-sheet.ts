import { z } from 'zod'

import { itemType } from '#/features/engine/item-types'
import { stemOf } from '#/features/file-items/file-item'
import { lumaOf, type Rgba, rgbaOf } from '#/features/images/colour'
import { canvas, drawOver } from '#/features/images/compose'
import {
  asImage,
  codecsOf,
  DEFAULT_ENCODE,
  encodeImage,
  uprightPixelsOf,
} from '#/features/images/image-item'
import { crop } from '#/features/images/pixel-ops'
import { renderText } from '#/features/images/text'
import type { Codecs, ImageItem, Pixels } from '#/features/images/types'
import {
  ALL_IMAGE_TYPES,
  MAX_SHEET_EDGE,
  MAX_SHEET_PIXELS,
  OUTPUT_PORT,
} from '#/features/nodes/constants'
import { defineNode } from '#/features/nodes/define-node'
import { colour } from '#/features/nodes/validators'

const schema = z.object({
  columns: z.number().int().min(1).max(20).default(4),
  /** The side of each square cell, in pixels. */
  cell: z.number().int().min(16).max(1024).default(320),
  gap: z.number().int().min(0).max(200).default(8),
  /** Images fit inside their cell, or fill it and lose their edges. */
  fit: z.enum(['contain', 'cover']).default('contain'),
  background: colour('#ffffff'),
  /** Writes each file name under its image. */
  labels: z.boolean().default(false),
  /** Rows per sheet before a new sheet starts. 0 fits as many as the size limits allow. */
  rows: z.number().int().min(0).max(1000).default(0),
  format: z.enum(['jpeg', 'png', 'webp']).default('jpeg'),
  name: z.string().max(120).default('contact-sheet'),
})

type ContactSheetSettings = z.infer<typeof schema>

function layout(settings: ContactSheetSettings) {
  const fontSize = Math.max(9, Math.round(settings.cell * 0.08))
  const labelHeight = settings.labels ? Math.round(fontSize * 1.5) : 0
  const width = settings.columns * (settings.cell + settings.gap) + settings.gap
  const rowHeight = settings.cell + labelHeight + settings.gap
  const fitting = Math.max(
    1,
    Math.min(
      Math.floor((MAX_SHEET_EDGE - settings.gap) / rowHeight),
      Math.floor(MAX_SHEET_PIXELS / (width * rowHeight)),
    ),
  )
  const rows = settings.rows > 0 ? Math.min(settings.rows, fitting) : fitting
  return { fontSize, labelHeight, width, rowHeight, perSheet: rows * settings.columns }
}

/** The image scaled to fit inside, or to fill, a square cell. */
async function fitCell(pixels: Pixels, cell: number, fit: 'contain' | 'cover', codecs: Codecs) {
  const scale =
    fit === 'contain'
      ? Math.min(cell / pixels.width, cell / pixels.height)
      : Math.max(cell / pixels.width, cell / pixels.height)
  const width = Math.max(1, Math.round(pixels.width * scale))
  const height = Math.max(1, Math.round(pixels.height * scale))
  const scaled =
    width === pixels.width && height === pixels.height
      ? pixels
      : await codecs.resize(pixels, width, height, 'lanczos3')
  if (fit === 'contain') return scaled
  const side = Math.min(cell, width, height)
  return crop(scaled, Math.floor((width - side) / 2), Math.floor((height - side) / 2), side, side)
}

/** The file name, shortened with an ellipsis until it fits the cell. */
function label(name: string, cell: number, fontSize: number, colour: Rgba) {
  const text = name.slice(name.lastIndexOf('/') + 1)
  const options = { size: fontSize, colour, family: 'sans-serif' as const, bold: false }
  let rendered = renderText(text, options)
  for (let keep = text.length - 1; rendered.width > cell && keep > 0; keep -= 1) {
    rendered = renderText(`${text.slice(0, keep)}…`, options)
  }
  return rendered
}

export const contactSheetNode = defineNode({
  type: 'contact-sheet',
  label: 'Contact sheet',
  category: 'output',
  description: 'Combines many images into one grid image.',
  mode: 'all',
  privateSettings: ['name'],
  schema,
  ports: () => OUTPUT_PORT,
  accepts: () => ALL_IMAGE_TYPES,
  produces: (settings) => new Set([itemType('image', settings.format)]),
  async run(input, settings, context) {
    if (input.mode !== 'all') throw new Error('Contact sheet waits for every item.')
    const codecs = codecsOf(context)
    const plan = layout(settings)
    const background = rgbaOf(settings.background)
    const ink: Rgba =
      lumaOf(background[0], background[1], background[2]) < 128
        ? [255, 255, 255, 255]
        : [51, 51, 51, 255]
    const sheets = Math.max(1, Math.ceil(input.count / plan.perSheet))
    const base = stemOf(settings.name.trim() || 'contact-sheet')
    const outputs: { port: string; item: ImageItem }[] = []
    let sheet: Pixels | undefined
    let placed = 0
    let bytesIn = 0

    const finish = async () => {
      if (!sheet) return
      const number = outputs.length + 1
      const name = `${base}${sheets > 1 ? `-${number}` : ''}.${settings.format}`
      const item: ImageItem = {
        meta: {
          kind: 'image',
          format: settings.format,
          name,
          width: sheet.width,
          height: sheet.height,
          source: { size: bytesIn, format: settings.format },
        },
        payload: { pixels: sheet, metadata: {}, metadataChanged: false },
      }
      outputs.push({
        port: 'out',
        item: await encodeImage(item, DEFAULT_ENCODE[settings.format], codecs),
      })
      sheet = undefined
    }

    for await (const entry of input.items) {
      const item = asImage(entry)
      const slot = placed % plan.perSheet
      if (slot === 0) {
        await finish()
        const left = input.count - placed
        const rows = Math.ceil(Math.min(left, plan.perSheet) / settings.columns)
        sheet = canvas(plan.width, rows * plan.rowHeight + settings.gap, background)
      }
      const x = settings.gap + (slot % settings.columns) * (settings.cell + settings.gap)
      const y = settings.gap + Math.floor(slot / settings.columns) * plan.rowHeight
      const pixels = await fitCell(
        await uprightPixelsOf(item, codecs),
        settings.cell,
        settings.fit,
        codecs,
      )
      const target = sheet as Pixels
      drawOver(
        target,
        pixels,
        x + Math.floor((settings.cell - pixels.width) / 2),
        y + Math.floor((settings.cell - pixels.height) / 2),
      )
      if (settings.labels) {
        const text = label(item.meta.name, settings.cell, plan.fontSize, ink)
        drawOver(
          target,
          text,
          x + Math.floor((settings.cell - text.width) / 2),
          y + settings.cell + Math.floor((plan.labelHeight - text.height) / 2),
        )
      }
      bytesIn += item.meta.size ?? 0
      placed += 1
    }
    await finish()
    return outputs
  },
})
