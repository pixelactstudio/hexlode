import { afterEach, describe, expect, it, vi } from 'vitest'

import { chain, fixtureBytes } from '#/features/nodes/__tests__/harness'
import { productRegistry } from '#/features/nodes/registry'
import { createRunController, type RunController } from '#/features/runs/run-controller'

async function photo(name = 'photo.jpg') {
  const bytes = await fixtureBytes(name)
  return { file: new File([bytes], name, { lastModified: 1 }), relativePath: name }
}

const tracked = vi.hoisted(() => [] as { event: string; properties: Record<string, unknown> }[])

vi.mock('#/features/usage/usage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('#/features/usage/usage')>()),
  track: (event: string, properties: Record<string, unknown>) => {
    tracked.push({ event, properties })
  },
}))

function runStarted() {
  return tracked.filter(({ event }) => event === 'run_started').at(-1)?.properties
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

  it('reports how many times a saved pipeline has run', async () => {
    const runs = create()
    await runs.setPipeline(chain(['convert', { format: 'png' }]))
    await runs.addFiles([await photo()])
    await runs.start({ pipelineRuns: 3 })
    expect(runStarted()).toMatchObject({ surface: 'studio', itemCount: 1, pipelineRuns: 3 })
  })

  it('reports no run count for a pipeline that is not saved', async () => {
    const runs = create()
    await runs.setPipeline(chain(['convert', { format: 'png' }]))
    await runs.addFiles([await photo()])
    await runs.start()
    expect(runStarted()).toMatchObject({ surface: 'studio', itemCount: 1 })
    expect(runStarted()).not.toHaveProperty('pipelineRuns')
  })
})
