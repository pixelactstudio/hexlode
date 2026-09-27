/**
 * jSquash codecs. Each codec's WebAssembly downloads the first time a format is used.
 */
import type { ImageFormat } from '#/features/engine/types'
import type { Codecs, EncodeOptions, Pixels } from '#/features/images/types'

function toImageData(pixels: Pixels): ImageData {
  if (typeof ImageData !== 'undefined' && pixels instanceof ImageData) return pixels
  if (typeof ImageData !== 'undefined') {
    return new ImageData(pixels.data as Uint8ClampedArray<ArrayBuffer>, pixels.width, pixels.height)
  }
  return pixels as ImageData
}

function fromImageData(image: ImageData): Pixels {
  return { data: image.data, width: image.width, height: image.height }
}

const bytes = (buffer: ArrayBuffer) => new Uint8Array(buffer)
const buffer = (data: Uint8Array) =>
  data.byteOffset === 0 && data.byteLength === data.buffer.byteLength
    ? (data.buffer as ArrayBuffer)
    : (data.slice().buffer as ArrayBuffer)

export class DecodeError extends Error {
  constructor() {
    super('This image could not be decoded. The file may be damaged or incomplete.')
    this.name = 'DecodeError'
  }
}

async function decode(format: ImageFormat, data: Uint8Array): Promise<Pixels> {
  try {
    return await decodeWith(format, data)
  } catch {
    throw new DecodeError()
  }
}

async function decodeWith(format: ImageFormat, data: Uint8Array): Promise<Pixels> {
  const input = buffer(data)
  let image: ImageData | null
  switch (format) {
    case 'jpeg':
      // `preserveOrientation: false` returns the stored pixels. Rotate / Flip applies the tag.
      image = await (await import('@jsquash/jpeg/decode')).default(input, {
        preserveOrientation: false,
      })
      break
    case 'png':
      image = await (await import('@jsquash/png/decode')).default(input)
      break
    case 'webp':
      image = await (await import('@jsquash/webp/decode')).default(input)
      break
    case 'avif':
      image = await (await import('@jsquash/avif/decode')).default(input)
      break
    case 'jxl':
      image = await (await import('@jsquash/jxl/decode')).default(input)
      break
    case 'qoi':
      image = await (await import('@jsquash/qoi/decode')).default(input)
      break
  }
  if (!image) throw new Error('The image could not be decoded.')
  return fromImageData(image)
}

async function encode(settings: EncodeOptions, pixels: Pixels): Promise<Uint8Array> {
  const image = toImageData(pixels)
  switch (settings.format) {
    case 'jpeg': {
      const { quality, progressive, chromaSubsampling } = settings.options
      const encoder = (await import('@jsquash/jpeg/encode')).default
      return bytes(
        await encoder(image, {
          quality,
          progressive,
          optimize_coding: true,
          auto_subsample: false,
          chroma_subsample: chromaSubsampling === '444' ? 1 : 2,
        }),
      )
    }
    case 'webp': {
      const { quality, lossless, effort, nearLossless, sharpYuv } = settings.options
      const encoder = (await import('@jsquash/webp/encode')).default
      return bytes(
        await encoder(image, {
          quality,
          lossless: lossless ? 1 : 0,
          method: effort,
          near_lossless: nearLossless,
          use_sharp_yuv: sharpYuv ? 1 : 0,
          exact: lossless ? 1 : 0,
        }),
      )
    }
    case 'avif': {
      const { quality, lossless, effort, chromaSubsampling, sharpYuv } = settings.options
      const encoder = (await import('@jsquash/avif/encode')).default
      return bytes(
        await encoder(image, {
          quality: lossless ? 100 : quality,
          lossless,
          speed: 10 - effort,
          subsample: lossless || chromaSubsampling === '444' ? 3 : 1,
          enableSharpYUV: sharpYuv,
        }),
      )
    }
    case 'jxl': {
      const { quality, lossless, effort, progressive } = settings.options
      const encoder = (await import('@jsquash/jxl/encode')).default
      return bytes(
        await encoder(image, { quality: lossless ? 100 : quality, lossless, effort, progressive }),
      )
    }
    case 'png': {
      const { optimisationLevel, interlace } = settings.options
      const optimise = (await import('@jsquash/oxipng/optimise')).default
      return bytes(await optimise(image, { level: optimisationLevel, interlace }))
    }
    case 'qoi': {
      const encoder = (await import('@jsquash/qoi/encode')).default
      return bytes(await encoder(image))
    }
  }
}

export const jsquashCodecs: Codecs = {
  decode,
  encode,
  async resize(pixels, width, height, method) {
    const resize = (await import('@jsquash/resize')).default
    return fromImageData(
      await resize(toImageData(pixels), { width, height, method, fitMethod: 'stretch' }),
    )
  },
  async optimisePng(data, options) {
    const optimise = (await import('@jsquash/oxipng/optimise')).default
    return bytes(
      await optimise(buffer(data), {
        level: options.optimisationLevel,
        interlace: options.interlace,
      }),
    )
  },
}
