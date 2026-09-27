import { describe, expect, it } from 'vitest'

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
})
