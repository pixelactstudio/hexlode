import {
  ascii,
  asciiBytes,
  concatBytes,
  crc32,
  deflate,
  inflate,
  u32be,
  viewOf,
} from '#/features/images/metadata/bytes'
import type { ImageMetadata } from '#/features/images/metadata/types'

const XMP_KEYWORD = 'XML:com.adobe.xmp'
const METADATA_CHUNKS = new Set(['eXIf', 'iCCP', 'iTXt', 'tEXt', 'zTXt', 'tIME', 'sRGB'])

interface Chunk {
  type: string
  start: number
  end: number
  data: Uint8Array
}

function chunks(bytes: Uint8Array) {
  const view = viewOf(bytes)
  const found: Chunk[] = []
  let offset = 8
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset)
    const type = ascii(bytes, offset + 4, 4)
    const end = offset + 12 + length
    found.push({ type, start: offset, end, data: bytes.subarray(offset + 8, offset + 8 + length) })
    offset = end
    if (type === 'IEND') break
  }
  return found
}

function chunk(type: string, data: Uint8Array) {
  const typeBytes = asciiBytes(type)
  return concatBytes([
    u32be(data.length),
    typeBytes,
    data,
    u32be(crc32(concatBytes([typeBytes, data]))),
  ])
}

export async function readPngMetadata(bytes: Uint8Array): Promise<ImageMetadata> {
  const metadata: ImageMetadata = {}
  for (const { type, data } of chunks(bytes)) {
    if (type === 'eXIf') metadata.exif = data.slice()
    if (type === 'iCCP') {
      const nameEnd = data.indexOf(0)
      metadata.icc = await inflate(data.subarray(nameEnd + 2))
    }
    if (type === 'iTXt') {
      const keywordEnd = data.indexOf(0)
      if (ascii(data, 0, keywordEnd) !== XMP_KEYWORD) continue
      const compressed = data[keywordEnd + 1] === 1
      let at = keywordEnd + 3
      at = data.indexOf(0, at) + 1 // language tag
      at = data.indexOf(0, at) + 1 // translated keyword
      const text = compressed ? await inflate(data.subarray(at)) : data.subarray(at)
      metadata.xmp = new TextDecoder().decode(text)
    }
  }
  return metadata
}

/** Replaces metadata chunks. Text chunks and timestamps are removed; they can hold anything. */
export async function writePngMetadata(bytes: Uint8Array, metadata: ImageMetadata) {
  const all = chunks(bytes)
  const [header, ...rest] = all
  const inserted: Uint8Array[] = []
  if (metadata.icc) {
    inserted.push(
      chunk(
        'iCCP',
        concatBytes([
          asciiBytes('ICC profile'),
          Uint8Array.from([0, 0]),
          await deflate(metadata.icc),
        ]),
      ),
    )
  }
  if (metadata.exif) inserted.push(chunk('eXIf', metadata.exif))
  if (metadata.xmp) {
    inserted.push(
      chunk(
        'iTXt',
        concatBytes([
          asciiBytes(XMP_KEYWORD),
          Uint8Array.from([0, 0, 0, 0, 0]),
          new TextEncoder().encode(metadata.xmp),
        ]),
      ),
    )
  }
  const keep = rest.filter(({ type }) => {
    if (type === 'sRGB') return !metadata.icc
    return !METADATA_CHUNKS.has(type)
  })
  return {
    bytes: concatBytes([
      bytes.subarray(0, header.end),
      ...inserted,
      ...keep.map(({ start, end }) => bytes.subarray(start, end)),
    ]),
    dropped: [],
  }
}
