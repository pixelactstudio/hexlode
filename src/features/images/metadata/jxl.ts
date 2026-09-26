import { ascii, asciiBytes, concatBytes, u32be, viewOf } from '#/features/images/metadata/bytes'
import type { ImageMetadata, MetadataPart } from '#/features/images/metadata/types'

const SIGNATURE_BOX = Uint8Array.from([
  0, 0, 0, 0x0c, 0x4a, 0x58, 0x4c, 0x20, 0x0d, 0x0a, 0x87, 0x0a,
])

interface Box {
  type: string
  data: Uint8Array
}

function boxes(bytes: Uint8Array) {
  const view = viewOf(bytes)
  const found: Box[] = []
  let offset = 0
  while (offset + 8 <= bytes.length) {
    let size = view.getUint32(offset)
    const type = ascii(bytes, offset + 4, 4)
    let header = 8
    if (size === 1) {
      size = Number(view.getBigUint64(offset + 8))
      header = 16
    }
    if (size === 0) size = bytes.length - offset
    found.push({ type, data: bytes.subarray(offset + header, offset + size) })
    if (size < header) break
    offset += size
  }
  return found
}

function isContainer(bytes: Uint8Array) {
  return SIGNATURE_BOX.every((value, index) => bytes[index] === value)
}

export function readJxlMetadata(bytes: Uint8Array): ImageMetadata {
  if (!isContainer(bytes)) return {}
  const metadata: ImageMetadata = {}
  for (const { type, data } of boxes(bytes)) {
    if (type === 'Exif') metadata.exif = data.slice(4 + viewOf(data).getUint32(0))
    if (type === 'xml ') metadata.xmp = new TextDecoder().decode(data)
  }
  return metadata
}

function codestream(bytes: Uint8Array) {
  if (!isContainer(bytes)) return bytes
  const found = boxes(bytes)
  const whole = found.find(({ type }) => type === 'jxlc')
  if (whole) return whole.data
  return concatBytes(
    found.filter(({ type }) => type === 'jxlp').map(({ data }) => data.subarray(4)),
  )
}

function box(type: string, data: Uint8Array) {
  return concatBytes([u32be(data.length + 8), asciiBytes(type), data])
}

/** JPEG XL keeps its colour profile in the codestream, so a separate profile cannot be added. */
export function writeJxlMetadata(bytes: Uint8Array, metadata: ImageMetadata) {
  const dropped: MetadataPart[] = metadata.icc ? ['icc'] : []
  const stream = codestream(bytes)
  if (!metadata.exif && !metadata.xmp) return { bytes: stream.slice(), dropped }
  const parts = [
    SIGNATURE_BOX,
    box('ftyp', concatBytes([asciiBytes('jxl '), u32be(0), asciiBytes('jxl ')])),
  ]
  if (metadata.exif) parts.push(box('Exif', concatBytes([u32be(0), metadata.exif])))
  if (metadata.xmp) parts.push(box('xml ', new TextEncoder().encode(metadata.xmp)))
  parts.push(box('jxlc', stream))
  return { bytes: concatBytes(parts), dropped }
}
