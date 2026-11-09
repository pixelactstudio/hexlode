import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  brightDisc,
  STAND_IN_MODEL,
  STAND_IN_MODEL_URL,
} from '#/features/background-removal/__tests__/stand-in-model'
import { BACKGROUND_MODEL } from '#/features/background-removal/constants'
import { deleteStoredModel, modelUrl } from '#/features/background-removal/model-files'
import { jsquashCodecs } from '#/features/images/codecs'
import { chain, decodeFile, fixtureBytes, unzip } from '#/features/nodes/__tests__/harness'
import { productRegistry } from '#/features/nodes/registry'
import { OUTPUT_NODE_ID, quickToolPipeline } from '#/features/quick-tools/tools'
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
  controller = createRunController({
    registry: productRegistry,
    surface: 'studio',
    models: { [STAND_IN_MODEL.id]: STAND_IN_MODEL },
  })
  return controller
}

function lastTracked(event: string) {
  return tracked.filter((entry) => entry.event === event).at(-1)?.properties
}

/** Hexlode's server, which serves the model under `/models/`, played by the test fixture. */
function serveModel() {
  const realFetch = globalThis.fetch
  return vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation((input, init) =>
      realFetch(String(input) === modelUrl(BACKGROUND_MODEL) ? STAND_IN_MODEL_URL : input, init),
    )
}

async function discFile() {
  const bytes = await jsquashCodecs.encode(
    { format: 'png', options: { optimisationLevel: 0, interlace: false } },
    brightDisc(),
  )
  return {
    file: new File([bytes.slice()], 'disc.png', { lastModified: 1 }),
    relativePath: 'disc.png',
  }
}

afterEach(async () => {
  tracked.splice(0)
  controller?.dispose()
  controller = undefined
  vi.restoreAllMocks()
  await deleteStoredModel(BACKGROUND_MODEL)
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

  describe('with a node that runs an on-device model', () => {
    it('waits for the model, and counts its download in the estimate', async () => {
      const runs = create()
      await runs.setPipeline(chain(['remove-background']))
      await runs.addFiles([await discFile()])
      expect(runs.getState().models).toEqual([
        { id: STAND_IN_MODEL.id, bytes: STAND_IN_MODEL.bytes, stored: false },
      ])
      expect(runs.getState().estimate?.downloadBytes).toBe(STAND_IN_MODEL.bytes)
      expect(await runs.start()).toBeUndefined()
      expect(runStarted()).toBeUndefined()
    })

    it('downloads the model when asked, then cuts out the subject with it', async () => {
      serveModel()
      const runs = create()
      await runs.setPipeline(chain(['remove-background']))
      await runs.addFiles([await discFile()])
      await runs.downloadModels()
      expect(runs.getState().models[0].stored).toBe(true)
      expect(runs.getState().estimate?.downloadBytes).toBe(0)
      expect(lastTracked('model_downloaded')).toMatchObject({
        surface: 'studio',
        model: STAND_IN_MODEL.id,
        status: 'complete',
        bytes: STAND_IN_MODEL.bytes,
      })
      const result = await runs.start()
      expect(result?.error).toBeUndefined()
      expect(result?.status).toBe('complete')
      const [entry] = await unzip(result?.deliveries[0].archive as Blob)
      const image = await decodeFile(entry.bytes)
      expect(image.pixels.data[3]).toBe(0)
      expect(image.pixels.data[(24 * 64 + 32) * 4 + 3]).toBe(255)
      expect(lastTracked('model_ran')).toMatchObject({
        surface: 'studio',
        model: STAND_IN_MODEL.id,
        backend: 'wasm',
        runs: 1,
        failureCodes: [],
      })
    })

    it('runs the Remove background quick tool end to end, delivering WebP with transparency', async () => {
      serveModel()
      const runs = createRunController({
        registry: productRegistry,
        surface: 'quick-tool',
        tool: 'remove-background',
        outputNodeId: OUTPUT_NODE_ID,
        models: { [STAND_IN_MODEL.id]: STAND_IN_MODEL },
      })
      controller = runs
      await runs.setPipeline(quickToolPipeline('remove-background', { format: 'webp' }))
      await runs.addFiles([await discFile()])
      await runs.downloadModels()
      const result = await runs.start({ singleFileAsIs: true })
      expect(result?.status).toBe('complete')
      const delivery = result?.deliveries[0]
      expect(delivery?.files.map((file) => file.name)).toEqual(['disc.webp'])
      const image = await decodeFile(
        new Uint8Array(await (delivery?.archive as Blob).arrayBuffer()),
      )
      expect(image).toMatchObject({ format: 'webp', width: 64, height: 48 })
      expect(image.pixels.data[3]).toBe(0)
      expect(image.pixels.data[(24 * 64 + 32) * 4 + 3]).toBe(255)
    })

    it('reports a download that fails its check, and keeps waiting for the model', async () => {
      const realFetch = globalThis.fetch
      vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) =>
        String(input) === modelUrl(BACKGROUND_MODEL)
          ? Promise.resolve(new Response(new Uint8Array(STAND_IN_MODEL.bytes)))
          : realFetch(input, init),
      )
      const runs = create()
      await runs.setPipeline(chain(['remove-background']))
      await expect(runs.downloadModels()).rejects.toThrow('did not match its checksum')
      expect(runs.getState().models[0].stored).toBe(false)
      expect(lastTracked('model_downloaded')).toMatchObject({
        status: 'failed',
        errorCode: 'hash_mismatch',
      })
    })
  })
})
