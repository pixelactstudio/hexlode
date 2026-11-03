/**
 * BlurHash encoding, following the specification at https://blurha.sh: the image as a few
 * cosine components, quantised and written in base 83.
 */
import type { Pixels } from '#/features/images/types'

const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~'

function base83(value: number, length: number) {
  let result = ''
  for (let place = length - 1; place >= 0; place -= 1) {
    result += DIGITS[Math.floor(value / 83 ** place) % 83]
  }
  return result
}

const toLinear = (value: number) => {
  const v = value / 255
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}

const toStored = (value: number) => {
  const v = Math.max(0, Math.min(1, value))
  return Math.round((v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055) * 255)
}

const signedPower = (value: number, exponent: number) =>
  Math.sign(value) * Math.abs(value) ** exponent

/** Encodes opaque pixels with `across` by `down` components, each 1 to 9. */
export function encodeBlurhash(pixels: Pixels, across: number, down: number) {
  const { data, width, height } = pixels
  const linear = new Float32Array(width * height * 3)
  for (let index = 0; index < width * height; index += 1) {
    for (let channel = 0; channel < 3; channel += 1) {
      linear[index * 3 + channel] = toLinear(data[index * 4 + channel])
    }
  }
  const factors: number[][] = []
  for (let j = 0; j < down; j += 1) {
    for (let i = 0; i < across; i += 1) {
      const sum = [0, 0, 0]
      for (let y = 0; y < height; y += 1) {
        const vertical = Math.cos((Math.PI * j * y) / height)
        for (let x = 0; x < width; x += 1) {
          const basis = Math.cos((Math.PI * i * x) / width) * vertical
          const at = (y * width + x) * 3
          sum[0] += basis * linear[at]
          sum[1] += basis * linear[at + 1]
          sum[2] += basis * linear[at + 2]
        }
      }
      const scale = (i === 0 && j === 0 ? 1 : 2) / (width * height)
      factors.push(sum.map((value) => value * scale))
    }
  }
  const [dc, ...ac] = factors
  let hash = base83(across - 1 + (down - 1) * 9, 1)
  let maximum = 1
  if (ac.length > 0) {
    const largest = Math.max(...ac.flat().map(Math.abs))
    const quantised = Math.max(0, Math.min(82, Math.floor(largest * 166 - 0.5)))
    maximum = (quantised + 1) / 166
    hash += base83(quantised, 1)
  } else {
    hash += base83(0, 1)
  }
  hash += base83((toStored(dc[0]) << 16) + (toStored(dc[1]) << 8) + toStored(dc[2]), 4)
  for (const factor of ac) {
    const [red, green, blue] = factor.map((value) =>
      Math.max(0, Math.min(18, Math.floor(signedPower(value / maximum, 0.5) * 9 + 9.5))),
    )
    hash += base83(red * 19 * 19 + green * 19 + blue, 2)
  }
  return hash
}
