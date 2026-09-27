import { afterEach, describe, expect, it } from 'vitest'

import { chain, fixtureBytes } from '#/features/nodes/__tests__/harness'
import { productRegistry } from '#/features/nodes/registry'
import { createRunController, type RunController } from '#/features/runs/run-controller'

async function photo(name = 'photo.jpg') {
  const bytes = await fixtureBytes(name)
  return { file: new File([bytes], name, { lastModified: 1 }), relativePath: name }
}

let controller: RunController | undefined

function create() {
  controller = createRunController({ registry: productRegistry, surface: 'studio' })
  return controller
}

afterEach(() => {
  controller?.dispose()
  controller = undefined
})

describe('run controller', () => {
  it('lets the user run again after a run fails to start', async () => {
    const runs = create()
    const pipeline = chain(['convert', { format: 'png' }])
    // A second Files node makes the run fail before any work starts.
    pipeline.nodes.push({ id: 'files-2', type: 'files', settings: {}, position: { x: 0, y: 200 } })
    await runs.setPipeline(pipeline)
    await runs.addFiles([await photo()])
    expect(runs.getState().sources).toHaveLength(1)
    await runs.start().catch(() => undefined)
    expect(runs.getState()).toMatchObject({
      running: false,
      error: 'A pipeline needs exactly one Files node.',
    })
  })

  it('keeps cleared files cleared when they were still being read', async () => {
    const runs = create()
    await runs.setPipeline(chain(['convert', { format: 'png' }]))
    const adding = runs.addFiles([await photo(), await photo('oriented.jpg')])
    await runs.clearFiles()
    await adding
    expect(runs.getState()).toMatchObject({ files: [], sources: [], preparing: false })
    expect(await runs.start()).toBeUndefined()
  })
})
