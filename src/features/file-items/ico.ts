/**
 * ICO files with PNG images inside, which every current browser and Windows since Vista read.
 * Layout: a 6-byte header, a 16-byte directory entry per image, then the PNG files.
 */

export interface IcoImage {
  width: number
  height: number
  png: Uint8Array
}

const HEADER = 6
const ENTRY = 16

export function packIco(images: IcoImage[]) {
  const total =
    HEADER + ENTRY * images.length + images.reduce((sum, image) => sum + image.png.length, 0)
  const bytes = new Uint8Array(total)
  const view = new DataView(bytes.buffer)
  view.setUint16(2, 1, true)
  view.setUint16(4, images.length, true)
  let offset = HEADER + ENTRY * images.length
  for (const [index, image] of images.entries()) {
    const at = HEADER + index * ENTRY
    // A size of 256 is written as 0.
    bytes[at] = image.width >= 256 ? 0 : image.width
    bytes[at + 1] = image.height >= 256 ? 0 : image.height
    view.setUint16(at + 4, 1, true)
    view.setUint16(at + 6, 32, true)
    view.setUint32(at + 8, image.png.length, true)
    view.setUint32(at + 12, offset, true)
    bytes.set(image.png, offset)
    offset += image.png.length
  }
  return bytes
}
