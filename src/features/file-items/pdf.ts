/**
 * A small PDF writer: one image per page, drawn into a box on the page. JPEG data is embedded
 * as it is (DCTDecode); other pixels are embedded as zlib-compressed RGB (FlateDecode).
 */

export interface PdfImage {
  width: number
  height: number
  colourSpace: 'DeviceRGB' | 'DeviceGray'
  filter: 'DCTDecode' | 'FlateDecode'
  data: Uint8Array
}

export interface PdfPage {
  /** Page size in points. */
  width: number
  height: number
  image: PdfImage
  /** Where the image is drawn, in points from the bottom-left corner. */
  box: { x: number; y: number; width: number; height: number }
}

const encoder = new TextEncoder()

/** Numbers with at most two decimals, as PDF readers expect. */
const number = (value: number) => String(Number(value.toFixed(2)))

/** Builds a PDF one page at a time. Object 1 is the catalog and object 2 the page tree. */
export function createPdfWriter() {
  const chunks: Uint8Array[] = []
  const offsets = new Map<number, number>()
  const pages: number[] = []
  let length = 0
  let next = 3

  const write = (part: string | Uint8Array) => {
    const bytes = typeof part === 'string' ? encoder.encode(part) : part
    chunks.push(bytes)
    length += bytes.length
  }
  const object = (id: number, body: string, stream?: Uint8Array) => {
    offsets.set(id, length)
    write(`${id} 0 obj\n${body}\n`)
    if (stream) {
      write('stream\n')
      write(stream)
      write('\nendstream\n')
    }
    write('endobj\n')
  }

  // The header, then a comment of high bytes so tools treat the file as binary.
  write('%PDF-1.4\n')
  write(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]))

  return {
    addPage(page: PdfPage) {
      const [pageId, contentId, imageId] = [next, next + 1, next + 2]
      next += 3
      const { image, box } = page
      object(
        imageId,
        `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /${image.colourSpace} /BitsPerComponent 8 /Filter /${image.filter} /Length ${image.data.length} >>`,
        image.data,
      )
      const content = encoder.encode(
        `q ${number(box.width)} 0 0 ${number(box.height)} ${number(box.x)} ${number(box.y)} cm /Im0 Do Q`,
      )
      object(contentId, `<< /Length ${content.length} >>`, content)
      object(
        pageId,
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${number(page.width)} ${number(page.height)}] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`,
      )
      pages.push(pageId)
    },
    finish() {
      const infoId = next
      object(
        2,
        `<< /Type /Pages /Kids [${pages.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`,
      )
      object(1, '<< /Type /Catalog /Pages 2 0 R >>')
      object(infoId, '<< /Producer (Hexlode) >>')
      const xref = length
      const size = infoId + 1
      const rows = ['xref', `0 ${size}`, '0000000000 65535 f ']
      for (let id = 1; id < size; id += 1) {
        rows.push(`${String(offsets.get(id) ?? 0).padStart(10, '0')} 00000 n `)
      }
      write(`${rows.join('\n')}\n`)
      write(
        `trailer\n<< /Size ${size} /Root 1 0 R /Info ${infoId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`,
      )
      const bytes = new Uint8Array(length)
      let at = 0
      for (const chunk of chunks) {
        bytes.set(chunk, at)
        at += chunk.length
      }
      return bytes
    },
  }
}

/** zlib-compressed bytes, the format FlateDecode reads. */
export async function deflate(bytes: Uint8Array) {
  const stream = new Blob([bytes.slice()]).stream().pipeThrough(new CompressionStream('deflate'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** The colour components of a baseline or progressive JPEG: 1 grey, 3 colour, 4 CMYK. */
export function jpegComponents(bytes: Uint8Array) {
  let at = 2
  while (at + 9 < bytes.length) {
    if (bytes[at] !== 0xff) return undefined
    const marker = bytes[at + 1]
    const size = (bytes[at + 2] << 8) | bytes[at + 3]
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) return bytes[at + 9]
    if (marker === 0xda || size < 2) return undefined
    at += 2 + size
  }
  return undefined
}
