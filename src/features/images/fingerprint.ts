/**
 * Fingerprints for finding duplicate images: a hash of the exact pixels, and a difference hash
 * (dHash) that stays almost the same when an image is re-encoded, resized or lightly edited.
 */
import { lumaOf } from '#/features/images/colour'
import { flatten } from '#/features/images/compose'
import type { Codecs, Pixels } from '#/features/images/types'

const WHITE = [255, 255, 255, 255] as [number, number, number, number]

/** Neighbouring levels must differ by more than this to set a bit, so noise does not flip it. */
const DHASH_DEAD_ZONE = 2

function mix(words: Uint32Array, seed: number, extra: number[]) {
  let h1 = 0xdeadbeef ^ seed
  let h2 = 0x41c6ce57 ^ seed
  const take = (value: number) => {
    h1 = Math.imul(h1 ^ value, 2654435761)
    h2 = Math.imul(h2 ^ value, 1597334677)
  }
  for (const value of extra) take(value)
  for (let index = 0; index < words.length; index += 1) take(words[index])
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

/** A 106-bit hash of the dimensions and every pixel. Equal for identical images. */
export function exactHash(pixels: Pixels) {
  const words = new Uint32Array(
    pixels.data.buffer,
    pixels.data.byteOffset,
    pixels.width * pixels.height,
  )
  const size = [pixels.width, pixels.height]
  return `${mix(words, 1, size)}${mix(words, 2, size)}`
}

/** The difference hash compares neighbours on a grid this many cells across and down. */
const DHASH_GRID = 16

/** Luminance of the image squeezed to `width` by `height` cells, on white. */
async function levels(pixels: Pixels, width: number, height: number, codecs: Codecs) {
  const small = await codecs.resize(flatten(pixels, WHITE), width, height, 'triangle')
  return (x: number, y: number) => {
    const at = (y * width + x) * 4
    return lumaOf(small.data[at], small.data[at + 1], small.data[at + 2])
  }
}

/**
 * A 512-bit difference hash: on a 16 by 16 grid, is each cell lighter than the cell to its right,
 * and than the cell below it. Resaved and resized copies differ in a few percent of the bits;
 * different photos, even of similar scenes, in well over a tenth.
 */
export async function differenceHash(pixels: Pixels, codecs: Codecs) {
  const n = DHASH_GRID
  const bits = new Uint32Array((n * n * 2) / 32)
  let bit = 0
  const set = (on: boolean) => {
    if (on) bits[bit >> 5] |= 1 << (bit & 31)
    bit += 1
  }
  const across = await levels(pixels, n + 1, n, codecs)
  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) set(across(x, y) - across(x + 1, y) > DHASH_DEAD_ZONE)
  }
  const down = await levels(pixels, n, n + 1, codecs)
  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) set(down(x, y) - down(x, y + 1) > DHASH_DEAD_ZONE)
  }
  return bits
}

function bitCount(value: number) {
  let v = value - ((value >>> 1) & 0x55555555)
  v = (v & 0x33333333) + ((v >>> 2) & 0x33333333)
  return (((v + (v >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24
}

/** The share of bits that differ between two difference hashes, from 0 to 1. */
export function hashDistance(a: Uint32Array, b: Uint32Array) {
  let differing = 0
  for (let index = 0; index < a.length; index += 1) differing += bitCount(a[index] ^ b[index])
  return differing / (a.length * 32)
}
