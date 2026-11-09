/**
 * HEIF metadata, for AVIF and HEIC files. EXIF and XMP live in items of the `meta` box, stored in
 * the file or in the box's `idat`, in one or more extents. We can read EXIF and XMP items and
 * remove or shrink them in place, but not add new ones.
 *
 * The colour profile is a property of the primary image, next to its codec settings. It is read
 * so other formats keep the colours, and left in place when the file is rewritten.
 */
import { ascii, viewOf } from '#/features/images/metadata/bytes'
import type { ImageMetadata, MetadataPart } from '#/features/images/metadata/types'
import { childBoxes, itemProperties, metaChildren, primaryItemId, readSized } from '#/lib/isobmff'

interface MetadataItem {
  part: 'exif' | 'xmp'
  /** Where the item's bytes are, in order; null when they are built from other items. */
  ranges: { offset: number; length: number }[] | null
}

function metadataItems(bytes: Uint8Array): MetadataItem[] {
  const view = viewOf(bytes)
  const children = metaChildren(bytes)
  if (!children) return []
  const iinf = children.find(({ type }) => type === 'iinf')
  const iloc = children.find(({ type }) => type === 'iloc')
  const idat = children.find(({ type }) => type === 'idat')
  if (!iinf || !iloc) return []

  const types = new Map<number, 'exif' | 'xmp'>()
  const iinfVersion = bytes[iinf.start]
  const entriesStart = iinf.start + 4 + (iinfVersion === 0 ? 2 : 4)
  for (const infe of childBoxes(bytes, entriesStart, iinf.end)) {
    if (infe.type !== 'infe') continue
    const version = bytes[infe.start]
    if (version < 2) continue
    const idSize = version === 2 ? 2 : 4
    const id = readSized(view, infe.start + 4, idSize)
    const typeAt = infe.start + 4 + idSize + 2
    const itemType = ascii(bytes, typeAt, 4)
    if (itemType === 'Exif') types.set(id, 'exif')
    if (itemType === 'mime') {
      const contentStart = bytes.indexOf(0, typeAt + 4) + 1
      const contentEnd = bytes.indexOf(0, contentStart)
      if (ascii(bytes, contentStart, contentEnd - contentStart) === 'application/rdf+xml') {
        types.set(id, 'xmp')
      }
    }
  }

  const version = bytes[iloc.start]
  let at = iloc.start + 4
  const offsetSize = bytes[at] >> 4
  const lengthSize = bytes[at] & 0xf
  const baseOffsetSize = bytes[at + 1] >> 4
  const indexSize = version === 1 || version === 2 ? bytes[at + 1] & 0xf : 0
  at += 2
  const itemCount = version < 2 ? view.getUint16(at) : view.getUint32(at)
  at += version < 2 ? 2 : 4
  const items: MetadataItem[] = []
  for (let index = 0; index < itemCount; index += 1) {
    const id = version < 2 ? view.getUint16(at) : view.getUint32(at)
    at += version < 2 ? 2 : 4
    let construction = 0
    if (version === 1 || version === 2) {
      construction = view.getUint16(at) & 0xf
      at += 2
    }
    at += 2 // data reference index
    const base = readSized(view, at, baseOffsetSize)
    at += baseOffsetSize
    const extentCount = view.getUint16(at)
    at += 2
    const ranges: { offset: number; length: number }[] = []
    for (let extent = 0; extent < extentCount; extent += 1) {
      at += indexSize
      const offset = readSized(view, at, offsetSize)
      at += offsetSize
      const length = readSized(view, at, lengthSize)
      at += lengthSize
      ranges.push({ offset, length })
    }
    const part = types.get(id)
    if (!part) continue
    // Construction method 0 points into the file, 1 into idat, 2 into other items.
    const start = construction === 0 ? base : construction === 1 && idat ? idat.start + base : null
    items.push({
      part,
      ranges:
        start === null
          ? null
          : ranges.map(({ offset, length }) => ({ offset: start + offset, length })),
    })
  }
  return items
}

/** The ICC profile in the primary image's `colr` property, when it has one. */
function colourProfile(bytes: Uint8Array) {
  const children = metaChildren(bytes)
  const primary = children && primaryItemId(bytes, children)
  if (!children || primary === null) return undefined
  const colr = itemProperties(bytes, children, primary).find(
    ({ type, start }) => type === 'colr' && ['prof', 'rICC'].includes(ascii(bytes, start, 4)),
  )
  return colr && colr.end - colr.start > 4 ? bytes.slice(colr.start + 4, colr.end) : undefined
}

function bytesOf(bytes: Uint8Array, ranges: NonNullable<MetadataItem['ranges']>) {
  const data = new Uint8Array(ranges.reduce((total, { length }) => total + length, 0))
  let at = 0
  for (const { offset, length } of ranges) {
    data.set(bytes.subarray(offset, offset + length), at)
    at += length
  }
  return data
}

export function readHeifMetadata(bytes: Uint8Array): ImageMetadata {
  const metadata: ImageMetadata = {}
  for (const item of metadataItems(bytes)) {
    if (!item.ranges) continue
    const data = bytesOf(bytes, item.ranges)
    if (item.part === 'exif') {
      if (data.length < 4) continue
      const exif = data.slice(4 + viewOf(data).getUint32(0))
      // Items blanked by an earlier strip hold zeros, not a TIFF block.
      if (exif[0] === 0x49 || exif[0] === 0x4d) metadata.exif = exif
    } else {
      const xmp = new TextDecoder().decode(data).trim()
      if (xmp) metadata.xmp = xmp
    }
  }
  const icc = colourProfile(bytes)
  if (icc) metadata.icc = icc
  return metadata
}

/** Writes `data` across the item's ranges in order and fills the rest. */
function fillItem(
  output: Uint8Array,
  ranges: NonNullable<MetadataItem['ranges']>,
  data: Uint8Array,
  filler: number,
) {
  let written = 0
  for (const { offset, length } of ranges) {
    const piece = data.subarray(written, written + length)
    output.set(piece, offset)
    output.fill(filler, offset + piece.length, offset + length)
    written += piece.length
  }
}

function sameBytes(a: Uint8Array, b: Uint8Array) {
  return a.length === b.length && a.every((value, index) => value === b[index])
}

/** `name` is the format's name for messages, such as AVIF or HEIC. */
export function writeHeifMetadata(bytes: Uint8Array, metadata: ImageMetadata, name: string) {
  const output = bytes.slice()
  const items = metadataItems(output)
  if (items.some(({ ranges }) => !ranges)) {
    throw new Error(`This ${name} file stores metadata in a way Hexlode cannot edit.`)
  }
  const dropped: MetadataPart[] = []
  const own = colourProfile(bytes)
  if (metadata.icc && !(own && sameBytes(own, metadata.icc))) dropped.push('icc')
  for (const part of ['exif', 'xmp'] as const) {
    const existing = items.filter((item) => item.part === part)
    const value = metadata[part]
    const encoded = !value
      ? new Uint8Array(0)
      : part === 'exif'
        ? Uint8Array.from([0, 0, 0, 0, ...(value as Uint8Array)])
        : new TextEncoder().encode(value as string)
    const capacity = (item: MetadataItem) =>
      (item.ranges ?? []).reduce((total, { length }) => total + length, 0)
    const target = value ? existing.find((item) => capacity(item) >= encoded.length) : undefined
    if (value && !target) dropped.push(part)
    for (const item of existing) {
      fillItem(
        output,
        item.ranges ?? [],
        item === target ? encoded : new Uint8Array(0),
        part === 'xmp' ? 0x20 : 0,
      )
    }
  }
  return { bytes: output, dropped }
}
