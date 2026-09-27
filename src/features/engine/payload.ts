/**
 * Payloads are plain trees of primitives, arrays, objects, ArrayBuffers and typed arrays.
 * These helpers measure and serialise them without knowing the item kind.
 */

type TypedArrayName = 'Uint8Array' | 'Uint8ClampedArray' | 'Uint16Array' | 'Float32Array'

const TYPED_ARRAYS = {
  Uint8Array,
  Uint8ClampedArray,
  Uint16Array,
  Float32Array,
} as const

interface BufferMarker {
  $buffer: number
  type: TypedArrayName | 'ArrayBuffer'
}

function isBufferMarker(value: unknown): value is BufferMarker {
  return typeof value === 'object' && value !== null && '$buffer' in value
}

export function payloadBytes(value: unknown): number {
  if (value instanceof ArrayBuffer) return value.byteLength
  if (ArrayBuffer.isView(value)) return value.byteLength
  if (Array.isArray(value)) return value.reduce((total, entry) => total + payloadBytes(entry), 0)
  if (value && typeof value === 'object') {
    return Object.values(value).reduce((total: number, entry) => total + payloadBytes(entry), 0)
  }
  return 0
}

export interface SerialisedPayload {
  json: string
  buffers: Uint8Array[]
}

export function serialisePayload(payload: unknown): SerialisedPayload {
  const buffers: Uint8Array[] = []
  const replace = (value: unknown): unknown => {
    if (value instanceof ArrayBuffer) {
      buffers.push(new Uint8Array(value))
      return { $buffer: buffers.length - 1, type: 'ArrayBuffer' } satisfies BufferMarker
    }
    if (ArrayBuffer.isView(value)) {
      const type = value.constructor.name as TypedArrayName
      if (!(type in TYPED_ARRAYS)) throw new Error(`Cannot store ${type} in a payload.`)
      buffers.push(new Uint8Array(value.buffer, value.byteOffset, value.byteLength))
      return { $buffer: buffers.length - 1, type } satisfies BufferMarker
    }
    if (Array.isArray(value)) return value.map(replace)
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, replace(entry)]))
    }
    return value
  }
  return { json: JSON.stringify(replace(payload)), buffers }
}

export function deserialisePayload(json: string, buffers: Uint8Array[]): unknown {
  return JSON.parse(json, (_key, value) => {
    if (!isBufferMarker(value)) return value
    const bytes = buffers[value.$buffer]
    const copy = bytes.slice().buffer
    if (value.type === 'ArrayBuffer') return copy
    const Type = TYPED_ARRAYS[value.type]
    return new Type(copy, 0, copy.byteLength / Type.BYTES_PER_ELEMENT)
  })
}
