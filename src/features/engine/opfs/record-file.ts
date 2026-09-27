/**
 * The file format for stored results: a magic number, a JSON header and the payload buffers.
 * Readers can load the header alone.
 */
import { deserialisePayload, serialisePayload } from '#/features/engine/payload'

const MAGIC = 0x48584331 // HXC1

export interface StoredBlob {
  json: string
  /** Offsets relative to the start of the data section. */
  buffers: [start: number, length: number][]
}

export function encodeRecord<H>(header: H, payloads: (unknown | undefined)[]) {
  const buffers: Uint8Array[] = []
  let offset = 0
  const blobs: (StoredBlob | null)[] = payloads.map((payload) => {
    if (payload === undefined) return null
    const serialised = serialisePayload(payload)
    const ranges = serialised.buffers.map((buffer): [number, number] => {
      buffers.push(buffer)
      const range: [number, number] = [offset, buffer.byteLength]
      offset += buffer.byteLength
      return range
    })
    return { json: serialised.json, buffers: ranges }
  })
  const headerBytes = new TextEncoder().encode(JSON.stringify({ header, blobs }))
  const prefix = new Uint8Array(8)
  const view = new DataView(prefix.buffer)
  view.setUint32(0, MAGIC)
  view.setUint32(4, headerBytes.byteLength)
  return { parts: [prefix, headerBytes, ...buffers], bytes: 8 + headerBytes.byteLength + offset }
}

export interface DecodedHeader<H> {
  header: H
  blobs: (StoredBlob | null)[]
  dataStart: number
}

export async function decodeHeader<H>(
  read: (start: number, length: number) => Promise<Uint8Array | undefined>,
): Promise<DecodedHeader<H> | undefined> {
  const prefix = await read(0, 8)
  if (!prefix || prefix.byteLength < 8) return undefined
  const view = new DataView(prefix.buffer, prefix.byteOffset, 8)
  if (view.getUint32(0) !== MAGIC) return undefined
  const length = view.getUint32(4)
  const headerBytes = await read(8, length)
  if (!headerBytes || headerBytes.byteLength < length) return undefined
  const parsed = JSON.parse(new TextDecoder().decode(headerBytes)) as {
    header: H
    blobs: (StoredBlob | null)[]
  }
  return { ...parsed, dataStart: 8 + length }
}

export async function decodeBlob(
  record: DecodedHeader<unknown>,
  index: number,
  read: (start: number, length: number) => Promise<Uint8Array | undefined>,
) {
  const blob = record.blobs[index]
  if (!blob) return undefined
  if (blob.buffers.length === 0) return deserialisePayload(blob.json, [])
  const first = blob.buffers[0][0]
  const last = blob.buffers.at(-1) as [number, number]
  const data = await read(record.dataStart + first, last[0] + last[1] - first)
  if (!data) return undefined
  const buffers = blob.buffers.map(([start, length]) =>
    data.subarray(start - first, start - first + length),
  )
  return deserialisePayload(blob.json, buffers)
}
