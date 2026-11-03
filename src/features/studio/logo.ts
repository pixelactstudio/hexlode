/**
 * Turns a chosen logo file into the Image watermark setting. PNG and WebP are kept as they are;
 * SVG is drawn to a PNG here, because workers cannot draw SVG.
 */
import { inspectImageHeader } from '#/features/image-input/validators'
import { MAX_LOGO_BYTES, SVG_LOGO_EDGE } from '#/features/nodes/constants'
import type { Logo } from '#/features/nodes/definitions/image-watermark'
import { bytesToBase64 } from '#/lib/base64'

export const LOGO_ACCEPT = 'image/png,image/webp,image/svg+xml,.svg'

const TOO_LARGE = `Logos must be under ${MAX_LOGO_BYTES / 1024} KB.`

function isSvg(file: File) {
  return file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')
}

async function drawSvg(file: File, edge: number) {
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    // An SVG without a size draws as a square.
    const natural = {
      width: image.naturalWidth || edge,
      height: image.naturalHeight || edge,
    }
    const scale = edge / Math.max(natural.width, natural.height)
    const width = Math.max(1, Math.round(natural.width * scale))
    const height = Math.max(1, Math.round(natural.height * scale))
    const canvas = new OffscreenCanvas(width, height)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('This browser cannot draw SVG logos.')
    context.drawImage(image, 0, 0, width, height)
    const blob = await canvas.convertToBlob({ type: 'image/png' })
    return { bytes: new Uint8Array(await blob.arrayBuffer()), width, height }
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function readLogo(file: File): Promise<Logo> {
  if (isSvg(file)) {
    let drawn = await drawSvg(file, SVG_LOGO_EDGE)
    // Detailed drawings can be large at full size; half the size is still plenty for a logo.
    if (drawn.bytes.length > MAX_LOGO_BYTES) drawn = await drawSvg(file, SVG_LOGO_EDGE / 2)
    if (drawn.bytes.length > MAX_LOGO_BYTES) throw new Error(TOO_LARGE)
    return {
      name: file.name,
      data: bytesToBase64(drawn.bytes),
      width: drawn.width,
      height: drawn.height,
    }
  }
  if (file.size > MAX_LOGO_BYTES) throw new Error(TOO_LARGE)
  const bytes = new Uint8Array(await file.arrayBuffer())
  const info = inspectImageHeader(bytes.slice().buffer, file.type, file.size)
  if (info.format !== 'png' && info.format !== 'webp') {
    throw new Error('Choose a PNG, WebP or SVG logo.')
  }
  return { name: file.name, data: bytesToBase64(bytes), width: info.width, height: info.height }
}
