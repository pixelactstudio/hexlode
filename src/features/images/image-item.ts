import type { ImageFormat, ItemKindHandler, ItemMeta, NodeContext } from '#/features/engine/types'
import { IMAGE_EXTENSIONS, inspectImageHeader } from '#/features/image-input/validators'
import { readMetadata, writeMetadata } from '#/features/images/metadata/containers'
import { parseExif } from '#/features/images/metadata/exif'
import { isEmptyMetadata } from '#/features/images/metadata/strip'
import type { ImageMetadata, MetadataPart } from '#/features/images/metadata/types'
import type {
  Codecs,
  EncodeOptions,
  ImageItem,
  ImagePayload,
  Pixels,
} from '#/features/images/types'

export const FORMAT_NAMES: Record<ImageFormat, string> = {
  jpeg: 'JPEG',
  png: 'PNG',
  webp: 'WebP',
  avif: 'AVIF',
  jxl: 'JPEG XL',
  qoi: 'QOI',
}

/** Settings used when an image must be encoded without an encoding node, in its own format. */
export const DEFAULT_ENCODE: Record<ImageFormat, EncodeOptions> = {
  jpeg: { format: 'jpeg', options: { quality: 90, progressive: true, chromaSubsampling: '420' } },
  webp: {
    format: 'webp',
    options: { quality: 90, lossless: false, effort: 4, nearLossless: 100, sharpYuv: false },
  },
  avif: {
    format: 'avif',
    options: { quality: 70, lossless: false, effort: 4, chromaSubsampling: '420', sharpYuv: false },
  },
  jxl: { format: 'jxl', options: { quality: 90, lossless: false, effort: 7, progressive: false } },
  png: { format: 'png', options: { optimisationLevel: 2, interlace: false } },
  qoi: { format: 'qoi', options: {} },
}

const PART_NAMES: Record<MetadataPart, string> = {
  exif: 'EXIF',
  xmp: 'XMP',
  icc: 'the colour profile',
}

export function codecsOf(context: NodeContext) {
  const codecs = context.services.codecs as Codecs | undefined
  if (!codecs) throw new Error('Image codecs are not available.')
  return codecs
}

export function asImage(item: { meta: ItemMeta; payload: unknown }) {
  return item as ImageItem
}

/** Decodes on first use and keeps the pixels on the payload for later nodes. */
export async function pixelsOf(item: ImageItem, codecs: Codecs): Promise<Pixels> {
  if (item.payload.pixels) return item.payload.pixels
  if (!item.payload.encoded) throw new Error('The image has no data.')
  const pixels = await codecs.decode(item.meta.format as ImageFormat, item.payload.encoded)
  item.payload.pixels = pixels
  return pixels
}

export function replaceExtension(name: string, format: ImageFormat) {
  const slash = name.lastIndexOf('/')
  const dot = name.lastIndexOf('.')
  const stem = dot > slash ? name.slice(0, dot) : name
  return `${stem}.${IMAGE_EXTENSIONS[format]}`
}

export function withPixels(
  item: ImageItem,
  pixels: Pixels,
  meta: Partial<ItemMeta> = {},
): ImageItem {
  return {
    meta: { ...item.meta, ...meta, width: pixels.width, height: pixels.height, size: undefined },
    payload: {
      pixels,
      metadata: item.payload.metadata,
      metadataChanged: true,
      encode: item.payload.encode,
    },
  }
}

export function withMetadata(
  item: ImageItem,
  metadata: ImageMetadata,
  meta: Partial<ItemMeta> = {},
) {
  const changed: ImageItem = {
    meta: { ...item.meta, ...meta },
    payload: { ...item.payload, metadata, metadataChanged: true },
  }
  return changed
}

export function dropWarning(format: ImageFormat, dropped: MetadataPart[]) {
  return {
    code: 'metadata_dropped',
    message: `${FORMAT_NAMES[format]} cannot keep ${dropped.map((part) => PART_NAMES[part]).join(' or ')}.`,
  }
}

/** Encodes pixels and writes the item's metadata into the new file. */
export async function encodeImage(
  item: ImageItem,
  settings: EncodeOptions,
  codecs: Codecs,
  warn?: NodeContext['warn'],
): Promise<ImageItem> {
  const pixels = await pixelsOf(item, codecs)
  let bytes = await codecs.encode(settings, pixels)
  const { metadata } = item.payload
  if (!isEmptyMetadata(metadata)) {
    const written = await writeMetadata(settings.format, bytes, metadata)
    bytes = written.bytes
    if (written.dropped.length > 0) warn?.(dropWarning(settings.format, written.dropped))
  }
  return {
    meta: {
      ...item.meta,
      format: settings.format,
      name: replaceExtension(item.meta.name, settings.format),
      size: bytes.byteLength,
      width: pixels.width,
      height: pixels.height,
    },
    payload: { encoded: bytes, metadata, metadataChanged: false, encode: settings },
  }
}

/** The bytes to save for an item: its encoded file with current metadata, encoding if needed. */
export async function fileBytesOf(
  item: ImageItem,
  codecs: Codecs,
  warn?: NodeContext['warn'],
): Promise<Uint8Array> {
  const format = item.meta.format as ImageFormat
  const { encoded, metadata, metadataChanged } = item.payload
  if (encoded && !metadataChanged) return encoded
  if (encoded) {
    const written = await writeMetadata(format, encoded, metadata)
    if (written.dropped.length > 0) warn?.(dropWarning(format, written.dropped))
    return written.bytes
  }
  const settings =
    item.payload.encode?.format === format ? item.payload.encode : DEFAULT_ENCODE[format]
  const result = await encodeImage(item, settings, codecs, warn)
  return result.payload.encoded as Uint8Array
}

/** Builds an image item from a file's bytes. Throws ImageValidationError for unusable files. */
export async function loadImageItem(bytes: Uint8Array, name: string): Promise<ImageItem> {
  const info = inspectImageHeader(
    bytes.slice(0, Math.min(bytes.length, 1024 * 1024)).buffer,
    '',
    bytes.length,
  )
  const metadata = await readMetadata(info.format, bytes)
  return {
    meta: {
      kind: 'image',
      format: info.format,
      name,
      size: bytes.byteLength,
      width: info.width,
      height: info.height,
      orientation: parseExif(metadata.exif).orientation,
      source: {
        size: bytes.byteLength,
        format: info.format,
        width: info.width,
        height: info.height,
      },
    },
    payload: { encoded: bytes, metadata, metadataChanged: false },
  }
}

export const imageKind: ItemKindHandler = {
  storable(payload) {
    const image = payload as ImagePayload
    if (!image.encoded || !image.pixels) return image
    const { pixels: _pixels, ...rest } = image
    return rest
  },
  memoryBytes(item) {
    const payload = item.payload as ImagePayload
    return (payload.encoded?.byteLength ?? 0) + (payload.pixels?.data.byteLength ?? 0)
  },
}
