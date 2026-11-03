import { z } from 'zod'

import { union } from '#/features/engine/item-types'
import type { Item, ItemMeta, ItemType } from '#/features/engine/types'
import { fileItem, jsonItem, stemOf, textItem } from '#/features/file-items/file-item'
import { packIco } from '#/features/file-items/ico'
import { type Rgba, rgbaOf } from '#/features/images/colour'
import { canvas, drawOver } from '#/features/images/compose'
import { asImage, codecsOf, uprightPixelsOf } from '#/features/images/image-item'
import { crop } from '#/features/images/pixel-ops'
import type { Codecs, EncodeOptions, ImageItem, Pixels } from '#/features/images/types'
import { ALL_IMAGE_TYPES, JSON_TYPES, PNG_TYPES, TEXT_TYPES } from '#/features/nodes/constants'
import { ENCODE_MS_PER_MEGAPIXEL } from '#/features/nodes/cost'
import { defineNode } from '#/features/nodes/define-node'
import { colour } from '#/features/nodes/validators'

const schema = z.object({
  /** Non-square images fit inside the square, or fill it and lose their sides. */
  fit: z.enum(['contain', 'cover']).default('contain'),
  /** Space around the image in each icon, in percent of the icon size. */
  padding: z.number().min(0).max(30).default(0),
  /** Fills the Apple and maskable icons, which must be opaque. */
  background: colour('#ffffff'),
  themeColour: colour('#ffffff'),
  /** The app name in the web app manifest. The image's name when empty. */
  name: z.string().max(80).default(''),
  /** Put before each file name in the manifest and HTML, such as `/icons/`. */
  path: z.string().max(300).default('/'),
})

type FaviconSettings = z.infer<typeof schema>

const ICO_SIZES = [16, 32, 48]
/** Maskable icons keep their content inside the middle 80% circle, so pad by over a fifth. */
const MASKABLE_PADDING = 22

interface IconSpec {
  file: string
  size: number
  /** Apple and maskable icons must not be transparent. */
  opaque?: boolean
  padding?: number
}

/** The PNG icons, largest first so the first one previews best. */
const PNG_ICONS: IconSpec[] = [
  { file: 'icon-512.png', size: 512 },
  { file: 'icon-maskable-512.png', size: 512, opaque: true, padding: MASKABLE_PADDING },
  { file: 'icon-192.png', size: 192 },
  { file: 'apple-touch-icon.png', size: 180, opaque: true },
  { file: 'favicon-32x32.png', size: 32 },
  { file: 'favicon-16x16.png', size: 16 },
]

const ICO_TYPES = new Set<ItemType>(['document:ico'])

/** Oxipng's fast level: on icons it is well over twice as quick for files under 1% larger. */
const ICON_ENCODE: EncodeOptions = {
  format: 'png',
  options: { optimisationLevel: 1, interlace: false },
}

/** A square icon: the image fitted inside the padding, on transparency or a colour. */
async function drawIcon(
  source: Pixels,
  size: number,
  padding: number,
  fill: Rgba | undefined,
  fit: FaviconSettings['fit'],
  codecs: Codecs,
) {
  const box = Math.max(1, Math.round(size * (1 - (2 * padding) / 100)))
  let image = source
  if (fit === 'cover') {
    const side = Math.min(source.width, source.height)
    const x = Math.floor((source.width - side) / 2)
    image = crop(source, x, Math.floor((source.height - side) / 2), side, side)
  }
  const scale = Math.min(box / image.width, box / image.height)
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))
  const scaled =
    width === image.width && height === image.height
      ? image
      : await codecs.resize(image, width, height, 'lanczos3')
  const x = Math.floor((size - width) / 2)
  return drawOver(canvas(size, size, fill), scaled, x, Math.floor((size - height) / 2))
}

function manifest(settings: FaviconSettings, meta: ItemMeta) {
  const name = settings.name.trim() || stemOf(meta.name)
  const src = (file: string) => `${settings.path}${file}`
  return {
    name,
    short_name: name,
    icons: [
      { src: src('icon-192.png'), sizes: '192x192', type: 'image/png' },
      { src: src('icon-512.png'), sizes: '512x512', type: 'image/png' },
      {
        src: src('icon-maskable-512.png'),
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    theme_color: settings.themeColour,
    background_color: settings.background,
    display: 'standalone',
  }
}

function html(settings: FaviconSettings) {
  const href = (file: string) => `${settings.path}${file}`.replaceAll('"', '&quot;')
  return [
    `<link rel="icon" href="${href('favicon.ico')}" sizes="16x16 32x32 48x48">`,
    `<link rel="icon" type="image/png" sizes="32x32" href="${href('favicon-32x32.png')}">`,
    `<link rel="icon" type="image/png" sizes="16x16" href="${href('favicon-16x16.png')}">`,
    `<link rel="apple-touch-icon" href="${href('apple-touch-icon.png')}">`,
    `<link rel="manifest" href="${href('site.webmanifest')}">`,
    `<meta name="theme-color" content="${settings.themeColour}">`,
    '',
  ].join('\n')
}

function pngItem(
  name: string,
  size: number,
  bytes: Uint8Array,
  source: ItemMeta['source'],
): ImageItem {
  return {
    meta: {
      kind: 'image',
      format: 'png',
      name,
      size: bytes.byteLength,
      width: size,
      height: size,
      source,
    },
    payload: { encoded: bytes, metadata: {}, metadataChanged: false, encode: ICON_ENCODE },
  }
}

export const faviconNode = defineNode({
  type: 'favicon',
  label: 'Favicon / App icons',
  category: 'output',
  description: 'Makes every favicon and app icon size from one image.',
  privateSettings: ['name', 'path'],
  schema,
  ports: () => [{ id: 'out', label: 'Icons and files' }],
  accepts: () => ALL_IMAGE_TYPES,
  produces: () => union([ICO_TYPES, PNG_TYPES, JSON_TYPES, TEXT_TYPES]),
  cost: () => {
    const pngSides = PNG_ICONS.map((spec) => spec.size)
    const sides = [...pngSides, ...ICO_SIZES.filter((size) => !pngSides.includes(size))]
    const megapixels = sides.reduce((total, side) => total + (side * side) / 1e6, 0)
    return {
      ms: ENCODE_MS_PER_MEGAPIXEL.png * megapixels,
      encodes: sides.length,
      needsPixels: true,
    }
  },
  async run(input, settings, context) {
    if (input.mode !== 'each') throw new Error('Favicon / App icons runs per item.')
    const item = asImage(input.item)
    const codecs = codecsOf(context)
    const pixels = await uprightPixelsOf(item, codecs)
    const { name, source } = item.meta
    const folder = `${name.slice(0, name.lastIndexOf('/') + 1)}${stemOf(name)}/`
    const background = rgbaOf(settings.background)
    // Plain icons of the same size are identical, so the ICO reuses the PNG favicons.
    const plain = new Map<number, Promise<Uint8Array>>()
    const png = async (size: number, spec?: IconSpec) => {
      const isPlain = !spec?.opaque && spec?.padding === undefined
      const cached = isPlain ? plain.get(size) : undefined
      if (cached) return cached
      const encoded = drawIcon(
        pixels,
        size,
        spec?.padding ?? settings.padding,
        spec?.opaque ? background : undefined,
        settings.fit,
        codecs,
      ).then((icon) => codecs.encode(ICON_ENCODE, icon))
      if (isPlain) plain.set(size, encoded)
      return encoded
    }

    const icons: Item[] = []
    for (const spec of PNG_ICONS) {
      icons.push(pngItem(`${folder}${spec.file}`, spec.size, await png(spec.size, spec), source))
    }
    const icoImages = []
    for (const size of ICO_SIZES)
      icoImages.push({ width: size, height: size, png: await png(size) })
    const outputs: Item[] = [
      fileItem(
        { kind: 'document', format: 'ico' },
        `${folder}favicon.ico`,
        packIco(icoImages),
        source,
      ),
      ...icons,
    ]
    outputs.push(jsonItem(`${folder}site.webmanifest`, manifest(settings, item.meta), source))
    outputs.push(textItem('text', `${folder}favicon.html`, html(settings), source))
    return outputs.map((output) => ({ port: 'out', item: output }))
  },
})
