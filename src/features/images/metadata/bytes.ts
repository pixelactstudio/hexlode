export function concatBytes(parts: Uint8Array[]) {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const result = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    result.set(part, offset)
    offset += part.length
  }
  return result
}

export function ascii(bytes: Uint8Array, start: number, length: number) {
  return String.fromCharCode(...bytes.subarray(start, start + length))
}

export function asciiBytes(text: string) {
  return Uint8Array.from(text, (character) => character.charCodeAt(0))
}

export function startsWithAscii(bytes: Uint8Array, text: string, offset = 0) {
  return ascii(bytes, offset, text.length) === text
}

export function u32be(value: number) {
  const bytes = new Uint8Array(4)
  new DataView(bytes.buffer).setUint32(0, value)
  return bytes
}

export function u32le(value: number) {
  const bytes = new Uint8Array(4)
  new DataView(bytes.buffer).setUint32(0, value, true)
  return bytes
}

export function viewOf(bytes: Uint8Array) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
}

async function transform(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const output = new Blob([bytes.slice()]).stream().pipeThrough(stream)
  return new Uint8Array(await new Response(output).arrayBuffer())
}

export const inflate = (bytes: Uint8Array) => transform(bytes, new DecompressionStream('deflate'))
export const deflate = (bytes: Uint8Array) => transform(bytes, new CompressionStream('deflate'))

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

export function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}
