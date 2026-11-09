/**
 * Remove background in a real pipeline, with a stand-in for the inference worker that sees red
 * things as the subject. Output is decoded and checked for format, size and transparency.
 */
import { describe, expect, it } from 'vitest'

import { redSubjectSegmenter } from '#/features/background-removal/__tests__/stand-in-segmenter'
import { jsquashCodecs } from '#/features/images/codecs'

import { chain, decodeFile, near, pixelAt, pngInput, RED, run, solidPixels } from './harness'

/** A red disc in the middle of a grey photo. */
const disc = (x: number, y: number) =>
  (x - 48) ** 2 + (y - 32) ** 2 < 20 ** 2 ? [230, 20, 20, 255] : [128, 128, 128, 255]

describe('Remove background', () => {
  it('cuts the subject of a JPEG out onto transparency, as a PNG', async () => {
    const segmenter = redSubjectSegmenter()
    const bytes = await jsquashCodecs.encode(
      { format: 'jpeg', options: { quality: 95, progressive: false, chromaSubsampling: '444' } },
      solidPixels(96, 64, disc),
    )
    const { files } = await run(chain(['remove-background']), [{ name: 'shop/disc.jpg', bytes }], {
      services: { segmenter },
    })
    expect(files().map((file) => file.name)).toEqual(['shop/disc.png'])
    const image = await decodeFile(files()[0].bytes)
    expect(image).toMatchObject({ format: 'png', width: 96, height: 64 })
    expect(pixelAt(image, 2, 2)[3]).toBe(0)
    expect(pixelAt(image, 93, 61)[3]).toBe(0)
    const [red, green, blue, alpha] = pixelAt(image, 48, 32)
    expect(alpha).toBe(255)
    expect(red).toBeGreaterThan(200)
    expect(green + blue).toBeLessThan(80)
    // The model saw the photo at its own input size, not the photo's.
    expect(segmenter.sizes).toEqual([64, 64])
  })

  it('turns the photo upright before the model sees it', async () => {
    // Stored sideways, red on the left: upright, red is on top.
    const { files } = await run(chain(['remove-background']), ['oriented.jpg'], {
      services: { segmenter: redSubjectSegmenter() },
    })
    const image = await decodeFile(files()[0].bytes)
    expect(image).toMatchObject({ format: 'png', width: 32, height: 48 })
    expect(image.exif.orientation).toBe(1)
    expect(near(pixelAt(image, 16, 6), RED)).toBe(true)
    expect(pixelAt(image, 16, 42)[3]).toBe(0)
  })

  it('keeps formats that hold transparency, and the transparency they had', async () => {
    const { files } = await run(chain(['remove-background']), ['alpha.png', 'photo.webp'], {
      services: { segmenter: redSubjectSegmenter() },
    })
    const [png, webp] = await Promise.all(files().map((file) => decodeFile(file.bytes)))
    expect(files().map((file) => file.name)).toEqual(['alpha.png', 'photo.webp'])
    expect(png.format).toBe('png')
    // The top half was transparent already; the red bottom left stays; blue is background.
    expect(pixelAt(png, 4, 4)[3]).toBe(0)
    expect(pixelAt(png, 4, 28)).toEqual(RED)
    expect(pixelAt(png, 44, 28)[3]).toBe(0)
    expect(webp.format).toBe('webp')
    expect(pixelAt(webp, 44, 16)[3]).toBe(0)
  })

  it('warns when it finds no subject', async () => {
    const grey = await pngInput('grey.png', solidPixels(16, 16, [128, 128, 128, 255]))
    const { files, warnings } = await run(chain(['remove-background']), [grey], {
      services: { segmenter: redSubjectSegmenter() },
    })
    const image = await decodeFile(files()[0].bytes)
    expect(pixelAt(image, 8, 8)[3]).toBe(0)
    expect(warnings().map((warning) => warning.code)).toEqual(['no_subject'])
  })

  it('fails the item with a reason when no inference worker is connected', async () => {
    const { events } = await run(chain(['remove-background']), ['photo.png'])
    const failed = events.find((event) => event.type === 'node-item' && event.status === 'failed')
    expect(failed).toMatchObject({ error: 'Background removal is not available here.' })
  })
})
