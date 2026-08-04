import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { ImageValidationError, inspectImageHeader } from '#/features/image-input/validators'

function pngHeader(width: number, height: number) {
  const bytes = new Uint8Array(33)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const view = new DataView(bytes.buffer)
  view.setUint32(8, 13)
  bytes.set([0x49, 0x48, 0x44, 0x52], 12)
  view.setUint32(16, width)
  view.setUint32(20, height)
  return bytes.buffer
}

function jpegHeader(width: number, height: number) {
  return Uint8Array.from([
    0xff,
    0xd8,
    0xff,
    0xc0,
    0x00,
    0x11,
    0x08,
    height >> 8,
    height & 0xff,
    width >> 8,
    width & 0xff,
    0x03,
    0x01,
    0x11,
    0x00,
    0x02,
    0x11,
    0x00,
    0x03,
    0x11,
    0x00,
    0xff,
    0xd9,
  ]).buffer
}

describe('inspectImageHeader', () => {
  it('reads PNG and JPEG dimensions from their signatures', () => {
    assert.deepEqual(inspectImageHeader(pngHeader(1200, 800), 'image/png'), {
      format: 'png',
      mimeType: 'image/png',
      width: 1200,
      height: 800,
      estimatedDecodeBytes: 3_840_000,
    })
    assert.equal(inspectImageHeader(jpegHeader(3000, 2000), 'image/jpeg').width, 3000)
  })

  it('rejects a declared MIME type that disagrees with the signature', () => {
    assert.throws(
      () => inspectImageHeader(pngHeader(100, 100), 'image/jpeg'),
      (error) => error instanceof ImageValidationError && error.code === 'mime_mismatch',
    )
  })

  it('rejects truncated PNG headers', () => {
    const truncatedHeader = pngHeader(100, 100).slice(0, 24)
    assert.throws(
      () => inspectImageHeader(truncatedHeader, 'image/png'),
      (error) => error instanceof ImageValidationError && error.code === 'unsupported_format',
    )
  })

  it('rejects malformed and unsafe dimensions before decode', () => {
    assert.throws(
      () => inspectImageHeader(new ArrayBuffer(24)),
      (error) => error instanceof ImageValidationError && error.code === 'unsupported_format',
    )
    assert.throws(
      () => inspectImageHeader(pngHeader(16_384, 16_384), 'image/png'),
      (error) => error instanceof ImageValidationError && error.code === 'invalid_dimensions',
    )
  })
})
