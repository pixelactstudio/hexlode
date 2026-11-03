/**
 * Node batch 3. Each test runs the node in a real pipeline and reads what Output delivered:
 * decoded images, parsed JSON and text, and the structure of ICO and PDF files.
 */
import { describe, expect, it } from 'vitest'

import { base64ToBytes } from '#/lib/base64'
import {
  BLUE,
  chain,
  decodeFile,
  fixtureBytes,
  near,
  noisyPixels,
  pixelAt,
  pngInput,
  RED,
  run,
  solidPixels,
} from './harness'

/** The compressed image data of a JPEG, from its start-of-scan marker on. */
function jpegScan(bytes: Uint8Array) {
  for (let index = 2; index < bytes.length - 1; index += 1) {
    if (bytes[index] === 0xff && bytes[index + 1] === 0xda) return bytes.slice(index)
  }
  throw new Error('No scan')
}

describe('Set copyright / author', () => {
  const fields = { artist: 'Grace Hopper', copyright: '© 2026 Grace Hopper' }

  it('writes author and copyright into files without metadata', async () => {
    const { files } = await run(chain(['set-copyright', fields]), ['photo.png'])
    const image = await decodeFile(files()[0].bytes)
    expect(image.exif).toMatchObject(fields)
    const before = await decodeFile(await fixtureBytes('photo.png'))
    expect(image.pixels.data).toEqual(before.pixels.data)
  })

  it('replaces the fields and keeps the rest without re-encoding', async () => {
    const { files } = await run(chain(['set-copyright', fields]), ['photo.jpg'])
    const bytes = files()[0].bytes
    const image = await decodeFile(bytes)
    expect(image.exif).toMatchObject({ ...fields, make: 'Hexlode Test', hasGps: true })
    expect(jpegScan(bytes)).toEqual(jpegScan(await fixtureBytes('photo.jpg')))
  })

  it('leaves a field alone when it is empty', async () => {
    const { files } = await run(chain(['set-copyright', { artist: '', copyright: 'CC BY 4.0' }]), [
      'photo.jpg',
    ])
    expect((await decodeFile(files()[0].bytes)).exif).toMatchObject({
      artist: 'Ada Example',
      copyright: 'CC BY 4.0',
    })
  })

  it('warns when the format cannot take new metadata', async () => {
    const { warnings } = await run(chain(['set-copyright', fields]), ['photo.qoi'])
    expect(warnings().map(({ code }) => code)).toEqual(['metadata_dropped'])
  })
})

describe('Best format', () => {
  it('keeps the smallest of several encodings', async () => {
    const noise = await pngInput('noise.png', noisyPixels(64))
    const flat = await pngInput('flat.png', solidPixels(64, 64, [40, 90, 200, 255]))
    const { files, records } = await run(
      chain(['best-format', { formats: ['jpeg', 'png'], quality: 60 }]),
      [noise, flat],
    )
    expect(files().map(({ name }) => name)).toEqual(['noise.jpg', 'flat.png'])
    const [photo, graphic] = await Promise.all(files().map(({ bytes }) => decodeFile(bytes)))
    expect(photo).toMatchObject({ format: 'jpeg', width: 64, height: 64 })
    expect(graphic).toMatchObject({ format: 'png', width: 64, height: 64 })
    const [first] = records('best-format-1')
    expect(first.fields).toMatchObject({ format: 'JPEG', jpeg: files()[0].bytes.length })
    expect(Number(first.fields.png)).toBeGreaterThan(Number(first.fields.jpeg))
  })

  it('keeps the original file when it is smaller, if asked', async () => {
    const { files } = await run(chain(['best-format', { formats: ['png'], keepOriginal: true }]), [
      'photo.webp',
    ])
    expect(files()[0].bytes).toEqual(await fixtureBytes('photo.webp'))
  })

  it('writes the metadata into the file it keeps', async () => {
    const { files } = await run(chain(['best-format', { formats: ['webp'] }]), ['photo.jpg'])
    expect((await decodeFile(files()[0].bytes)).exif.copyright).toBe('(c) 2026 Ada Example')
  })
})

const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes)

describe('Palette', () => {
  /** Three quarters red, one quarter blue. */
  const redAndBlue = () =>
    pngInput(
      'flag.png',
      solidPixels(40, 10, (x) => (x < 30 ? [255, 0, 0, 255] : [0, 0, 255, 255])),
    )

  it('extracts the main colours as JSON, largest share first', async () => {
    const { files } = await run(chain(['palette', { count: 4, format: 'json' }]), [
      await redAndBlue(),
    ])
    const [file] = files()
    expect(file.name).toBe('flag.palette.json')
    expect(JSON.parse(text(file.bytes))).toEqual({
      image: 'flag.png',
      colours: [
        { hex: '#ff0000', share: 0.75 },
        { hex: '#0000ff', share: 0.25 },
      ],
    })
  })

  it('writes CSS variables named after the image', async () => {
    const { files } = await run(chain(['palette', { count: 2, format: 'css' }]), [
      await redAndBlue(),
    ])
    const [file] = files()
    expect(file.name).toBe('flag.palette.css')
    expect(text(file.bytes)).toBe(':root {\n  --flag-1: #ff0000;\n  --flag-2: #0000ff;\n}\n')
  })

  it('ignores transparent pixels', async () => {
    const input = await pngInput(
      'mark.png',
      solidPixels(10, 10, (_x, y) => (y < 5 ? [0, 255, 0, 0] : [255, 0, 0, 255])),
    )
    const { files } = await run(chain(['palette']), [input])
    expect(JSON.parse(text(files()[0].bytes)).colours).toEqual([{ hex: '#ff0000', share: 1 }])
  })
})

/** Decodes a BlurHash to RGB pixels, written from the specification at blurha.sh. */
function decodeBlurhash(hash: string, width: number, height: number) {
  const digits =
    '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~'
  const number = (part: string) => [...part].reduce((value, c) => value * 83 + digits.indexOf(c), 0)
  const linear = (value: number) => {
    const v = value / 255
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  const stored = (value: number) => {
    const v = Math.max(0, Math.min(1, value))
    return Math.round((v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055) * 255)
  }
  const size = number(hash[0])
  const across = (size % 9) + 1
  const down = Math.floor(size / 9) + 1
  const maximum = (number(hash[1]) + 1) / 166
  const dc = number(hash.slice(2, 6))
  const factors = [[linear(dc >> 16), linear((dc >> 8) & 255), linear(dc & 255)]]
  for (let index = 1; index < across * down; index += 1) {
    const value = number(hash.slice(4 + index * 2, 6 + index * 2))
    const ac = (q: number) => Math.sign(q - 9) * ((q - 9) / 9) ** 2 * maximum
    factors.push([ac(Math.floor(value / 361)), ac(Math.floor(value / 19) % 19), ac(value % 19)])
  }
  return (x: number, y: number) => {
    const sum = [0, 0, 0]
    for (let j = 0; j < down; j += 1) {
      for (let i = 0; i < across; i += 1) {
        const basis = Math.cos((Math.PI * x * i) / width) * Math.cos((Math.PI * y * j) / height)
        for (let c = 0; c < 3; c += 1) sum[c] += factors[i + j * across][c] * basis
      }
    }
    return sum.map(stored)
  }
}

describe('Rename with data and documents', () => {
  it('renames data and documents and keeps their own extension', async () => {
    const { files } = await run(
      chain(['palette', { format: 'css' }], ['rename', { template: '{name}-colours' }]),
      ['photo.png'],
    )
    expect(files().map(({ name }) => name)).toEqual(['photo.palette-colours.css'])
    const pdf = await run(
      chain(['images-to-pdf'], ['rename', { template: 'Album {name}', replaceSpaces: true }]),
      ['photo.png'],
    )
    expect(pdf.files().map(({ name }) => name)).toEqual(['Album-images.pdf'])
  })
})

describe('Placeholder', () => {
  it('makes a tiny image as a data URI with the size and average colour', async () => {
    const { files } = await run(chain(['placeholder', { method: 'data-uri', size: 16 }]), [
      'photo.png',
    ])
    const [file] = files()
    expect(file.name).toBe('photo.placeholder.json')
    const value = JSON.parse(text(file.bytes))
    expect(value).toMatchObject({ image: 'photo.png', width: 48, height: 32, colour: '#800080' })
    const [prefix, data] = value.dataUri.split(',')
    expect(prefix).toBe('data:image/webp;base64')
    const tiny = await decodeFile(base64ToBytes(data))
    expect(tiny).toMatchObject({ format: 'webp', width: 16, height: 11 })
    expect(near(pixelAt(tiny, 2, 5), RED, 64)).toBe(true)
    expect(near(pixelAt(tiny, 13, 5), BLUE, 64)).toBe(true)
  })

  it('encodes a BlurHash that decodes to the same picture', async () => {
    const { files } = await run(
      chain(['placeholder', { method: 'blurhash', componentsX: 4, componentsY: 3 }]),
      ['photo.png'],
    )
    const { blurhash } = JSON.parse(text(files()[0].bytes))
    expect(blurhash).toHaveLength(28)
    expect(blurhash[0]).toBe('L')
    const at = decodeBlurhash(blurhash, 48, 32)
    const [leftRed, , leftBlue] = at(6, 16)
    const [rightRed, , rightBlue] = at(42, 16)
    expect(leftRed - leftBlue).toBeGreaterThan(80)
    expect(rightBlue - rightRed).toBeGreaterThan(80)
  })

  it('measures turned photos upright', async () => {
    const { files } = await run(chain(['placeholder']), ['oriented.jpg'])
    expect(JSON.parse(text(files()[0].bytes))).toMatchObject({ width: 32, height: 48 })
  })
})

describe('Responsive set', () => {
  const wide = () =>
    pngInput(
      'hero.png',
      solidPixels(2000, 1000, (x) => (x < 1000 ? [255, 0, 0, 255] : [0, 0, 255, 255])),
    )

  it('makes each width and a srcset snippet that names them', async () => {
    const { files } = await run(
      chain([
        'responsive-set',
        {
          widths: [960, 480, 4000],
          format: 'webp',
          sizes: '(min-width: 800px) 50vw, 100vw',
          path: '/img/',
        },
      ]),
      [await wide()],
    )
    expect(files().map(({ name }) => name)).toEqual([
      'hero-480w.webp',
      'hero-960w.webp',
      'hero-2000w.webp',
      'hero.html',
    ])
    const sizes = await Promise.all(
      files()
        .slice(0, 3)
        .map(async ({ bytes }) => {
          const image = await decodeFile(bytes)
          return [image.format, image.width, image.height]
        }),
    )
    expect(sizes).toEqual([
      ['webp', 480, 240],
      ['webp', 960, 480],
      ['webp', 2000, 1000],
    ])
    expect(text(files()[3].bytes)).toBe(
      [
        '<img',
        '  src="/img/hero-2000w.webp"',
        '  srcset="/img/hero-480w.webp 480w, /img/hero-960w.webp 960w, /img/hero-2000w.webp 2000w"',
        '  sizes="(min-width: 800px) 50vw, 100vw"',
        '  width="2000"',
        '  height="1000"',
        '  alt=""',
        '  loading="lazy"',
        '  decoding="async"',
        '>',
        '',
      ].join('\n'),
    )
  })

  it('keeps the source format and makes one size for small images', async () => {
    const { files } = await run(chain(['responsive-set', { format: 'original' }]), ['photo.jpg'])
    expect(files().map(({ name }) => name)).toEqual(['photo-48w.jpg', 'photo.html'])
    const image = await decodeFile(files()[0].bytes)
    expect(image).toMatchObject({ format: 'jpeg', width: 48, height: 32 })
    expect(image.exif.copyright).toBe('(c) 2026 Ada Example')
  })
})

/** The images in an ICO file, read from its directory: each entry's size and stored bytes. */
function icoEntries(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  expect([view.getUint16(0, true), view.getUint16(2, true)]).toEqual([0, 1])
  return Array.from({ length: view.getUint16(4, true) }, (_, index) => {
    const at = 6 + index * 16
    const length = view.getUint32(at + 8, true)
    const offset = view.getUint32(at + 12, true)
    return {
      width: bytes[at] || 256,
      height: bytes[at + 1] || 256,
      bitCount: view.getUint16(at + 6, true),
      data: bytes.slice(offset, offset + length),
    }
  })
}

describe('Favicon / App icons', () => {
  const favicon = (settings: Record<string, unknown> = {}) =>
    run(
      chain([
        'favicon',
        { name: 'Hexlode', background: '#ffffff', themeColour: '#112233', ...settings },
      ]),
      ['alpha.png'],
    )

  it('makes every icon size in a folder named after the image', async () => {
    const { files } = await favicon()
    expect(files().map(({ name }) => name)).toEqual([
      'alpha/favicon.ico',
      'alpha/icon-512.png',
      'alpha/icon-maskable-512.png',
      'alpha/icon-192.png',
      'alpha/apple-touch-icon.png',
      'alpha/favicon-32x32.png',
      'alpha/favicon-16x16.png',
      'alpha/site.webmanifest',
      'alpha/favicon.html',
    ])
    const sizes = await Promise.all(
      files()
        .slice(1, 7)
        .map(async ({ bytes }) => {
          const image = await decodeFile(bytes)
          return [image.format, image.width, image.height]
        }),
    )
    expect(sizes).toEqual([
      ['png', 512, 512],
      ['png', 512, 512],
      ['png', 192, 192],
      ['png', 180, 180],
      ['png', 32, 32],
      ['png', 16, 16],
    ])
  })

  it('packs 16, 32 and 48 pixel PNGs into the ICO file', async () => {
    const { files } = await favicon()
    const entries = icoEntries(files()[0].bytes)
    expect(entries.map(({ width, height, bitCount }) => [width, height, bitCount])).toEqual([
      [16, 16, 32],
      [32, 32, 32],
      [48, 48, 32],
    ])
    for (const entry of entries) {
      expect(await decodeFile(entry.data)).toMatchObject({
        format: 'png',
        width: entry.width,
        height: entry.height,
      })
    }
  })

  it('keeps transparency in icons and fills it for Apple and maskable icons', async () => {
    const { files } = await favicon()
    const byName = (name: string) =>
      files().find((file) => file.name === `alpha/${name}`)?.bytes as Uint8Array
    const icon = await decodeFile(byName('icon-192.png'))
    expect(pixelAt(icon, 96, 2)[3]).toBe(0)
    expect(near(pixelAt(icon, 40, 150), RED)).toBe(true)
    const apple = await decodeFile(byName('apple-touch-icon.png'))
    expect(pixelAt(apple, 0, 0)).toEqual([255, 255, 255, 255])
    const maskable = await decodeFile(byName('icon-maskable-512.png'))
    expect(pixelAt(maskable, 256, 40)).toEqual([255, 255, 255, 255])
  })

  it('writes a web app manifest and the HTML tags', async () => {
    const { files } = await favicon({ path: '/static/' })
    const manifest = JSON.parse(text(files()[7].bytes))
    expect(manifest).toMatchObject({
      name: 'Hexlode',
      theme_color: '#112233',
      background_color: '#ffffff',
      icons: [
        { src: '/static/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/static/icon-512.png', sizes: '512x512', type: 'image/png' },
        {
          src: '/static/icon-maskable-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    })
    const html = text(files()[8].bytes)
    expect(html).toContain('<link rel="icon" href="/static/favicon.ico" sizes="16x16 32x32 48x48">')
    expect(html).toContain('<link rel="apple-touch-icon" href="/static/apple-touch-icon.png">')
    expect(html).toContain('<link rel="manifest" href="/static/site.webmanifest">')
    expect(html).toContain('<meta name="theme-color" content="#112233">')
  })
})

describe('Contact sheet', () => {
  const GREEN = [0, 255, 0, 255]
  const BLACK = [0, 0, 0, 255]
  const squares = () =>
    Promise.all(
      [RED, GREEN, BLUE, RED, GREEN].map((colour, index) =>
        pngInput(`square-${index}.png`, solidPixels(10, 10, colour)),
      ),
    )
  const sheet = (settings: Record<string, unknown>) => ({
    columns: 2,
    cell: 20,
    gap: 4,
    background: '#000000',
    format: 'png',
    ...settings,
  })

  // Images are resampled into their cells, which can move a level by one or two.
  it('combines every image into one grid, in order', async () => {
    const { files, statuses } = await run(chain(['contact-sheet', sheet({})]), await squares())
    expect(statuses('contact-sheet-1')).toEqual(['processed'])
    const [file] = files()
    expect(file.name).toBe('contact-sheet.png')
    const image = await decodeFile(file.bytes)
    // Two columns and three rows of 20-pixel cells with 4-pixel gaps around them.
    expect(image).toMatchObject({ format: 'png', width: 52, height: 76 })
    expect(pixelAt(image, 2, 2)).toEqual(BLACK)
    expect(near(pixelAt(image, 14, 14), RED, 2)).toBe(true)
    expect(near(pixelAt(image, 38, 14), GREEN, 2)).toBe(true)
    expect(near(pixelAt(image, 14, 38), BLUE, 2)).toBe(true)
    expect(near(pixelAt(image, 38, 38), RED, 2)).toBe(true)
    expect(near(pixelAt(image, 14, 62), GREEN, 2)).toBe(true)
    expect(pixelAt(image, 38, 62)).toEqual(BLACK)
  })

  it('fits images inside their cell or fills it', async () => {
    const contained = await run(
      chain(['contact-sheet', sheet({ columns: 1, cell: 48, fit: 'contain' })]),
      ['photo.png'],
    )
    const inside = await decodeFile(contained.files()[0].bytes)
    expect(inside).toMatchObject({ width: 56, height: 56 })
    expect(pixelAt(inside, 10, 6)).toEqual(BLACK)
    expect(near(pixelAt(inside, 10, 14), RED, 2)).toBe(true)
    const covered = await run(
      chain(['contact-sheet', sheet({ columns: 1, cell: 48, fit: 'cover' })]),
      ['photo.png'],
    )
    const filled = await decodeFile(covered.files()[0].bytes)
    expect(near(pixelAt(filled, 10, 6), RED, 4)).toBe(true)
  })

  it('starts a new sheet after the chosen number of rows', async () => {
    const { files } = await run(
      chain(['contact-sheet', sheet({ rows: 1, name: 'proofs' })]),
      await squares(),
    )
    expect(files().map(({ name }) => name)).toEqual([
      'proofs-1.png',
      'proofs-2.png',
      'proofs-3.png',
    ])
    const last = await decodeFile(files()[2].bytes)
    expect(last).toMatchObject({ width: 52, height: 28 })
    expect(near(pixelAt(last, 14, 14), GREEN, 2)).toBe(true)
  })

  it('writes file names under the images when asked', async () => {
    const plain = await decodeFile(
      (
        await run(chain(['contact-sheet', sheet({ columns: 1, cell: 120 })]), ['photo.png'])
      ).files()[0].bytes,
    )
    const labelled = await decodeFile(
      (
        await run(chain(['contact-sheet', sheet({ columns: 1, cell: 120, labels: true })]), [
          'photo.png',
        ])
      ).files()[0].bytes,
    )
    expect(labelled.height).toBeGreaterThan(plain.height)
    let bright = 0
    for (let y = 124; y < labelled.height - 4; y += 1) {
      for (let x = 4; x < 124; x += 1) if (pixelAt(labelled, x, y)[0] > 128) bright += 1
    }
    expect(bright).toBeGreaterThan(10)
  })
})

/** A PDF read as text, its image streams and the checks every valid file passes. */
function readPdf(bytes: Uint8Array) {
  const source = new TextDecoder('latin1').decode(bytes)
  expect(source.startsWith('%PDF-1.')).toBe(true)
  expect(source.trimEnd().endsWith('%%EOF')).toBe(true)
  const startxref = Number(/startxref\s+(\d+)/.exec(source)?.[1])
  expect(source.slice(startxref, startxref + 4)).toBe('xref')
  const [, first, count] = /xref\s+(\d+) (\d+)/.exec(source.slice(startxref)) ?? []
  const entries = source.slice(startxref).match(/(\d{10}) (\d{5}) n/g) ?? []
  expect(entries).toHaveLength(Number(count) - 1)
  for (const [index, entry] of entries.entries()) {
    const offset = Number(entry.slice(0, 10))
    expect(source.slice(offset).startsWith(`${Number(first) + index + 1} 0 obj`)).toBe(true)
  }
  const images = [...source.matchAll(/\/Subtype \/Image([\s\S]*?)>>\s*stream\r?\n/g)].map(
    (match) => {
      const dictionary = match[1]
      const length = Number(/\/Length (\d+)/.exec(dictionary)?.[1])
      const start = (match.index ?? 0) + match[0].length
      return {
        filter: /\/Filter \/(\w+)/.exec(dictionary)?.[1],
        width: Number(/\/Width (\d+)/.exec(dictionary)?.[1]),
        height: Number(/\/Height (\d+)/.exec(dictionary)?.[1]),
        data: bytes.slice(start, start + length),
      }
    },
  )
  return {
    pages: source.match(/\/Type \/Page(?!s)/g)?.length ?? 0,
    mediaBoxes: [...source.matchAll(/\/MediaBox \[([^\]]+)\]/g)].map((match) => match[1]),
    images,
  }
}

function contains(haystack: Uint8Array, needle: Uint8Array) {
  outer: for (let start = 0; start <= haystack.length - needle.length; start += 1) {
    for (let index = 0; index < needle.length; index += 1) {
      if (haystack[start + index] !== needle[index]) continue outer
    }
    return true
  }
  return false
}

async function inflate(data: Uint8Array) {
  const stream = new Blob([data.slice()]).stream().pipeThrough(new DecompressionStream('deflate'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

describe('Images to PDF', () => {
  it('combines images into one PDF, one page each, in order', async () => {
    const { files, statuses } = await run(chain(['images-to-pdf', { name: 'album' }]), [
      'photo.jpg',
      'photo.png',
      'oriented.jpg',
    ])
    expect(statuses('images-to-pdf-1')).toEqual(['processed'])
    const [file] = files()
    expect(file.name).toBe('album.pdf')
    const pdf = readPdf(file.bytes)
    expect(pdf.pages).toBe(3)
    expect(pdf.images.map(({ width, height }) => [width, height])).toEqual([
      [48, 32],
      [48, 32],
      [32, 48],
    ])
  })

  it('embeds JPEG files as they are and encodes other formats as JPEG', async () => {
    const { files } = await run(chain(['images-to-pdf']), ['photo.jpg', 'photo.png'])
    const pdf = readPdf(files()[0].bytes)
    expect(pdf.images.map(({ filter }) => filter)).toEqual(['DCTDecode', 'DCTDecode'])
    expect(contains(files()[0].bytes, await fixtureBytes('photo.jpg'))).toBe(true)
    const encoded = await decodeFile(pdf.images[1].data)
    expect(encoded).toMatchObject({ format: 'jpeg', width: 48, height: 32 })
    expect(near(pixelAt(encoded, 4, 16), RED)).toBe(true)
  })

  it('keeps pixels exactly when asked for lossless images', async () => {
    const { files } = await run(chain(['images-to-pdf', { compression: 'lossless' }]), [
      'photo.png',
    ])
    const [image] = readPdf(files()[0].bytes).images
    expect(image.filter).toBe('FlateDecode')
    const rgb = await inflate(image.data)
    expect(rgb).toHaveLength(48 * 32 * 3)
    expect([...rgb.subarray(0, 3)]).toEqual([255, 0, 0])
    expect([...rgb.subarray(47 * 3, 48 * 3)]).toEqual([0, 0, 255])
  })

  it('sizes pages to paper, turning wide images landscape, or to the image', async () => {
    const paper = await run(chain(['images-to-pdf', { pageSize: 'a4' }]), [
      'photo.png',
      'oriented.jpg',
    ])
    expect(readPdf(paper.files()[0].bytes).mediaBoxes).toEqual([
      '0 0 841.89 595.28',
      '0 0 595.28 841.89',
    ])
    const fitted = await run(chain(['images-to-pdf', { pageSize: 'image', margin: 0 }]), [
      'photo.png',
    ])
    // 48 by 32 pixels at 96 pixels per inch is 36 by 24 points.
    expect(readPdf(fitted.files()[0].bytes).mediaBoxes).toEqual(['0 0 36 24'])
  })
})
