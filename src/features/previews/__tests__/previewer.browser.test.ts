import { describe, expect, it } from 'vitest'

import {
  brightDisc,
  storeStandInModel,
} from '#/features/background-removal/__tests__/stand-in-model'
import { BACKGROUND_MODEL } from '#/features/background-removal/constants'
import {
  createInferenceHost,
  createInferenceWorker,
} from '#/features/background-removal/inference-host'
import { deleteStoredModel } from '#/features/background-removal/model-files'
import { jsquashCodecs } from '#/features/images/codecs'
import { chain, fixtureBytes } from '#/features/nodes/__tests__/harness'
import { createPreviewer } from '#/features/previews/previewer'

const createWorker = () =>
  new Worker(new URL('../preview.worker.ts', import.meta.url), { type: 'module' })

async function decodeBlob(blob: Blob) {
  return jsquashCodecs.decode('png', new Uint8Array(await blob.arrayBuffer()))
}

describe('live previews', () => {
  it('renders every node for the sample and rerenders only what changed', async () => {
    const previewer = createPreviewer(createWorker)
    const bytes = await fixtureBytes('photo.jpg')
    expect(await previewer.setSample(new Blob([bytes]), 'photo.jpg')).toEqual({
      name: 'photo.jpg',
      width: 48,
      height: 32,
      format: 'jpeg',
    })
    const pipeline = (quality: number) =>
      chain(
        ['resize', { mode: 'percent', percent: 50 }],
        ['convert', { format: 'webp', webp: { quality } }],
        ['compare'],
      )
    const first = (await previewer.render(pipeline(80))) ?? []
    const byNode = new Map(first.map((preview) => [preview.nodeId, preview]))
    expect(byNode.get('resize-1')).toMatchObject({ status: 'processed', width: 24, height: 16 })
    expect(byNode.get('convert-2')).toMatchObject({ status: 'processed', format: 'webp' })
    const thumbnail = await decodeBlob(byNode.get('convert-2')?.thumbnail as Blob)
    expect([thumbnail.width, thumbnail.height]).toEqual([24, 16])
    const compare = byNode.get('compare-3')
    expect((await decodeBlob(compare?.before as Blob)).width).toBe(48)
    expect((await decodeBlob(compare?.after as Blob)).width).toBe(24)

    const second = (await previewer.render(pipeline(30))) ?? []
    const again = new Map(second.map((preview) => [preview.nodeId, preview]))
    expect(again.get('resize-1')?.status).toBe('cached')
    expect(again.get('convert-2')?.status).toBe('processed')
    previewer.dispose()
  })

  it('shows why a node did not receive the sample', async () => {
    const previewer = createPreviewer(createWorker)
    await previewer.setSample(new Blob([await fixtureBytes('photo.jpg')]), 'photo.jpg')
    const result = (await previewer.render(chain(['optimize-png']))) ?? []
    expect(result.find((preview) => preview.nodeId === 'optimize-png-1')?.status).toBe('skipped')
    previewer.dispose()
  })

  it('keeps only the latest of several quick requests', async () => {
    const previewer = createPreviewer(createWorker)
    await previewer.setSample(new Blob([await fixtureBytes('photo.png')]), 'photo.png')
    const results = await Promise.all([
      previewer.render(chain(['resize', { mode: 'percent', percent: 90 }])),
      previewer.render(chain(['resize', { mode: 'percent', percent: 80 }])),
      previewer.render(chain(['resize', { mode: 'percent', percent: 50 }])),
    ])
    expect(results.at(-1)?.find((preview) => preview.nodeId === 'resize-1')?.width).toBe(24)
    expect(results.slice(0, -1).filter((result) => result !== null).length).toBeLessThanOrEqual(1)
    previewer.dispose()
  })

  it('shows the text of data a node makes, and a thumbnail when it also makes images', async () => {
    const previewer = createPreviewer(createWorker)
    await previewer.setSample(new Blob([await fixtureBytes('photo.png')]), 'photo.png')
    const palette = (await previewer.render(chain(['palette', { count: 2, format: 'css' }]))) ?? []
    const colours = palette.find((preview) => preview.nodeId === 'palette-1')
    expect(colours).toMatchObject({ status: 'processed', format: 'text' })
    expect(colours?.thumbnail).toBeUndefined()
    expect(colours?.text).toContain('--photo-1:')
    const set = (await previewer.render(chain(['responsive-set', { widths: [24] }]))) ?? []
    const responsive = set.find((preview) => preview.nodeId === 'responsive-set-1')
    expect(responsive).toMatchObject({ format: 'webp', width: 24, height: 16 })
    expect(responsive?.thumbnail).toBeInstanceOf(Blob)
    expect(responsive?.text).toContain('srcset=')
    previewer.dispose()
  })

  it('previews combining nodes on the sample', async () => {
    const previewer = createPreviewer(createWorker)
    await previewer.setSample(new Blob([await fixtureBytes('photo.png')]), 'photo.png')
    const result = (await previewer.render(chain(['images-to-pdf']))) ?? []
    expect(result.find((preview) => preview.nodeId === 'images-to-pdf-1')).toMatchObject({
      status: 'processed',
      format: 'pdf',
    })
    previewer.dispose()
  })

  it('previews Remove background with the model in this browser', async () => {
    await storeStandInModel()
    const inference = createInferenceHost(createInferenceWorker)
    const previewer = createPreviewer(createWorker, { connectInference: () => inference.connect() })
    const png = await jsquashCodecs.encode(
      { format: 'png', options: { optimisationLevel: 0, interlace: false } },
      brightDisc(),
    )
    await previewer.setSample(new Blob([png.slice()]), 'disc.png')
    const result = (await previewer.render(chain(['remove-background']))) ?? []
    const preview = result.find((entry) => entry.nodeId === 'remove-background-1')
    expect(preview).toMatchObject({ status: 'processed', format: 'png', width: 64, height: 48 })
    const thumbnail = await decodeBlob(preview?.thumbnail as Blob)
    expect(thumbnail.data[3]).toBe(0)
    expect(thumbnail.data[(24 * 64 + 32) * 4 + 3]).toBe(255)
    expect(inference.stats().runs).toBe(1)
    previewer.dispose()
    inference.dispose()
    await deleteStoredModel(BACKGROUND_MODEL)
  })

  it('leaves the inference worker alone for pipelines without a model', async () => {
    let connected = 0
    const previewer = createPreviewer(createWorker, {
      connectInference: () => {
        connected += 1
        return new MessageChannel().port1
      },
    })
    await previewer.setSample(new Blob([await fixtureBytes('photo.png')]), 'photo.png')
    await previewer.render(chain(['resize', { mode: 'percent', percent: 50 }]))
    expect(connected).toBe(0)
    previewer.dispose()
  })
})
