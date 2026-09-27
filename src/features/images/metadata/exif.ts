/**
 * Reads and rewrites TIFF-structured EXIF blocks. Rewriting keeps IFD0, the Exif IFD and the GPS
 * IFD as they were and drops the thumbnail IFD, the maker note and the interoperability IFD,
 * whose internal offsets cannot be relocated safely.
 */
import type { ExifSummary } from '#/features/images/metadata/types'

const TYPE_SIZES: Record<number, number> = {
  1: 1,
  2: 1,
  3: 2,
  4: 4,
  5: 8,
  6: 1,
  7: 1,
  8: 2,
  9: 4,
  10: 8,
  11: 4,
  12: 8,
}

export const TAGS = {
  make: 0x010f,
  model: 0x0110,
  orientation: 0x0112,
  artist: 0x013b,
  copyright: 0x8298,
  exifIfd: 0x8769,
  gpsIfd: 0x8825,
  dateTaken: 0x9003,
  makerNote: 0x927c,
  interopIfd: 0xa005,
} as const

const POINTER_TAGS = new Set<number>([TAGS.exifIfd, TAGS.gpsIfd, TAGS.interopIfd])

export interface ExifEntry {
  tag: number
  type: number
  count: number
  /** The raw value bytes in the block's byte order. */
  value: Uint8Array
}

export interface ExifBlock {
  littleEndian: boolean
  ifd0: ExifEntry[]
  exif: ExifEntry[]
  gps: ExifEntry[]
}

function view(bytes: Uint8Array) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
}

function readIfd(bytes: Uint8Array, offset: number, littleEndian: boolean): ExifEntry[] {
  const data = view(bytes)
  if (offset <= 0 || offset + 2 > bytes.length) return []
  const count = data.getUint16(offset, littleEndian)
  const entries: ExifEntry[] = []
  for (let index = 0; index < count; index += 1) {
    const at = offset + 2 + index * 12
    if (at + 12 > bytes.length) break
    const tag = data.getUint16(at, littleEndian)
    const type = data.getUint16(at + 2, littleEndian)
    const valueCount = data.getUint32(at + 4, littleEndian)
    const size = (TYPE_SIZES[type] ?? 0) * valueCount
    if (size === 0) continue
    const start = size <= 4 ? at + 8 : data.getUint32(at + 8, littleEndian)
    if (start + size > bytes.length) continue
    entries.push({ tag, type, count: valueCount, value: bytes.slice(start, start + size) })
  }
  return entries
}

export function readExifBlock(bytes: Uint8Array): ExifBlock | null {
  if (bytes.length < 8) return null
  const order = String.fromCharCode(bytes[0], bytes[1])
  if (order !== 'II' && order !== 'MM') return null
  const littleEndian = order === 'II'
  const data = view(bytes)
  if (data.getUint16(2, littleEndian) !== 42) return null
  const ifd0 = readIfd(bytes, data.getUint32(4, littleEndian), littleEndian)
  const pointer = (tag: number) => {
    const entry = ifd0.find((candidate) => candidate.tag === tag)
    return entry ? view(entry.value).getUint32(0, littleEndian) : 0
  }
  return {
    littleEndian,
    ifd0,
    exif: readIfd(bytes, pointer(TAGS.exifIfd), littleEndian),
    gps: readIfd(bytes, pointer(TAGS.gpsIfd), littleEndian),
  }
}

export function writeExifBlock(block: ExifBlock): Uint8Array {
  const { littleEndian } = block
  const exif = block.exif.filter(
    (entry) => entry.tag !== TAGS.makerNote && !POINTER_TAGS.has(entry.tag),
  )
  const gps = block.gps
  const ifd0 = block.ifd0.filter((entry) => !POINTER_TAGS.has(entry.tag))
  const pointerEntry = (tag: number): ExifEntry => ({
    tag,
    type: 4,
    count: 1,
    value: new Uint8Array(4),
  })
  if (exif.length > 0) ifd0.push(pointerEntry(TAGS.exifIfd))
  if (gps.length > 0) ifd0.push(pointerEntry(TAGS.gpsIfd))
  ifd0.sort((a, b) => a.tag - b.tag)

  const ifds = [ifd0, exif, gps].filter((entries) => entries.length > 0)
  const extra = (entries: ExifEntry[]) =>
    entries.reduce(
      (total, entry) =>
        total + (entry.value.length > 4 ? entry.value.length + (entry.value.length % 2) : 0),
      0,
    )
  const ifdSize = (entries: ExifEntry[]) => 2 + entries.length * 12 + 4
  const total = 8 + ifds.reduce((sum, entries) => sum + ifdSize(entries) + extra(entries), 0)
  const bytes = new Uint8Array(total)
  const data = view(bytes)
  bytes.set(littleEndian ? [0x49, 0x49] : [0x4d, 0x4d])
  data.setUint16(2, 42, littleEndian)
  data.setUint32(4, 8, littleEndian)

  const offsets = new Map<ExifEntry[], number>()
  let cursor = 8
  for (const entries of ifds) {
    offsets.set(entries, cursor)
    cursor += ifdSize(entries) + extra(entries)
  }
  for (const entry of ifd0) {
    const target = entry.tag === TAGS.exifIfd ? exif : entry.tag === TAGS.gpsIfd ? gps : null
    if (target) {
      const value = new Uint8Array(4)
      new DataView(value.buffer).setUint32(0, offsets.get(target) ?? 0, littleEndian)
      entry.value = value
    }
  }
  for (const entries of ifds) {
    const start = offsets.get(entries) as number
    let dataCursor = start + ifdSize(entries)
    data.setUint16(start, entries.length, littleEndian)
    entries.forEach((entry, index) => {
      const at = start + 2 + index * 12
      data.setUint16(at, entry.tag, littleEndian)
      data.setUint16(at + 2, entry.type, littleEndian)
      data.setUint32(at + 4, entry.count, littleEndian)
      if (entry.value.length <= 4) {
        bytes.set(entry.value, at + 8)
      } else {
        data.setUint32(at + 8, dataCursor, littleEndian)
        bytes.set(entry.value, dataCursor)
        dataCursor += entry.value.length + (entry.value.length % 2)
      }
    })
    data.setUint32(start + 2 + entries.length * 12, 0, littleEndian)
  }
  return bytes
}

function text(entry: ExifEntry | undefined) {
  if (!entry || entry.type !== 2) return null
  const end = entry.value.indexOf(0)
  const value = new TextDecoder('latin1').decode(
    end === -1 ? entry.value : entry.value.subarray(0, end),
  )
  return value.trim() || null
}

function numbers(entry: ExifEntry | undefined, littleEndian: boolean) {
  if (!entry) return []
  const data = view(entry.value)
  const values: number[] = []
  for (let index = 0; index < entry.count; index += 1) {
    if (entry.type === 3) values.push(data.getUint16(index * 2, littleEndian))
    else if (entry.type === 4) values.push(data.getUint32(index * 4, littleEndian))
    else if (entry.type === 5) {
      const denominator = data.getUint32(index * 8 + 4, littleEndian)
      values.push(denominator === 0 ? 0 : data.getUint32(index * 8, littleEndian) / denominator)
    }
  }
  return values
}

function coordinate(block: ExifBlock, valueTag: number, refTag: number, negative: string) {
  const find = (tag: number) => block.gps.find((entry) => entry.tag === tag)
  const [degrees, minutes = 0, seconds = 0] = numbers(find(valueTag), block.littleEndian)
  if (degrees === undefined) return null
  const value = degrees + minutes / 60 + seconds / 3600
  return text(find(refTag)) === negative ? -value : value
}

export function parseExif(bytes: Uint8Array | undefined): ExifSummary {
  const block = bytes ? readExifBlock(bytes) : null
  const find = (entries: ExifEntry[] | undefined, tag: number) =>
    entries?.find((entry) => entry.tag === tag)
  const latitude = block ? coordinate(block, 2, 1, 'S') : null
  const longitude = block ? coordinate(block, 4, 3, 'W') : null
  return {
    orientation: block
      ? (numbers(find(block.ifd0, TAGS.orientation), block.littleEndian)[0] ?? 1)
      : 1,
    make: text(find(block?.ifd0, TAGS.make)),
    model: text(find(block?.ifd0, TAGS.model)),
    artist: text(find(block?.ifd0, TAGS.artist)),
    copyright: text(find(block?.ifd0, TAGS.copyright)),
    dateTaken: text(find(block?.exif, TAGS.dateTaken)),
    hasGps: (block?.gps.length ?? 0) > 0,
    location: latitude !== null && longitude !== null ? { latitude, longitude } : null,
  }
}

/** Returns a copy with the orientation tag set. Adds the tag when it is missing. */
export function setExifOrientation(bytes: Uint8Array, orientation: number) {
  const block = readExifBlock(bytes)
  if (!block) return bytes
  const value = new Uint8Array(2)
  new DataView(value.buffer).setUint16(0, orientation, block.littleEndian)
  const entry: ExifEntry = { tag: TAGS.orientation, type: 3, count: 1, value }
  const ifd0 = [...block.ifd0.filter((candidate) => candidate.tag !== TAGS.orientation), entry]
  return writeExifBlock({ ...block, ifd0 })
}
