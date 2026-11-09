/**
 * Reads the box structure of ISOBMFF files: HEIF, and the HEIC and AVIF files built on it. Boxes
 * are found by offset, so callers can read or patch their payloads in place.
 */

export interface Box {
  type: string
  /** Where the payload starts, after the size and type. */
  start: number
  end: number
}

export interface ItemProperty extends Box {
  essential: boolean
}

function ascii(bytes: Uint8Array, start: number, length: number) {
  return String.fromCharCode(...bytes.subarray(start, start + length))
}

function viewOf(bytes: Uint8Array) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
}

/** The boxes between `start` and `end`. Stops at a box that runs past `end` or is too small. */
export function childBoxes(bytes: Uint8Array, start: number, end: number): Box[] {
  const view = viewOf(bytes)
  const found: Box[] = []
  let offset = start
  while (offset + 8 <= end) {
    const size = view.getUint32(offset)
    const type = ascii(bytes, offset + 4, 4)
    if (size === 1) {
      if (offset + 16 > end) break
      const large = Number(view.getBigUint64(offset + 8))
      found.push({ type, start: offset + 16, end: Math.min(offset + large, end) })
      offset += large
      continue
    }
    const boxEnd = size === 0 ? end : offset + size
    if (size !== 0 && size < 8) break
    found.push({ type, start: offset + 8, end: Math.min(boxEnd, end) })
    offset = boxEnd
  }
  return found
}

/** An unsigned field of 0, 2, 4 or 8 bytes, as `iloc` stores offsets and lengths. */
export function readSized(view: DataView, at: number, size: number) {
  if (size === 0) return 0
  if (size === 4) return view.getUint32(at)
  if (size === 8) return Number(view.getBigUint64(at))
  if (size === 2) return view.getUint16(at)
  throw new Error('Unsupported ISOBMFF field size.')
}

/** The major and compatible brands of the `ftyp` box, or an empty list without one. */
export function brandsOf(bytes: Uint8Array) {
  if (bytes.length < 16 || ascii(bytes, 4, 4) !== 'ftyp') return []
  const size = Math.min(viewOf(bytes).getUint32(0), bytes.length)
  const brands = [ascii(bytes, 8, 4)]
  for (let at = 16; at + 4 <= size; at += 4) brands.push(ascii(bytes, at, 4))
  return brands
}

/** The children of the top-level `meta` box, which follow its version and flags. */
export function metaChildren(bytes: Uint8Array) {
  const meta = childBoxes(bytes, 0, bytes.length).find(({ type }) => type === 'meta')
  return meta ? childBoxes(bytes, meta.start + 4, meta.end) : null
}

/** The item `pitm` names as the primary image. */
export function primaryItemId(bytes: Uint8Array, children: Box[]) {
  const pitm = children.find(({ type }) => type === 'pitm')
  if (!pitm) return null
  const view = viewOf(bytes)
  return bytes[pitm.start] === 0 ? view.getUint16(pitm.start + 4) : view.getUint32(pitm.start + 4)
}

/** An item's properties from `iprp`, in the order `ipma` lists them. */
export function itemProperties(bytes: Uint8Array, children: Box[], itemId: number) {
  const iprp = children.find(({ type }) => type === 'iprp')
  if (!iprp) return []
  const boxes = childBoxes(bytes, iprp.start, iprp.end)
  const ipco = boxes.find(({ type }) => type === 'ipco')
  if (!ipco) return []
  const properties = childBoxes(bytes, ipco.start, ipco.end)
  const view = viewOf(bytes)
  const found: ItemProperty[] = []
  for (const ipma of boxes.filter(({ type }) => type === 'ipma')) {
    const version = bytes[ipma.start]
    const wideIndex = (bytes[ipma.start + 3] & 1) === 1
    let at = ipma.start + 4
    const entries = view.getUint32(at)
    at += 4
    for (let entry = 0; entry < entries && at < ipma.end; entry += 1) {
      const id = version < 1 ? view.getUint16(at) : view.getUint32(at)
      at += version < 1 ? 2 : 4
      const count = bytes[at]
      at += 1
      for (let index = 0; index < count; index += 1) {
        const value = wideIndex ? view.getUint16(at) : bytes[at]
        at += wideIndex ? 2 : 1
        if (id !== itemId) continue
        const essential = wideIndex ? value >= 0x8000 : value >= 0x80
        const property = properties[(value & (wideIndex ? 0x7fff : 0x7f)) - 1]
        if (property) found.push({ ...property, essential })
      }
    }
  }
  return found
}
