/**
 * AVIF metadata lives in items of the `meta` box. We can read EXIF and XMP items and remove or
 * shrink them in place, but not add new ones.
 */
import { ascii, viewOf } from '#/features/images/metadata/bytes'
import type { ImageMetadata, MetadataPart } from '#/features/images/metadata/types'

interface MetadataItem {
  part: 'exif' | 'xmp'
  offset: number
  length: number
}

function childBoxes(bytes: Uint8Array, start: number, end: number) {
  const view = viewOf(bytes)
  const found: { type: string; start: number; end: number }[] = []
  let offset = start
  while (offset + 8 <= end) {
    const size = view.getUint32(offset)
    const type = ascii(bytes, offset + 4, 4)
    const boxEnd = size === 0 ? end : offset + size
    if (size !== 0 && size < 8) break
    found.push({ type, start: offset + 8, end: boxEnd })
    offset = boxEnd
  }
  return found
}

function readSized(view: DataView, at: number, size: number) {
  if (size === 0) return 0
  if (size === 4) return view.getUint32(at)
  if (size === 8) return Number(view.getBigUint64(at))
  if (size === 2) return view.getUint16(at)
  throw new Error('Unsupported AVIF field size.')
}

function metadataItems(bytes: Uint8Array): MetadataItem[] {
  const view = viewOf(bytes)
  const meta = childBoxes(bytes, 0, bytes.length).find(({ type }) => type === 'meta')
  if (!meta) return []
  const children = childBoxes(bytes, meta.start + 4, meta.end)
  const iinf = children.find(({ type }) => type === 'iinf')
  const iloc = children.find(({ type }) => type === 'iloc')
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
    for (let extent = 0; extent < extentCount; extent += 1) {
      at += indexSize
      const offset = readSized(view, at, offsetSize)
      at += offsetSize
      const length = readSized(view, at, lengthSize)
      at += lengthSize
      const part = types.get(id)
      if (!part) continue
      if (construction !== 0 || extentCount !== 1) {
        throw new Error('This AVIF file stores metadata in a way Hexlode cannot edit.')
      }
      items.push({ part, offset: base + offset, length })
    }
  }
  return items
}

export function readAvifMetadata(bytes: Uint8Array): ImageMetadata {
  const metadata: ImageMetadata = {}
  for (const item of metadataItems(bytes)) {
    const data = bytes.subarray(item.offset, item.offset + item.length)
    if (item.part === 'exif') {
      const exif = data.slice(4 + viewOf(data).getUint32(0))
      // Items blanked by an earlier strip hold zeros, not a TIFF block.
      if (exif[0] === 0x49 || exif[0] === 0x4d) metadata.exif = exif
    } else {
      const xmp = new TextDecoder().decode(data).trim()
      if (xmp) metadata.xmp = xmp
    }
  }
  return metadata
}

export function writeAvifMetadata(bytes: Uint8Array, metadata: ImageMetadata) {
  const output = bytes.slice()
  const items = metadataItems(output)
  const dropped: MetadataPart[] = []
  if (metadata.icc) dropped.push('icc')
  for (const part of ['exif', 'xmp'] as const) {
    const existing = items.filter((item) => item.part === part)
    for (const item of existing)
      output.fill(part === 'xmp' ? 0x20 : 0, item.offset, item.offset + item.length)
    const value = metadata[part]
    if (!value) continue
    const encoded =
      part === 'exif'
        ? Uint8Array.from([0, 0, 0, 0, ...(value as Uint8Array)])
        : new TextEncoder().encode(value as string)
    const target = existing.find((item) => item.length >= encoded.length)
    if (target) output.set(encoded, target.offset)
    else dropped.push(part)
  }
  return { bytes: output, dropped }
}
