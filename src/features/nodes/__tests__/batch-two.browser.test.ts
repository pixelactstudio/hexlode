/**
 * Node batch 2. Each test runs the node in a real pipeline, decodes what Output delivered and
 * checks format, dimensions and pixels.
 */
import { describe, expect, it } from 'vitest'

import { createMemoryStepCache } from '#/features/engine/memory-step-cache'
import { jsquashCodecs } from '#/features/images/codecs'
import { bytesToBase64 } from '#/lib/base64'

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

describe('Background', () => {
  it('replaces transparency with a colour and keeps opaque pixels', async () => {
    const { files } = await run(chain(['background', { colour: '#ffffff' }]), ['alpha.png'])
    const image = await decodeFile(files()[0].bytes)
    expect(image).toMatchObject({ format: 'png', width: 48, height: 32 })
    expect(pixelAt(image, 4, 4)).toEqual([255, 255, 255, 255])
    expect(pixelAt(image, 4, 28)).toEqual(RED)
    expect(pixelAt(image, 44, 28)).toEqual(BLUE)
  })

  it('blends partly transparent pixels with the colour', async () => {
    const input = await pngInput('half.png', solidPixels(4, 4, [255, 0, 0, 128]))
    const { files } = await run(chain(['background', { colour: '#ffffff' }]), [input])
    expect(pixelAt(await decodeFile(files()[0].bytes), 1, 1)).toEqual([255, 127, 127, 255])
  })

  it('passes opaque images on unchanged', async () => {
    const { files } = await run(chain(['background', { colour: '#000000' }]), ['photo.jpg'])
    expect(files()[0].bytes.length).toBe(666)
  })
})

describe('Adjust', () => {
  const grey = (level: number) =>
    pngInput('grey.png', solidPixels(4, 4, [level, level, level, 255]))

  async function adjusted(
    settings: Record<string, unknown>,
    input: { name: string; bytes: Uint8Array },
  ) {
    const { files } = await run(chain(['adjust', settings]), [input])
    return pixelAt(await decodeFile(files()[0].bytes), 1, 1)
  }

  it('removes saturation down to the luminance of each pixel', async () => {
    const { files } = await run(chain(['adjust', { saturation: -100 }]), ['photo.png'])
    const image = await decodeFile(files()[0].bytes)
    // Rec. 709 luminance: red 0.2126 × 255, blue 0.0722 × 255.
    expect(pixelAt(image, 4, 4)).toEqual([54, 54, 54, 255])
    expect(pixelAt(image, 44, 4)).toEqual([18, 18, 18, 255])
  })

  it('shifts brightness by up to 128 levels', async () => {
    expect(await adjusted({ brightness: 50 }, await grey(100))).toEqual([164, 164, 164, 255])
    expect(await adjusted({ brightness: -100 }, await grey(100))).toEqual([0, 0, 0, 255])
  })

  it('spreads levels away from the middle with contrast', async () => {
    expect(await adjusted({ contrast: 50 }, await grey(96))).toEqual([80, 80, 80, 255])
    expect(await adjusted({ contrast: -100 }, await grey(30))).toEqual([128, 128, 128, 255])
  })

  it('doubles the light with one stop of exposure', async () => {
    // sRGB 128 is 0.2159 linear; doubled, 0.4317 linear is sRGB 175.6.
    const [red] = await adjusted({ exposure: 1 }, await grey(128))
    expect(Math.abs(red - 176)).toBeLessThanOrEqual(1)
  })

  it('passes images on unchanged when every setting is zero', async () => {
    const { files } = await run(chain(['adjust']), ['photo.jpg'])
    expect(files()[0].bytes.length).toBe(666)
  })
})

describe('Filters', () => {
  async function filtered(
    settings: Record<string, unknown>,
    input: string | { name: string; bytes: Uint8Array } = 'photo.png',
  ) {
    const { files } = await run(chain(['filters', settings]), [input])
    return decodeFile(files()[0].bytes)
  }

  it('turns images grey by luminance', async () => {
    const image = await filtered({ filter: 'grayscale' })
    expect(pixelAt(image, 4, 4)).toEqual([54, 54, 54, 255])
    expect(pixelAt(image, 44, 4)).toEqual([18, 18, 18, 255])
  })

  it('tones images sepia with the classic matrix', async () => {
    // Red through the sepia matrix: 0.393, 0.349 and 0.272 of 255.
    expect(pixelAt(await filtered({ filter: 'sepia' }), 4, 4)).toEqual([100, 89, 69, 255])
  })

  it('inverts colours, blended by strength', async () => {
    expect(pixelAt(await filtered({ filter: 'invert' }), 4, 4)).toEqual([0, 255, 255, 255])
    expect(pixelAt(await filtered({ filter: 'invert', strength: 25 }), 4, 4)).toEqual([
      191, 64, 64, 255,
    ])
  })

  it('maps shadows and highlights to two colours with duotone', async () => {
    const input = await pngInput(
      'steps.png',
      solidPixels(2, 1, (x) => (x === 0 ? [0, 0, 0, 255] : [255, 255, 255, 255])),
    )
    const image = await filtered(
      { filter: 'duotone', shadows: '#102030', highlights: '#f0e0d0' },
      input,
    )
    expect(pixelAt(image, 0, 0)).toEqual([16, 32, 48, 255])
    expect(pixelAt(image, 1, 0)).toEqual([240, 224, 208, 255])
  })

  it('keeps transparency', async () => {
    const image = await filtered({ filter: 'invert' }, 'alpha.png')
    expect(pixelAt(image, 4, 4)[3]).toBe(0)
    expect(pixelAt(image, 4, 28)).toEqual([0, 255, 255, 255])
  })
})

describe('Sharpen / Blur', () => {
  it('blurs across edges and leaves flat areas alone', async () => {
    const { files } = await run(chain(['sharpen-blur', { effect: 'blur', radius: 3 }]), [
      'photo.png',
    ])
    const image = await decodeFile(files()[0].bytes)
    expect(image).toMatchObject({ width: 48, height: 32 })
    const [red, , blue] = pixelAt(image, 23, 16)
    expect(blue).toBeGreaterThan(60)
    expect(red).toBeLessThan(200)
    expect(near(pixelAt(image, 1, 16), RED, 2)).toBe(true)
  })

  it('does not darken edges next to transparent pixels', async () => {
    const input = await pngInput(
      'edge.png',
      solidPixels(8, 16, (_x, y) => (y < 8 ? [0, 0, 0, 0] : [255, 255, 255, 255])),
    )
    const { files } = await run(chain(['sharpen-blur', { effect: 'blur', radius: 2 }]), [input])
    const [red, green, blue, alpha] = pixelAt(await decodeFile(files()[0].bytes), 4, 8)
    expect(alpha).toBeGreaterThan(0)
    expect(alpha).toBeLessThan(255)
    expect(Math.min(red, green, blue)).toBeGreaterThanOrEqual(250)
  })

  it('blurs only the chosen area', async () => {
    const input = await pngInput('noise.png', noisyPixels(64))
    const { files } = await run(
      chain([
        'sharpen-blur',
        { effect: 'blur', radius: 4, region: 'area', area: { x: 0, y: 0, width: 50, height: 50 } },
      ]),
      [input],
    )
    const before = await decodeFile(input.bytes)
    const after = await decodeFile(files()[0].bytes)
    expect(pixelAt(after, 10, 10)).not.toEqual(pixelAt(before, 10, 10))
    expect(pixelAt(after, 40, 40)).toEqual(pixelAt(before, 40, 40))
    expect(pixelAt(after, 10, 40)).toEqual(pixelAt(before, 10, 40))
  })

  it('sharpens by pushing levels apart at edges', async () => {
    const input = await pngInput(
      'step.png',
      solidPixels(16, 4, (x) => (x < 8 ? [100, 100, 100, 255] : [150, 150, 150, 255])),
    )
    const { files } = await run(
      chain(['sharpen-blur', { effect: 'sharpen', radius: 1, amount: 100 }]),
      [input],
    )
    const image = await decodeFile(files()[0].bytes)
    expect(pixelAt(image, 7, 2)[0]).toBeLessThan(100)
    expect(pixelAt(image, 8, 2)[0]).toBeGreaterThan(150)
    expect(pixelAt(image, 0, 2)[0]).toBe(100)
    expect(pixelAt(image, 15, 2)[0]).toBe(150)
  })
})

describe('Auto-trim', () => {
  const WHITE = [255, 255, 255, 255]

  /** A red 16x4 block inside a border painted by `border`: 3 left, 1 right, 2 top, 4 bottom. */
  function framed(border: number[] | ((x: number, y: number) => number[])) {
    return solidPixels(20, 10, (x, y) =>
      x >= 3 && x < 19 && y >= 2 && y < 6
        ? RED
        : typeof border === 'function'
          ? border(x, y)
          : border,
    )
  }

  it('removes a plain-colour border', async () => {
    const input = await pngInput('framed.png', framed(WHITE))
    const { files } = await run(chain(['auto-trim']), [input])
    const image = await decodeFile(files()[0].bytes)
    expect(image).toMatchObject({ width: 16, height: 4 })
    expect(pixelAt(image, 0, 0)).toEqual(RED)
    expect(pixelAt(image, 15, 3)).toEqual(RED)
  })

  it('removes transparent borders', async () => {
    const { files } = await run(chain(['auto-trim']), ['alpha.png'])
    const image = await decodeFile(files()[0].bytes)
    expect(image).toMatchObject({ width: 48, height: 16 })
    expect(pixelAt(image, 4, 0)).toEqual(RED)
  })

  it('treats colours within the tolerance as border and keeps padding', async () => {
    // A paper-white border that varies between 250 and 255.
    const paper = (x: number, y: number) => ((x + y) % 2 === 0 ? [250, 250, 250, 255] : WHITE)
    const input = await pngInput('framed.png', framed(paper))
    const strict = await run(chain(['auto-trim', { tolerance: 0 }]), [input])
    expect(await decodeFile(strict.files()[0].bytes)).toMatchObject({ width: 20, height: 10 })
    const padded = await run(chain(['auto-trim', { tolerance: 5, padding: 1 }]), [input])
    const image = await decodeFile(padded.files()[0].bytes)
    expect(image).toMatchObject({ width: 18, height: 6 })
    expect(pixelAt(image, 0, 0)).toEqual(paper(2, 1))
    expect(pixelAt(image, 1, 1)).toEqual(RED)
  })

  it('leaves an image of one colour unchanged', async () => {
    const input = await pngInput('plain.png', solidPixels(6, 6, WHITE))
    const { files } = await run(chain(['auto-trim']), [input])
    expect(files()[0].bytes).toEqual(input.bytes)
  })
})

describe('Pad / Extend', () => {
  const WHITE = [255, 255, 255, 255]

  it('adds colour around the image to reach an aspect ratio', async () => {
    const { files } = await run(chain(['pad', { aspect: '1:1', colour: '#ffffff' }]), ['photo.png'])
    const image = await decodeFile(files()[0].bytes)
    expect(image).toMatchObject({ format: 'png', width: 48, height: 48 })
    expect(pixelAt(image, 4, 7)).toEqual(WHITE)
    expect(pixelAt(image, 4, 8)).toEqual(RED)
    expect(pixelAt(image, 44, 39)).toEqual(BLUE)
    expect(pixelAt(image, 44, 40)).toEqual(WHITE)
  })

  it('places the image at the chosen position', async () => {
    const { files } = await run(
      chain(['pad', { aspect: '9:16', colour: '#000000', position: 'top' }]),
      ['photo.png'],
    )
    const image = await decodeFile(files()[0].bytes)
    expect(image).toMatchObject({ width: 48, height: 85 })
    expect(pixelAt(image, 4, 0)).toEqual(RED)
    expect(pixelAt(image, 4, 32)).toEqual([0, 0, 0, 255])
  })

  it('fills the space with a blurred copy of the image', async () => {
    const { files } = await run(chain(['pad', { aspect: '1:1', fill: 'blur' }]), ['photo.png'])
    const image = await decodeFile(files()[0].bytes)
    expect(image).toMatchObject({ width: 48, height: 48 })
    expect(near(pixelAt(image, 4, 2), RED, 60)).toBe(true)
    expect(near(pixelAt(image, 44, 2), BLUE, 60)).toBe(true)
    expect(pixelAt(image, 4, 24)).toEqual(RED)
  })

  it('turns photos upright first', async () => {
    const { files } = await run(chain(['pad', { aspect: '1:1' }]), ['oriented.jpg'])
    const image = await decodeFile(files()[0].bytes)
    expect(image).toMatchObject({ format: 'jpeg', width: 48, height: 48 })
    expect(image.exif.orientation).toBe(1)
  })

  it('passes images that already have the ratio on unchanged', async () => {
    const { files } = await run(chain(['pad', { aspect: '3:2' }]), ['photo.jpg'])
    expect(files()[0].bytes.length).toBe(666)
  })
})

describe('Pixel-art upscale', () => {
  const BLACK = [0, 0, 0, 255]
  const WHITE = [255, 255, 255, 255]
  /** A white diagonal from the top-left corner on black. */
  const diagonal = () =>
    pngInput(
      'diagonal.png',
      solidPixels(3, 3, (x, y) => (x === y ? WHITE : BLACK)),
    )

  it('enlarges with hard pixel edges', async () => {
    const { files } = await run(chain(['pixel-art', { scale: 3 }]), ['photo.png'])
    const image = await decodeFile(files()[0].bytes)
    expect(image).toMatchObject({ format: 'png', width: 144, height: 96 })
    expect(pixelAt(image, 71, 0)).toEqual(RED)
    expect(pixelAt(image, 72, 0)).toEqual(BLUE)
  })

  it('smooths diagonals without blurring when asked', async () => {
    const nearest = await run(chain(['pixel-art', { scale: 2, method: 'nearest' }]), [
      await diagonal(),
    ])
    const smooth = await run(chain(['pixel-art', { scale: 2, method: 'smooth' }]), [
      await diagonal(),
    ])
    expect(pixelAt(await decodeFile(nearest.files()[0].bytes), 2, 1)).toEqual(BLACK)
    const image = await decodeFile(smooth.files()[0].bytes)
    expect(image).toMatchObject({ width: 6, height: 6 })
    expect(pixelAt(image, 2, 1)).toEqual(WHITE)
    expect(pixelAt(image, 5, 0)).toEqual(BLACK)
    // Every pixel is one of the source colours.
    for (let index = 0; index < image.pixels.data.length; index += 4) {
      expect([0, 255]).toContain(image.pixels.data[index])
    }
  })

  it('smooths at 3x and 4x', async () => {
    for (const scale of [3, 4]) {
      const { files } = await run(chain(['pixel-art', { scale, method: 'smooth' }]), [
        await diagonal(),
      ])
      expect(await decodeFile(files()[0].bytes)).toMatchObject({
        width: 3 * scale,
        height: 3 * scale,
      })
    }
  })
})

describe('Split / Tile', () => {
  it('cuts one image into a grid, numbered left to right and top to bottom', async () => {
    const { files } = await run(chain(['split', { columns: 2, rows: 2 }]), ['photo.png'])
    const delivered = files()
    expect(delivered.map(({ name }) => name)).toEqual([
      'photo-1.png',
      'photo-2.png',
      'photo-3.png',
      'photo-4.png',
    ])
    const tiles = await Promise.all(delivered.map(({ bytes }) => decodeFile(bytes)))
    for (const tile of tiles) expect(tile).toMatchObject({ format: 'png', width: 24, height: 16 })
    expect(pixelAt(tiles[0], 23, 15)).toEqual(RED)
    expect(pixelAt(tiles[1], 0, 0)).toEqual(BLUE)
    expect(pixelAt(tiles[2], 0, 0)).toEqual(RED)
    expect(pixelAt(tiles[3], 23, 15)).toEqual(BLUE)
  })

  it('spreads uneven pixels across the tiles', async () => {
    const { files } = await run(chain(['split', { columns: 5, rows: 1 }]), ['photo.png'])
    const widths = await Promise.all(
      files().map(async ({ bytes }) => (await decodeFile(bytes)).width),
    )
    expect(widths).toEqual([10, 9, 10, 9, 10])
  })

  it('pads numbers so tiles sort in order', async () => {
    const { files } = await run(chain(['split', { columns: 4, rows: 3 }]), ['photo.png'])
    expect(
      files()
        .map(({ name }) => name)
        .slice(0, 2),
    ).toEqual(['photo-01.png', 'photo-02.png'])
    expect(files().at(-1)?.name).toBe('photo-12.png')
  })

  it('turns photos upright first and keeps their metadata', async () => {
    const { files } = await run(chain(['split', { columns: 1, rows: 2 }]), ['oriented.jpg'])
    const tiles = await Promise.all(files().map(({ bytes }) => decodeFile(bytes)))
    expect(tiles).toHaveLength(2)
    for (const tile of tiles) {
      expect(tile).toMatchObject({ format: 'jpeg', width: 32, height: 24 })
      expect(tile.exif).toMatchObject({ orientation: 1, copyright: '(c) 2026 Ada Example' })
    }
  })
})

describe('Border / Rounded corners', () => {
  const BLACK = [0, 0, 0, 255]

  it('adds a frame around the image', async () => {
    const { files } = await run(
      chain(['border', { unit: 'pixels', border: 4, borderColour: '#000000', radius: 0 }]),
      ['photo.png'],
    )
    const image = await decodeFile(files()[0].bytes)
    expect(image).toMatchObject({ format: 'png', width: 56, height: 40 })
    expect(pixelAt(image, 0, 0)).toEqual(BLACK)
    expect(pixelAt(image, 3, 20)).toEqual(BLACK)
    expect(pixelAt(image, 4, 4)).toEqual(RED)
    expect(pixelAt(image, 51, 35)).toEqual(BLUE)
    expect(pixelAt(image, 55, 39)).toEqual(BLACK)
  })

  it('measures in percent of the shorter edge', async () => {
    const { files } = await run(chain(['border', { unit: 'percent', border: 10, radius: 0 }]), [
      'photo.png',
    ])
    expect(await decodeFile(files()[0].bytes)).toMatchObject({ width: 54, height: 38 })
  })

  it('rounds the corners into transparency', async () => {
    const { files } = await run(
      chain(['border', { unit: 'pixels', border: 0, radius: 8, corners: 'transparent' }]),
      ['photo.png'],
    )
    const image = await decodeFile(files()[0].bytes)
    expect(image).toMatchObject({ width: 48, height: 32 })
    expect(pixelAt(image, 0, 0)[3]).toBe(0)
    expect(pixelAt(image, 1, 1)[3]).toBe(0)
    expect(pixelAt(image, 47, 31)[3]).toBe(0)
    expect(pixelAt(image, 8, 8)).toEqual(RED)
    expect(pixelAt(image, 0, 16)).toEqual(RED)
    // The centre of pixel (1, 3) is 7.9 pixels from the centre of the 8-pixel arc.
    const edge = pixelAt(image, 1, 3)[3]
    expect(edge).toBeGreaterThan(0)
    expect(edge).toBeLessThan(255)
  })

  it('fills rounded corners with a colour', async () => {
    const { files } = await run(
      chain([
        'border',
        { unit: 'pixels', border: 0, radius: 8, corners: 'colour', cornerColour: '#00ff00' },
      ]),
      ['photo.jpg'],
    )
    const image = await decodeFile(files()[0].bytes)
    expect(image.format).toBe('jpeg')
    expect(near(pixelAt(image, 0, 0), [0, 255, 0, 255])).toBe(true)
    expect(near(pixelAt(image, 10, 16), RED)).toBe(true)
  })
})

/** How many pixels in an area are brighter than `level` in their red channel. */
function brightPixels(
  image: { pixels: { data: Uint8ClampedArray; width: number } },
  area: { x: number; y: number; width: number; height: number },
  level = 100,
) {
  let count = 0
  for (let y = area.y; y < area.y + area.height; y += 1) {
    for (let x = area.x; x < area.x + area.width; x += 1) {
      if (pixelAt(image, x, y)[0] > level) count += 1
    }
  }
  return count
}

const quadrants = {
  topLeft: { x: 0, y: 0, width: 100, height: 50 },
  topRight: { x: 100, y: 0, width: 100, height: 50 },
  bottomLeft: { x: 0, y: 50, width: 100, height: 50 },
  bottomRight: { x: 100, y: 50, width: 100, height: 50 },
}

const blackInput = () => pngInput('black.png', solidPixels(200, 100, [0, 0, 0, 255]))

describe('Text watermark', () => {
  async function watermarked(settings: Record<string, unknown>) {
    const { files } = await run(chain(['text-watermark', settings]), [await blackInput()])
    return decodeFile(files()[0].bytes)
  }

  it('places text at the chosen position and leaves the rest alone', async () => {
    const image = await watermarked({ text: 'HEXLODE', colour: '#ffffff', opacity: 100, size: 20 })
    expect(image).toMatchObject({ format: 'png', width: 200, height: 100 })
    expect(brightPixels(image, quadrants.bottomRight)).toBeGreaterThan(20)
    expect(brightPixels(image, quadrants.topLeft, 0)).toBe(0)
    const left = await watermarked({
      text: 'HEXLODE',
      position: 'top-left',
      opacity: 100,
      size: 20,
    })
    expect(brightPixels(left, quadrants.topLeft)).toBeGreaterThan(20)
    expect(brightPixels(left, quadrants.bottomRight, 0)).toBe(0)
  })

  it('blends the text by its opacity', async () => {
    const image = await watermarked({ text: 'HEXLODE', colour: '#ffffff', opacity: 50, size: 30 })
    let brightest = 0
    for (let index = 0; index < image.pixels.data.length; index += 4) {
      brightest = Math.max(brightest, image.pixels.data[index])
    }
    // White at half opacity over black.
    expect(Math.abs(brightest - 128)).toBeLessThanOrEqual(2)
  })

  it('repeats the text across the image as a tile', async () => {
    const image = await watermarked({ text: 'HEXLODE', opacity: 100, tile: true, size: 12 })
    for (const area of Object.values(quadrants)) {
      expect(brightPixels(image, area)).toBeGreaterThan(10)
    }
  })

  it('passes images on unchanged when there is no text', async () => {
    const { files } = await run(chain(['text-watermark', { text: '  ' }]), ['photo.jpg'])
    expect(files()[0].bytes.length).toBe(666)
  })
})

describe('Image watermark', () => {
  const GREEN = [0, 255, 0, 255]

  /** The logo setting for a 10x10 green PNG, as the Studio stores it. */
  async function greenLogo() {
    const { bytes } = await pngInput('logo.png', solidPixels(10, 10, GREEN))
    return { name: 'logo.png', data: bytesToBase64(bytes), width: 10, height: 10 }
  }

  async function watermarked(settings: Record<string, unknown>) {
    const result = await run(chain(['image-watermark', settings]), [await blackInput()])
    return { image: await decodeFile(result.files()[0].bytes), warnings: result.warnings() }
  }

  it('places the logo scaled to a share of the image width', async () => {
    const { image } = await watermarked({
      logo: await greenLogo(),
      position: 'top-left',
      scale: 10,
      margin: 0,
      opacity: 100,
    })
    expect(image).toMatchObject({ format: 'png', width: 200, height: 100 })
    // The logo is resampled, which can move a level by one or two.
    expect(near(pixelAt(image, 0, 0), GREEN, 2)).toBe(true)
    expect(near(pixelAt(image, 19, 19), GREEN, 2)).toBe(true)
    expect(pixelAt(image, 20, 20)).toEqual([0, 0, 0, 255])
  })

  it('keeps a margin from the edge at the chosen position', async () => {
    const { image } = await watermarked({
      logo: await greenLogo(),
      position: 'bottom-right',
      scale: 10,
      margin: 5,
      opacity: 100,
    })
    // 20 pixels wide, 5 pixels from the right and bottom edges.
    expect(near(pixelAt(image, 175, 75), GREEN, 2)).toBe(true)
    expect(near(pixelAt(image, 194, 94), GREEN, 2)).toBe(true)
    expect(pixelAt(image, 174, 75)).toEqual([0, 0, 0, 255])
    expect(pixelAt(image, 195, 95)).toEqual([0, 0, 0, 255])
  })

  it('blends the logo by its opacity', async () => {
    const { image } = await watermarked({
      logo: await greenLogo(),
      position: 'top-left',
      scale: 10,
      margin: 0,
      opacity: 50,
    })
    expect(near(pixelAt(image, 5, 5), [0, 128, 0, 255], 2)).toBe(true)
  })

  it('passes images on unchanged with a warning when no logo is chosen', async () => {
    const { files, warnings } = await run(chain(['image-watermark']), ['photo.jpg'])
    expect(files()[0].bytes.length).toBe(666)
    expect(warnings().map(({ code }) => code)).toEqual(['no_logo'])
  })
})

describe('Deduplicate', () => {
  /** Files, Deduplicate, then Output for unique items and another for duplicates. */
  function dedupe(settings: Record<string, unknown> = {}) {
    const pipeline = chain(['deduplicate', settings])
    pipeline.nodes.push({ id: 'dupes', type: 'output', settings: {}, position: { x: 0, y: 0 } })
    pipeline.connections.push({
      id: 'dupes',
      source: 'deduplicate-1',
      sourcePort: 'duplicates',
      target: 'dupes',
    })
    return pipeline
  }

  const noise = () => pngInput('noise.png', noisyPixels(48))

  it('drops near duplicates by fingerprint and keeps the first', async () => {
    const { files } = await run(dedupe({ mode: 'near' }), [
      'photo.jpg',
      await noise(),
      'photo.png',
      'photo.webp',
    ])
    expect(files('out').map(({ name }) => name)).toEqual(['photo.jpg', 'noise.png'])
    expect(files('dupes').map(({ name }) => name)).toEqual(['photo.png', 'photo.webp'])
    expect(files('out')[0].bytes).toEqual(await fixtureBytes('photo.jpg'))
  })

  it('tells different photos of similar scenes apart from resaved and resized copies', async () => {
    const photo = async (name: string) => {
      const response = await fetch(new URL(`../../../../public/home/${name}`, import.meta.url))
      return { name, bytes: new Uint8Array(await response.arrayBuffer()) }
    }
    const dawn = await photo('photo-dawn.webp')
    const desert = await photo('photo-desert.webp')
    const dusk = await photo('photo-dusk.webp')
    const pixels = (await decodeFile(dusk.bytes)).pixels
    const resaved = {
      name: 'dusk-resaved.jpg',
      bytes: await jsquashCodecs.encode(
        { format: 'jpeg', options: { quality: 30, progressive: false, chromaSubsampling: '420' } },
        pixels,
      ),
    }
    const half = await pngInput(
      'dusk-half.png',
      await jsquashCodecs.resize(pixels, pixels.width / 2, pixels.height / 2, 'lanczos3'),
    )
    const { files } = await run(dedupe({ mode: 'near' }), [dawn, desert, dusk, resaved, half])
    expect(files('out').map(({ name }) => name)).toEqual([
      'photo-dawn.webp',
      'photo-desert.webp',
      'photo-dusk.webp',
    ])
    expect(files('dupes').map(({ name }) => name)).toEqual(['dusk-resaved.jpg', 'dusk-half.png'])
  })

  it('drops exact duplicates by their pixels', async () => {
    const copy = { name: 'copy.png', bytes: await fixtureBytes('photo.png') }
    const { files } = await run(dedupe({ mode: 'exact' }), ['photo.png', 'photo.jpg', copy])
    expect(files('out').map(({ name }) => name)).toEqual(['photo.png', 'photo.jpg'])
    expect(files('dupes').map(({ name }) => name)).toEqual(['copy.png'])
  })

  it('keeps the largest of near duplicates when asked', async () => {
    const twice = await pngInput(
      'large.png',
      solidPixels(96, 64, (x) => (x < 48 ? RED : BLUE)),
    )
    const { files } = await run(dedupe({ mode: 'near', keep: 'largest' }), ['photo.png', twice])
    expect(files('out').map(({ name }) => name)).toEqual(['large.png'])
    expect(files('dupes').map(({ name }) => name)).toEqual(['photo.png'])
  })

  it('lets kept items report which file they came from', async () => {
    const { events } = await run(dedupe(), ['photo.jpg', await noise(), 'photo.png'])
    const sources = events.flatMap((event) =>
      event.type === 'node-item' && event.nodeId === 'out' ? [event.source] : [],
    )
    expect(sources).toEqual([0, 1])
  })

  it('reuses its step cache and still delivers the kept items', async () => {
    const cache = createMemoryStepCache()
    const inputs = ['photo.jpg', await noise(), 'photo.png']
    await run(dedupe(), inputs, { cache })
    const again = await run(dedupe(), inputs, { cache })
    expect(again.statuses('deduplicate-1')).toEqual(['cached'])
    expect(again.files('out').map(({ name }) => name)).toEqual(['photo.jpg', 'noise.png'])
    expect(again.files('out')[0].bytes).toEqual(await fixtureBytes('photo.jpg'))
  })
})
