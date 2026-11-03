import { z } from 'zod'
import type { ItemType } from '#/features/engine/types'
import { fileItem, stemOf } from '#/features/file-items/file-item'
import { createPdfWriter, deflate, jpegComponents, type PdfImage } from '#/features/file-items/pdf'
import { flatten } from '#/features/images/compose'
import { asImage, codecsOf, uprightPixelsOf } from '#/features/images/image-item'
import type { Codecs, ImageItem, Pixels } from '#/features/images/types'
import { ALL_IMAGE_TYPES, OUTPUT_PORT } from '#/features/nodes/constants'
import { defineNode } from '#/features/nodes/define-node'

const PAPER = {
  a4: { width: 595.28, height: 841.89 },
  letter: { width: 612, height: 792 },
}
/** Points per pixel when a page takes the image's size: 72 points per inch at 96 pixels. */
const POINTS_PER_PIXEL = 0.75
const POINTS_PER_MILLIMETRE = 72 / 25.4
const PDF_TYPES = new Set<ItemType>(['document:pdf'])

const schema = z.object({
  /** Paper sizes, or each page the size of its image. */
  pageSize: z.enum(['a4', 'letter', 'image']).default('a4'),
  /** Auto turns paper sideways for images wider than tall. */
  orientation: z.enum(['auto', 'portrait', 'landscape']).default('auto'),
  margin: z.number().min(0).max(50).default(10),
  /** JPEG files go in as they are. Others are encoded as JPEG, or kept exact as lossless. */
  compression: z.enum(['jpeg', 'lossless']).default('jpeg'),
  quality: z.number().int().min(1).max(100).default(85),
  name: z.string().max(120).default('images'),
})

type PdfSettings = z.infer<typeof schema>

/** The JPEG file itself, when a PDF can show it as it is: upright, grey or RGB. */
function embeddableJpeg(item: ImageItem): PdfImage | undefined {
  const { encoded } = item.payload
  if (item.meta.format !== 'jpeg' || !encoded || (item.meta.orientation ?? 1) !== 1)
    return undefined
  const components = jpegComponents(encoded)
  if (components !== 1 && components !== 3) return undefined
  return {
    width: item.meta.width ?? 0,
    height: item.meta.height ?? 0,
    colourSpace: components === 1 ? 'DeviceGray' : 'DeviceRGB',
    filter: 'DCTDecode',
    data: encoded,
  }
}

async function encodePixels(
  pixels: Pixels,
  settings: PdfSettings,
  codecs: Codecs,
): Promise<PdfImage> {
  // Pages are white, so transparency becomes white.
  const opaque = flatten(pixels, [255, 255, 255, 255])
  const image = { width: opaque.width, height: opaque.height, colourSpace: 'DeviceRGB' as const }
  if (settings.compression === 'jpeg') {
    const data = await codecs.encode(
      {
        format: 'jpeg',
        options: { quality: settings.quality, progressive: false, chromaSubsampling: '420' },
      },
      opaque,
    )
    return { ...image, filter: 'DCTDecode', data }
  }
  const rgb = new Uint8Array(opaque.width * opaque.height * 3)
  for (let index = 0, at = 0; index < rgb.length; index += 3, at += 4) {
    rgb[index] = opaque.data[at]
    rgb[index + 1] = opaque.data[at + 1]
    rgb[index + 2] = opaque.data[at + 2]
  }
  return { ...image, filter: 'FlateDecode', data: await deflate(rgb) }
}

/** The page for an image and the box the image fills, centred inside the margins. */
function layout(image: PdfImage, settings: PdfSettings) {
  const margin = settings.margin * POINTS_PER_MILLIMETRE
  if (settings.pageSize === 'image') {
    const width = image.width * POINTS_PER_PIXEL
    const height = image.height * POINTS_PER_PIXEL
    return {
      width: width + margin * 2,
      height: height + margin * 2,
      box: { x: margin, y: margin, width, height },
    }
  }
  const paper = PAPER[settings.pageSize]
  const landscape =
    settings.orientation === 'landscape' ||
    (settings.orientation === 'auto' && image.width > image.height)
  const page = landscape ? { width: paper.height, height: paper.width } : paper
  const room = { width: page.width - margin * 2, height: page.height - margin * 2 }
  const scale = Math.min(room.width / image.width, room.height / image.height)
  const width = image.width * scale
  const height = image.height * scale
  return {
    ...page,
    box: { x: (page.width - width) / 2, y: (page.height - height) / 2, width, height },
  }
}

export const imagesToPdfNode = defineNode({
  type: 'images-to-pdf',
  label: 'Images to PDF',
  category: 'output',
  description: 'Combines images into one PDF.',
  mode: 'all',
  privateSettings: ['name'],
  schema,
  ports: () => OUTPUT_PORT,
  accepts: () => ALL_IMAGE_TYPES,
  produces: () => PDF_TYPES,
  async run(input, settings, context) {
    if (input.mode !== 'all') throw new Error('Images to PDF waits for every item.')
    const codecs = codecsOf(context)
    const writer = createPdfWriter()
    let bytesIn = 0
    for await (const entry of input.items) {
      const item = asImage(entry)
      const image =
        embeddableJpeg(item) ??
        (await encodePixels(await uprightPixelsOf(item, codecs), settings, codecs))
      writer.addPage({ ...layout(image, settings), image })
      bytesIn += item.meta.size ?? 0
    }
    const name = `${stemOf(settings.name.trim() || 'images')}.pdf`
    const pdf = fileItem({ kind: 'document', format: 'pdf' }, name, writer.finish(), {
      size: bytesIn,
      format: 'pdf',
    })
    return [{ port: 'out', item: pdf }]
  },
})
