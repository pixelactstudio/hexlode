import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

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

function fixture(name: string) {
  const bytes = readFileSync(new URL(`../../images/__tests__/fixtures/${name}`, import.meta.url))
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
}

describe('inspectImageHeader', () => {
  it.each([
    ['photo.jpg', 'jpeg', 'image/jpeg'],
    ['photo.png', 'png', 'image/png'],
    ['photo.webp', 'webp', 'image/webp'],
    ['alpha.webp', 'webp', 'image/webp'],
    ['photo.avif', 'avif', 'image/avif'],
    ['photo.jxl', 'jxl', 'image/jxl'],
    ['photo.qoi', 'qoi', ''],
  ])('reads the format and dimensions of %s', (name, format, declaredType) => {
    expect(inspectImageHeader(fixture(name), declaredType)).toMatchObject({
      format,
      width: 48,
      height: 32,
    })
  })

  it('reads a JPEG XL codestream whose width follows from an aspect ratio', () => {
    // FF 0A, then SizeHeader: div8=1, h_div8-1=3 (height 32), ratio=4 (3:2, width 48).
    const bits = [1, 1, 1, 0, 0, 0, 0, 0, 1]
    const bytes = new Uint8Array(4)
    bytes.set([0xff, 0x0a])
    bits.forEach((bit, index) => {
      bytes[2 + (index >> 3)] |= bit << (index & 7)
    })
    expect(inspectImageHeader(bytes.buffer)).toMatchObject({ width: 48, height: 32 })
  })

  it('refuses a file that is no supported image', () => {
    expect(() => inspectImageHeader(new TextEncoder().encode('%PDF-1.7 hello').buffer)).toThrow(
      'Choose a JPEG, PNG, WebP, AVIF, JPEG XL or QOI image.',
    )
  })

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
