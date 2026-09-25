import { asciiBytes, concatBytes, startsWithAscii } from '#/features/images/metadata/bytes'
import type { ImageMetadata, MetadataPart } from '#/features/images/metadata/types'

const EXIF_ID = 'Exif\0\0'
const XMP_ID = 'http://ns.adobe.com/xap/1.0/\0'
const ICC_ID = 'ICC_PROFILE\0'
const MAX_SEGMENT_PAYLOAD = 65533
const ICC_CHUNK = MAX_SEGMENT_PAYLOAD - ICC_ID.length - 2

interface Segment {
  marker: number
  start: number
  end: number
  payload: Uint8Array
}

function segments(bytes: Uint8Array) {
  const found: Segment[] = []
  let offset = 2
  while (offset + 4 <= bytes.length && bytes[offset] === 0xff) {
    const marker = bytes[offset + 1]
    if (marker === 0xda) break
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3]
    const end = offset + 2 + length
    found.push({ marker, start: offset, end, payload: bytes.subarray(offset + 4, end) })
    offset = end
  }
  return { found, scanStart: offset }
}

export function readJpegMetadata(bytes: Uint8Array): ImageMetadata {
  const metadata: ImageMetadata = {}
  const icc: { index: number; data: Uint8Array }[] = []
  for (const { marker, payload } of segments(bytes).found) {
    if (marker === 0xe1 && startsWithAscii(payload, EXIF_ID)) {
      metadata.exif = payload.slice(EXIF_ID.length)
    } else if (marker === 0xe1 && startsWithAscii(payload, XMP_ID)) {
      metadata.xmp = new TextDecoder().decode(payload.subarray(XMP_ID.length))
    } else if (marker === 0xe2 && startsWithAscii(payload, ICC_ID)) {
      icc.push({ index: payload[ICC_ID.length], data: payload.slice(ICC_ID.length + 2) })
    }
  }
  if (icc.length > 0) {
    metadata.icc = concatBytes(icc.sort((a, b) => a.index - b.index).map(({ data }) => data))
  }
  return metadata
}

function segment(marker: number, payload: Uint8Array) {
  const length = payload.length + 2
  return concatBytes([Uint8Array.from([0xff, marker, length >> 8, length & 0xff]), payload])
}

/**
 * Replaces the metadata segments. Keeps JFIF (APP0), Adobe (APP14) and every non-APP segment;
 * drops other APP segments and comments, which can hold names, places or captions.
 */
export function writeJpegMetadata(bytes: Uint8Array, metadata: ImageMetadata) {
  const dropped: MetadataPart[] = []
  const { found, scanStart } = segments(bytes)
  const kept = found.filter(
    ({ marker }) => marker === 0xe0 || marker === 0xee || (marker < 0xe0 && marker !== 0xfe),
  )
  const jfif = kept.filter(({ marker }) => marker === 0xe0)
  const rest = kept.filter(({ marker }) => marker !== 0xe0)
  const inserted: Uint8Array[] = []
  if (metadata.exif) {
    const payload = concatBytes([asciiBytes(EXIF_ID), metadata.exif])
    if (payload.length <= MAX_SEGMENT_PAYLOAD) inserted.push(segment(0xe1, payload))
    else dropped.push('exif')
  }
  if (metadata.xmp) {
    const payload = concatBytes([asciiBytes(XMP_ID), new TextEncoder().encode(metadata.xmp)])
    if (payload.length <= MAX_SEGMENT_PAYLOAD) inserted.push(segment(0xe1, payload))
    else dropped.push('xmp')
  }
  if (metadata.icc) {
    const count = Math.ceil(metadata.icc.length / ICC_CHUNK)
    if (count <= 255) {
      for (let index = 0; index < count; index += 1) {
        const data = metadata.icc.subarray(index * ICC_CHUNK, (index + 1) * ICC_CHUNK)
        inserted.push(
          segment(
            0xe2,
            concatBytes([asciiBytes(ICC_ID), Uint8Array.from([index + 1, count]), data]),
          ),
        )
      }
    } else dropped.push('icc')
  }
  const slice = ({ start, end }: Segment) => bytes.subarray(start, end)
  return {
    bytes: concatBytes([
      bytes.subarray(0, 2),
      ...jfif.map(slice),
      ...inserted,
      ...rest.map(slice),
      bytes.subarray(scanStart),
    ]),
    dropped,
  }
}
