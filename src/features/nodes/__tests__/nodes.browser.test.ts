import { describe, expect, it } from 'vitest'

import { jsquashCodecs } from '#/features/images/codecs'
import {
  ALL_FORMAT_FIXTURES,
  BLUE,
  chain,
  decodeFile,
  fixtureBytes,
  near,
  noisyPixels,
  pixelAt,
  RED,
  run,
  zipEntries,
} from './harness'

/** The compressed image data of a JPEG, from its start-of-scan marker on. */
function jpegScan(bytes: Uint8Array) {
  for (let index = 2; index < bytes.length - 1; index += 1) {
    if (bytes[index] === 0xff && bytes[index + 1] === 0xda) return bytes.slice(index)
  }
  throw new Error('No scan')
}

describe('Files and Output', () => {
  it('delivers images unchanged when nothing encodes them', async () => {
    const { files } = await run(chain(), ALL_FORMAT_FIXTURES)
    const delivered = files()
    expect(delivered.map(({ name }) => name)).toEqual(ALL_FORMAT_FIXTURES)
    for (const [index, name] of ALL_FORMAT_FIXTURES.entries()) {
      expect(delivered[index].bytes).toEqual(await fixtureBytes(name))
    }
  })

  it('builds a ZIP of everything that reached it and does not download by itself', async () => {
    const { events } = await run(chain(), ['photo.jpg', 'photo.png'])
    const ready = events.find((event) => event.type === 'delivery-ready')
    if (ready?.type !== 'delivery-ready') throw new Error('No delivery')
    expect(ready.delivery.files.map(({ name }) => name)).toEqual(['photo.jpg', 'photo.png'])
    expect(await zipEntries(ready.delivery.archive as Blob)).toEqual(['photo.jpg', 'photo.png'])
  })

  it('fails a file that cannot be decoded and keeps the others', async () => {
    const { statuses, files } = await run(chain(['convert', { format: 'png' }]), [
      'photo.jpg',
      'malformed.jpg',
    ])
    expect(statuses('convert-1')).toEqual(['processed', 'failed'])
    expect(files().map(({ name }) => name)).toEqual(['photo.png'])
  })
})

describe('Convert', () => {
  it.each([
    ['jpeg', 'jpg'],
    ['png', 'png'],
    ['webp', 'webp'],
    ['avif', 'avif'],
    ['jxl', 'jxl'],
    ['qoi', 'qoi'],
  ])('encodes every input format to %s', async (format, extension) => {
    const { files } = await run(chain(['convert', { format }]), ALL_FORMAT_FIXTURES)
    const delivered = files()
    expect(delivered).toHaveLength(6)
    for (const file of delivered) {
      expect(file.name.endsWith(`.${extension}`)).toBe(true)
      const image = await decodeFile(file.bytes)
      expect(image).toMatchObject({ format, width: 48, height: 32 })
      expect(near(pixelAt(image, 4, 16), RED)).toBe(true)
      expect(near(pixelAt(image, 44, 16), BLUE)).toBe(true)
    }
  })

  it('uses the encoder settings: lower quality makes smaller files', async () => {
    const source = {
      name: 'noise.png',
      bytes: await jsquashCodecs.encode(
        { format: 'png', options: { optimisationLevel: 0, interlace: false } },
        noisyPixels(),
      ),
    }
    const low = await run(chain(['convert', { format: 'webp', webp: { quality: 20 } }]), [source])
    const high = await run(chain(['convert', { format: 'webp', webp: { quality: 95 } }]), [source])
    expect(low.files()[0].bytes.length).toBeLessThan(high.files()[0].bytes.length * 0.7)
  })

  it('writes the item metadata into formats that can hold it', async () => {
    const { files } = await run(chain(['convert', { format: 'webp' }]), ['photo.jpg'])
    const image = await decodeFile(files()[0].bytes)
    expect(image.exif).toMatchObject({ copyright: '(c) 2026 Ada Example', hasGps: true })
  })

  it('warns when the target format cannot keep metadata', async () => {
    const { warnings } = await run(chain(['convert', { format: 'qoi' }]), ['photo.jpg'])
    expect(warnings()).toEqual([{ code: 'metadata_dropped', message: 'QOI cannot keep EXIF.' }])
  })

  it('keeps the original file when asked to and encoding does not make it smaller', async () => {
    const { files } = await run(
      chain(['convert', { format: 'original', keepSmaller: true, webp: { quality: 100 } }]),
      ['photo.webp'],
    )
    expect(files()[0].bytes).toEqual(await fixtureBytes('photo.webp'))
  })

  it('keeps each item in its own format when set to Original', async () => {
    const { files } = await run(chain(['convert', { format: 'original' }]), [
      'photo.jpg',
      'photo.webp',
    ])
    expect(
      await Promise.all(files().map(async ({ bytes }) => (await decodeFile(bytes)).format)),
    ).toEqual(['jpeg', 'webp'])
  })
})

describe('Resize', () => {
  it.each([
    [{ mode: 'longestEdge', longestEdge: 24 }, 24, 16],
    [{ mode: 'percent', percent: 25 }, 12, 8],
    [{ mode: 'width', width: 12 }, 12, 8],
    [{ mode: 'height', height: 8 }, 12, 8],
    [{ mode: 'box', width: 16, height: 16, fit: 'fit' }, 16, 11],
    [{ mode: 'box', width: 16, height: 16, fit: 'fill' }, 16, 16],
    [{ mode: 'box', width: 10, height: 30, fit: 'exact' }, 10, 30],
  ])('resizes with %o to %ix%i', async (settings, width, height) => {
    const { files } = await run(chain(['resize', settings]), ['photo.png'])
    const image = await decodeFile(files()[0].bytes)
    expect(image).toMatchObject({ format: 'png', width, height })
    expect(near(pixelAt(image, 0, height - 1), RED)).toBe(true)
    expect(near(pixelAt(image, width - 1, 0), BLUE)).toBe(true)
  })

  it('does not enlarge unless asked', async () => {
    const { files } = await run(chain(['resize', { mode: 'width', width: 96 }]), ['photo.png'])
    expect((await decodeFile(files()[0].bytes)).width).toBe(48)
    const enlarged = await run(
      chain(['resize', { mode: 'width', width: 96, allowUpscale: true }]),
      ['photo.png'],
    )
    expect((await decodeFile(enlarged.files()[0].bytes)).width).toBe(96)
  })

  it('keeps the source format and metadata', async () => {
    const { files } = await run(chain(['resize', { mode: 'percent', percent: 50 }]), ['photo.jpg'])
    const image = await decodeFile(files()[0].bytes)
    expect(image).toMatchObject({ format: 'jpeg', width: 24, height: 16 })
    expect(image.exif.copyright).toBe('(c) 2026 Ada Example')
  })
})

describe('Crop', () => {
  it('crops to an aspect ratio from the centre', async () => {
    const { files } = await run(chain(['crop', { aspect: '1:1' }]), ['photo.png'])
    const image = await decodeFile(files()[0].bytes)
    expect(image).toMatchObject({ width: 32, height: 32 })
    expect(pixelAt(image, 15, 0)).toEqual(RED)
    expect(pixelAt(image, 16, 0)).toEqual(BLUE)
  })

  it('crops from a chosen position', async () => {
    const { files } = await run(chain(['crop', { aspect: '1:1', position: 'left' }]), ['photo.png'])
    const image = await decodeFile(files()[0].bytes)
    expect(pixelAt(image, 23, 0)).toEqual(RED)
    expect(pixelAt(image, 24, 0)).toEqual(BLUE)
  })

  it('crops to a custom ratio', async () => {
    const { files } = await run(
      chain(['crop', { aspect: 'custom', customWidth: 1, customHeight: 2 }]),
      ['photo.png'],
    )
    expect(await decodeFile(files()[0].bytes)).toMatchObject({ width: 16, height: 32 })
  })
})

describe('Rotate / Flip', () => {
  it('turns an image upright from its orientation tag and resets the tag', async () => {
    const { files } = await run(chain(['rotate', { auto: true }]), ['oriented.jpg'])
    const image = await decodeFile(files()[0].bytes)
    expect(image).toMatchObject({ width: 32, height: 48 })
    expect(image.exif.orientation).toBe(1)
    expect(near(pixelAt(image, 16, 4), RED)).toBe(true)
    expect(near(pixelAt(image, 16, 44), BLUE)).toBe(true)
  })

  it('rotates and flips', async () => {
    const turned = await run(chain(['rotate', { auto: false, rotate: 90 }]), ['photo.png'])
    const image = await decodeFile(turned.files()[0].bytes)
    expect(image).toMatchObject({ width: 32, height: 48 })
    expect(pixelAt(image, 0, 0)).toEqual(RED)
    expect(pixelAt(image, 0, 47)).toEqual(BLUE)
    const flipped = await run(chain(['rotate', { auto: false, flipHorizontal: true }]), [
      'photo.png',
    ])
    const mirror = await decodeFile(flipped.files()[0].bytes)
    expect(pixelAt(mirror, 0, 0)).toEqual(BLUE)
    expect(pixelAt(mirror, 47, 0)).toEqual(RED)
  })
})

describe('Strip metadata', () => {
  it('removes location data without re-encoding the image', async () => {
    const { files } = await run(chain(['strip-metadata', { mode: 'location' }]), ['photo.jpg'])
    const bytes = files()[0].bytes
    const image = await decodeFile(bytes)
    expect(image.exif).toMatchObject({ hasGps: false, copyright: '(c) 2026 Ada Example' })
    expect(jpegScan(bytes)).toEqual(jpegScan(await fixtureBytes('photo.jpg')))
  })

  it('removes all metadata from every container that has it', async () => {
    const { files } = await run(chain(['strip-metadata', { mode: 'all' }]), [
      'photo.jpg',
      'location.png',
    ])
    for (const file of files()) expect((await decodeFile(file.bytes)).metadata).toEqual({})
  })

  it('keeps only copyright', async () => {
    const { files } = await run(chain(['strip-metadata', { mode: 'copyright' }]), ['photo.jpg'])
    expect((await decodeFile(files()[0].bytes)).exif).toMatchObject({
      copyright: '(c) 2026 Ada Example',
      make: null,
      hasGps: false,
    })
  })
})

describe('Compress to size', () => {
  it('finds the highest quality that fits the target', async () => {
    const bytes = await jsquashCodecs.encode(
      { format: 'png', options: { optimisationLevel: 0, interlace: false } },
      noisyPixels(),
    )
    const { files, warnings } = await run(
      chain(['compress-to-size', { targetKilobytes: 40, format: 'jpeg' }]),
      [{ name: 'noise.png', bytes }],
    )
    const output = files()[0]
    expect(output.bytes.length).toBeLessThanOrEqual(40 * 1024)
    expect(output.bytes.length).toBeGreaterThan(30 * 1024)
    expect(await decodeFile(output.bytes)).toMatchObject({ format: 'jpeg', width: 256 })
    expect(warnings()).toEqual([])
  })

  it('warns and keeps the smallest result when the target cannot be reached', async () => {
    const bytes = await jsquashCodecs.encode(
      { format: 'png', options: { optimisationLevel: 0, interlace: false } },
      noisyPixels(),
    )
    const { files, warnings } = await run(
      chain(['compress-to-size', { targetKilobytes: 1, format: 'webp' }]),
      [{ name: 'noise.png', bytes }],
    )
    expect((await decodeFile(files()[0].bytes)).format).toBe('webp')
    expect(warnings().map(({ code }) => code)).toEqual(['target_not_reached'])
  })
})

describe('Optimize PNG', () => {
  it('makes PNG files smaller without changing pixels and skips other formats', async () => {
    const bytes = await jsquashCodecs.encode(
      { format: 'png', options: { optimisationLevel: 0, interlace: false } },
      noisyPixels(64),
    )
    const padded = new Uint8Array(bytes.length)
    padded.set(bytes)
    const { files, statuses } = await run(chain(['optimize-png', { level: 3 }]), [
      { name: 'noise.png', bytes: padded },
      'photo.jpg',
    ])
    expect(statuses('optimize-png-1')).toEqual(['processed', 'skipped'])
    const output = files().find(({ name }) => name === 'noise.png')?.bytes as Uint8Array
    expect(output.length).toBeLessThanOrEqual(bytes.length)
    const before = await decodeFile(bytes)
    const after = await decodeFile(output)
    expect(after.pixels.data).toEqual(before.pixels.data)
  })
})

describe('Rename', () => {
  it('names files from a template', async () => {
    const { files } = await run(chain(['rename', { template: '{name}-{width}w-{format}' }]), [
      'photo.jpg',
      { name: 'trip/photo.png', bytes: await fixtureBytes('photo.png') },
    ])
    expect(files().map(({ name }) => name)).toEqual([
      'photo-48w-jpeg.jpg',
      'trip/photo-48w-png.png',
    ])
  })
})

describe('Filter', () => {
  it('routes items by rules, with an output for everything else', async () => {
    const pipeline = chain()
    pipeline.nodes.splice(1, 0, {
      id: 'filter',
      type: 'filter',
      settings: {
        rules: [
          { id: 'png', field: 'format', operator: 'is', formats: ['png'] },
          { id: 'alpha', field: 'transparency', operator: 'has' },
        ],
      },
      position: { x: 0, y: 0 },
    })
    pipeline.nodes.push({ id: 'rest', type: 'output', settings: {}, position: { x: 0, y: 0 } })
    pipeline.nodes.push({ id: 'clear', type: 'output', settings: {}, position: { x: 0, y: 0 } })
    pipeline.connections = [
      { id: 'a', source: 'files-0', sourcePort: 'out', target: 'filter' },
      { id: 'b', source: 'filter', sourcePort: 'png', target: 'out' },
      { id: 'c', source: 'filter', sourcePort: 'alpha', target: 'clear' },
      { id: 'd', source: 'filter', sourcePort: 'else', target: 'rest' },
    ]
    const { files } = await run(pipeline, ['photo.png', 'alpha.webp', 'photo.jpg', 'alpha.png'])
    expect(files('out').map(({ name }) => name)).toEqual(['photo.png', 'alpha.png'])
    expect(files('clear').map(({ name }) => name)).toEqual(['alpha.webp'])
    expect(files('rest').map(({ name }) => name)).toEqual(['photo.jpg'])
  })

  it.each([
    [{ field: 'fileSize', operator: 'less', kilobytes: 0.4 }, ['photo.webp', 'photo.qoi']],
    [{ field: 'orientation', operator: 'is', orientation: 'portrait' }, ['oriented.jpg']],
    [{ field: 'width', operator: 'more', pixels: 40 }, ['photo.jpg', 'photo.webp', 'photo.qoi']],
  ])('routes by %o', async (rule, expected) => {
    const pipeline = chain(['filter', { rules: [{ id: 'match', ...rule }] }])
    pipeline.connections[1].sourcePort = 'match'
    const { files } = await run(
      pipeline,
      ['photo.jpg', 'photo.webp', 'photo.qoi', 'oriented.jpg'].filter(
        (name) => rule.field !== 'width' || name !== 'oriented.jpg',
      ),
    )
    expect(files().map(({ name }) => name)).toEqual(expected)
  })
})

describe('Inspect and Compare', () => {
  it('reports format, dimensions, size and metadata and passes items on unchanged', async () => {
    const { records, files } = await run(chain(['inspect']), ['photo.jpg'])
    expect(records('inspect-1')).toEqual([
      {
        name: 'photo.jpg',
        fields: expect.objectContaining({
          format: 'JPEG',
          width: 48,
          height: 32,
          size: 666,
          camera: 'Hexlode Test',
          copyright: '(c) 2026 Ada Example',
          location: 'Yes',
          dateTaken: '2026:01:02 03:04:05',
        }),
      },
    ])
    expect(files()[0].bytes).toEqual(await fixtureBytes('photo.jpg'))
  })

  it('reports the size difference against the source file', async () => {
    const pipeline = chain(['convert', { format: 'png' }], ['compare'])
    const { records } = await run(pipeline, ['photo.qoi'])
    const [record] = records('compare-2')
    expect(record.fields).toMatchObject({ sourceFormat: 'QOI', format: 'PNG', sourceSize: 150 })
    expect(record.fields.size).toBeGreaterThan(0)
  })
})
