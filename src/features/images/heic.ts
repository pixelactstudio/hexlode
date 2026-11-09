/**
 * HEIC and HEIF decoding with libheif and its libde265 HEVC decoder (both LGPL-3.0), compiled to
 * WebAssembly by libheif-js. The library's loader and its .wasm stay files of their own that
 * Hexlode serves itself, fetched the first time a HEIC image is decoded. Hexlode never encodes
 * HEIC (ADR 0016).
 *
 * libheif applies the image's clean aperture, rotation and mirroring, so the pixels come out as
 * the photo shows. The EXIF orientation tag is not applied again.
 */
import wasmUrl from 'libheif-js/libheif-wasm/libheif.wasm?url'

import type { Pixels } from '#/features/images/types'

type Libheif = ReturnType<typeof import('libheif-js/libheif-wasm/libheif.js').default>

interface DecodedChannel {
  /** An embind enum value, the same object as the one on `heif_channel`. */
  id: unknown
  width: number
  height: number
  stride: number
  data: Uint8Array
}

let loading: Promise<Libheif> | undefined

/** Compiles while the file downloads, unless the server sends it without the WebAssembly type. */
async function compile() {
  try {
    return await WebAssembly.compileStreaming(fetch(wasmUrl))
  } catch {
    const response = await fetch(wasmUrl)
    if (!response.ok) throw new Error(`The HEIC decoder did not download (${response.status}).`)
    return WebAssembly.compile(await response.arrayBuffer())
  }
}

/**
 * Starts libheif on a module compiled beforehand. Its loader copies the library's functions onto
 * the module as soon as it returns, so the runtime must start within that call: instantiating
 * the compiled module synchronously makes it so.
 */
async function start(): Promise<Libheif> {
  // Imported here so the library's loader stays a separate file from Hexlode's code.
  const [{ default: createLibheif }, compiled] = await Promise.all([
    import('libheif-js/libheif-wasm/libheif.js'),
    compile(),
  ])
  let failure: unknown
  const options = {
    instantiateWasm(
      imports: WebAssembly.Imports,
      done: (instance: WebAssembly.Instance, module: WebAssembly.Module) => void,
    ) {
      const instance = new WebAssembly.Instance(compiled, imports)
      done(instance, compiled)
      return instance.exports
    },
    print: () => undefined,
    printErr: () => undefined,
    onAbort: (reason: unknown) => {
      failure = reason
    },
  }
  const heif = createLibheif(options)
  if (failure !== undefined || typeof heif.heif_context_alloc !== 'function') {
    throw new Error(`The HEIC decoder did not start: ${String(failure ?? 'no library')}`)
  }
  return heif
}

function load() {
  loading ??= start().catch((reason) => {
    loading = undefined
    throw reason
  })
  return loading
}

function isError(value: unknown) {
  return !value || (typeof value === 'object' && 'code' in value && Boolean(value.code))
}

/** Undoes premultiplied alpha, for files that store their colours multiplied by it. */
function unpremultiply(data: Uint8ClampedArray) {
  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3]
    if (alpha === 0 || alpha === 255) continue
    for (let channel = index; channel < index + 3; channel += 1) {
      data[channel] = Math.round((data[channel] * 255) / alpha)
    }
  }
}

/** Decodes the primary image of a HEIC or HEIF file to upright RGBA pixels. */
export async function decodeHeic(bytes: Uint8Array): Promise<Pixels> {
  const heif = await load()
  const context = heif.heif_context_alloc()
  try {
    const read = heif.heif_context_read_from_memory(context, bytes)
    if (read.code !== heif.heif_error_code.heif_error_Ok) throw new Error(String(read.message))
    const handle = heif.heif_js_context_get_primary_image_handle(context)
    if (isError(handle)) throw new Error('The HEIC file has no primary image.')
    try {
      const image = heif.heif_js_decode_image2(
        handle,
        heif.heif_colorspace.heif_colorspace_RGB,
        heif.heif_chroma.heif_chroma_interleaved_RGBA,
      )
      if (isError(image)) throw new Error('The HEIC image could not be decoded.')
      try {
        const channel = (image.channels as DecodedChannel[]).find(
          ({ id }) => id === heif.heif_channel.heif_channel_interleaved,
        )
        if (!channel) throw new Error('The HEIC image has no colour data.')
        const { width, height, stride } = channel
        const data = new Uint8ClampedArray(width * height * 4)
        for (let row = 0; row < height; row += 1) {
          data.set(channel.data.subarray(row * stride, row * stride + width * 4), row * width * 4)
        }
        if (heif.heif_image_handle_is_premultiplied_alpha(handle)) unpremultiply(data)
        return { data, width, height }
      } finally {
        heif.heif_image_release(image.image)
      }
    } finally {
      heif.heif_image_handle_release(handle)
    }
  } finally {
    heif.heif_context_free(context)
  }
}
