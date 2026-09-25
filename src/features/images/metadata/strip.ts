import { readExifBlock, TAGS, writeExifBlock } from '#/features/images/metadata/exif'
import type { ImageMetadata, StripMode } from '#/features/images/metadata/types'

export interface StripOptions {
  mode: StripMode
  /** The profile describes the pixels' colours; removing it can change how they look. */
  keepColourProfile: boolean
}

const XMP_LOCATION_NAME =
  /(?:exif:GPS\w*|photoshop:(?:City|State|Country)|Iptc4xmpCore:(?:Location|CountryCode)|Iptc4xmpExt:Location\w*)/
    .source

function stripXmpLocation(xmp: string) {
  const attributes = new RegExp(`\\s${XMP_LOCATION_NAME}="[^"]*"`, 'g')
  const elements = new RegExp(`<(${XMP_LOCATION_NAME})\\b[^>]*?(?:/>|>[\\s\\S]*?</\\1>)`, 'g')
  const empty = new RegExp(`<(${XMP_LOCATION_NAME})\\b[^>]*/>`, 'g')
  return xmp.replace(elements, '').replace(empty, '').replace(attributes, '')
}

function copyrightOnlyXmp(xmp: string) {
  const rights = xmp.match(/<dc:rights\b[\s\S]*?<\/dc:rights>/)?.[0]
  if (!rights) return undefined
  return [
    '<x:xmpmeta xmlns:x="adobe:ns:meta/">',
    '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">',
    '<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">',
    rights,
    '</rdf:Description>',
    '</rdf:RDF>',
    '</x:xmpmeta>',
  ].join('')
}

function stripExif(exif: Uint8Array, mode: Exclude<StripMode, 'all'>) {
  const block = readExifBlock(exif)
  if (!block) return undefined
  if (mode === 'location') return writeExifBlock({ ...block, gps: [] })
  const ifd0 = block.ifd0.filter((entry) => entry.tag === TAGS.copyright)
  if (ifd0.length === 0) return undefined
  return writeExifBlock({ ...block, ifd0, exif: [], gps: [] })
}

/** Strip metadata: the only step that removes metadata from items. */
export function stripMetadata(metadata: ImageMetadata, options: StripOptions): ImageMetadata {
  const result: ImageMetadata = {}
  if (metadata.icc && options.keepColourProfile) result.icc = metadata.icc
  if (options.mode === 'all') return result
  const exif = metadata.exif ? stripExif(metadata.exif, options.mode) : undefined
  if (exif) result.exif = exif
  const xmp = metadata.xmp
    ? options.mode === 'location'
      ? stripXmpLocation(metadata.xmp)
      : copyrightOnlyXmp(metadata.xmp)
    : undefined
  if (xmp) result.xmp = xmp
  return result
}

export function isEmptyMetadata(metadata: ImageMetadata) {
  return !metadata.exif && !metadata.xmp && !metadata.icc
}
