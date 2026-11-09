import { itemType } from '#/features/engine/item-types'
import type {
  EncodableFormat,
  ImageFormat,
  ItemKindHandler,
  ItemMeta,
  ItemType,
  ItemTypeSet,
  NodeContext,
  NodeWarning,
} from '#/features/engine/types'
import { HEADER_READ_BYTES } from '#/features/image-input/constants'
import {
  IMAGE_EXTENSIONS,
  ImageValidationError,
  inspectImageHeader,
} from '#/features/image-input/validators'
import { readMetadata, writeMetadata } from '#/features/images/metadata/containers'
import { parseExif, setExifOrientation } from '#/features/images/metadata/exif'
import { isEmptyMetadata } from '#/features/images/metadata/strip'
import type { ImageMetadata, MetadataPart } from '#/features/images/metadata/types'
import { applyOrientation, hasTransparency } from '#/features/images/pixel-ops'
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
  heic: 'HEIC',
}

/** Settings used when an image must be encoded without an encoding node, in its own format. */
export const DEFAULT_ENCODE: Record<EncodableFormat, EncodeOptions> = {
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

/**
 * The format an image is written in when it keeps its own. Hexlode decodes HEIC but does not
 * write it, so a HEIC image becomes JPEG, or PNG when its pixels show it has transparency.
 */
export function keptFormat(format: ImageFormat, pixels?: Pixels): EncodableFormat {
  if (format !== 'heic') return format
  return pixels && hasTransparency(pixels) ? 'png' : 'jpeg'
}

/** What keeping each format produces: HEIC images may come out as JPEG or PNG. */
export function keptTypes(types: ItemTypeSet): ItemTypeSet {
  const heic = itemType('image', 'heic')
  if (!types.has(heic)) return types
  const kept = new Set<ItemType>([...types].filter((type) => type !== heic))
  kept.add(itemType('image', 'jpeg'))
  kept.add(itemType('image', 'png'))
  return kept
}

/** The warning for a HEIC image written in another format. */
export function keptFormatWarning(format: EncodableFormat): NodeWarning {
  return format === 'png'
    ? {
        code: 'heic_saved_as_png',
        message: 'Hexlode does not write HEIC, so it saved a PNG instead, to keep transparency.',
      }
    : {
        code: 'heic_saved_as_jpeg',
        message: 'Hexlode does not write HEIC, so it saved a JPEG instead.',
      }
}

/** Default settings for a format, with the given quality for the formats that take one. */
export function encodeWithQuality(format: EncodableFormat, quality: number): EncodeOptions {
  const base = DEFAULT_ENCODE[format]
  if (format === 'png' || format === 'qoi') return base
  return { ...base, options: { ...base.options, quality } } as EncodeOptions
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

/** `trip/photo.jpg` with suffix `-2` becomes `trip/photo-2.jpg`. */
export function nameWithSuffix(name: string, suffix: string) {
  const slash = name.lastIndexOf('/')
  const dot = name.lastIndexOf('.')
  return dot > slash + 1 ? `${name.slice(0, dot)}${suffix}${name.slice(dot)}` : `${name}${suffix}`
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

/** The item's pixels turned upright by its orientation tag, as a viewer shows them. */
export async function uprightPixelsOf(item: ImageItem, codecs: Codecs) {
  return applyOrientation(await pixelsOf(item, codecs), item.meta.orientation ?? 1)
}

/** What an item's meta becomes once its pixels are turned upright and changed. */
export function uprightMeta(meta: ItemMeta): ItemMeta {
  const turned = (meta.orientation ?? 1) >= 5
  return {
    ...meta,
    width: turned ? meta.height : meta.width,
    height: turned ? meta.width : meta.height,
    orientation: 1,
    size: undefined,
  }
}

/** Like withPixels, for pixels already turned upright: resets the orientation tag to 1. */
export function withUprightPixels(item: ImageItem, pixels: Pixels): ImageItem {
  const result = withPixels(item, pixels, { orientation: 1 })
  const { exif } = result.payload.metadata
  if (exif && (item.meta.orientation ?? 1) !== 1) {
    result.payload.metadata = { ...result.payload.metadata, exif: setExifOrientation(exif, 1) }
  }
  return result
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

/**
 * The item as the file to save: its encoded bytes with current metadata, encoding in its own
 * format if needed. Returns the item itself when its bytes are already that file.
 */
export async function fileOf(
  item: ImageItem,
  codecs: Codecs,
  warn?: NodeContext['warn'],
): Promise<ImageItem> {
  const format = item.meta.format as ImageFormat
  const { encoded, metadata, metadataChanged } = item.payload
  if (encoded && !metadataChanged) return item
  if (encoded) {
    const written = await writeMetadata(format, encoded, metadata)
    if (written.dropped.length > 0) warn?.(dropWarning(format, written.dropped))
    return {
      meta: { ...item.meta, size: written.bytes.byteLength },
      payload: { ...item.payload, encoded: written.bytes, metadataChanged: false },
    }
  }
  const kept = keptFormat(format, await pixelsOf(item, codecs))
  if (kept !== format) warn?.(keptFormatWarning(kept))
  const settings = item.payload.encode?.format === kept ? item.payload.encode : DEFAULT_ENCODE[kept]
  const file = await encodeImage(item, settings, codecs, warn)
  // The item keeps its name and pixels; a HEIC image takes the name of the format it became.
  return {
    meta: kept === format ? { ...item.meta, size: file.meta.size } : file.meta,
    payload: { ...item.payload, encoded: file.payload.encoded, metadataChanged: false },
  }
}

/** Reads format and dimensions, reading past the first part only when the header needs it. */
function inspectHeader(bytes: Uint8Array) {
  try {
    return inspectImageHeader(bytes.slice(0, HEADER_READ_BYTES).buffer, '', bytes.length)
  } catch (reason) {
    // Some JPEGs keep large thumbnails before the frame header, as file intake allows.
    const truncated = reason instanceof ImageValidationError && bytes.length > HEADER_READ_BYTES
    if (!truncated || reason.code !== 'unsupported_format') throw reason
    return inspectImageHeader(bytes.slice().buffer, '', bytes.length)
  }
}

/** Builds an image item from a file's bytes. Throws ImageValidationError for unusable files. */
export async function loadImageItem(bytes: Uint8Array, name: string): Promise<ImageItem> {
  const info = inspectHeader(bytes)
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
