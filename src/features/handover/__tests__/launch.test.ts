/**
 * Files opened from the file manager into the installed app on desktop Chromium arrive through
 * `window.launchQueue`. A fake queue stands in for the browser.
 */
import { describe, expect, it } from 'vitest'

import {
  type LaunchedFiles,
  type LaunchQueueLike,
  listenForLaunches,
  openLaunchedPipeline,
} from '#/features/handover/launch'
import { productRegistry } from '#/features/nodes/registry'
import { createDraftStore } from '#/features/pipelines/draft'
import { exportPipelineFile, PipelineFileError } from '#/features/pipelines/pipeline-file'
import type { KeyValueStorage } from '#/features/pipelines/storage'
import { availableTemplates } from '#/features/pipelines/templates'

/** What the browser puts in the queue: handles to the files the user opened. */
function handle(file: File) {
  return { kind: 'file' as const, name: file.name, getFile: async () => file }
}

function fakeQueue() {
  let consumer: Parameters<LaunchQueueLike['setConsumer']>[0] | undefined
  const queue: LaunchQueueLike = {
    setConsumer: (next) => {
      consumer = next
    },
  }
  return { queue, launch: (files: File[]) => consumer?.({ files: files.map(handle) }) }
}

function memoryStorage(): KeyValueStorage {
  const values = new Map<string, string>()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
    removeItem: (key) => void values.delete(key),
  }
}

const template = availableTemplates(productRegistry).find((t) => t.id === 'web-ready-photos')
if (!template) throw new Error('The Web-ready photos template is missing.')
const pipelineFile = new File(
  [exportPipelineFile({ name: 'Shop photos', pipeline: template.pipeline })],
  'Shop-photos.hexlode',
)

describe('files opened from the file manager', () => {
  it('hands each launch to the page, pipeline files apart from images', async () => {
    const { queue, launch } = fakeQueue()
    const launches: LaunchedFiles[] = []
    const done = new Promise<void>((resolve) => {
      listenForLaunches(queue, (files) => {
        launches.push(files)
        resolve()
      })
    })
    const photo = new File(['jpeg'], 'beach.JPG', { type: 'image/jpeg' })
    const scan = new File(['png'], 'scan.png', { type: 'image/png' })
    launch([photo, pipelineFile, scan])
    await done
    expect(launches).toEqual([{ pipelines: [pipelineFile], images: [photo, scan] }])
  })

  it('does nothing in browsers without a launch queue', () => {
    expect(() => listenForLaunches(undefined, () => {})).not.toThrow()
  })
})

describe('opening a .hexlode file', () => {
  it('opens the pipeline in the Studio as a draft', async () => {
    const drafts = createDraftStore({ tab: memoryStorage(), browser: memoryStorage() })
    await openLaunchedPipeline(pipelineFile, drafts)
    expect(drafts.read()).toMatchObject({
      name: 'Shop photos',
      pipeline: { nodes: template.pipeline.nodes.map(({ id, type }) => ({ id, type })) },
      savedId: null,
    })
  })

  it('refuses a damaged file and leaves the Studio as it was', async () => {
    const drafts = createDraftStore({ tab: memoryStorage(), browser: memoryStorage() })
    const damaged = new File(['{"format": "something else"}'], 'broken.hexlode')
    await expect(openLaunchedPipeline(damaged, drafts)).rejects.toThrow(PipelineFileError)
    expect(drafts.read()).toBeNull()
  })
})
