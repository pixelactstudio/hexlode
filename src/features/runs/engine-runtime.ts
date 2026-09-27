/**
 * The engine's browser resources, created once per page: the OPFS directory, the step cache
 * index and the workers. Temporary run files from earlier visits are deleted on start.
 */
import { GIGABYTE } from '#/features/engine/constants'
import { appDirectory } from '#/features/engine/opfs/files'
import { clearRuns } from '#/features/engine/opfs/run-stores'
import { createStepCacheIndex, type StepCacheIndex } from '#/features/engine/opfs/step-cache'
import { readSettings } from '#/features/settings/settings'

interface Runtime {
  root: FileSystemDirectoryHandle
  index: StepCacheIndex | null
}

let runtime: Promise<Runtime> | undefined

export function engineRuntime() {
  runtime ??= (async () => {
    const root = await appDirectory()
    await clearRuns(root)
    let index: StepCacheIndex | null = null
    try {
      index = await createStepCacheIndex(root, readSettings().stepCacheGigabytes * GIGABYTE)
    } catch {
      index = null
    }
    return { root, index }
  })()
  return runtime
}

export function isEngineSupported() {
  return (
    typeof window !== 'undefined' &&
    typeof Worker !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    typeof navigator.storage?.getDirectory === 'function'
  )
}

/**
 * Why this page cannot run the engine, or null when it can. Browsers turn off the Origin Private
 * File System on plain HTTP from any address but localhost.
 */
export function engineProblem(): 'insecure' | 'unsupported' | null {
  if (typeof window === 'undefined') return null
  if (!window.isSecureContext) return 'insecure'
  return isEngineSupported() ? null : 'unsupported'
}

export function createEngineWorker() {
  return new Worker(new URL('../engine/engine.worker.ts', import.meta.url), { type: 'module' })
}

export function createPreviewWorker() {
  return new Worker(new URL('../previews/preview.worker.ts', import.meta.url), { type: 'module' })
}
