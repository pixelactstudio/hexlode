/**
 * Serves on-device models from Hexlode's own server (ADR 0017). The first request for a model
 * fetches the pinned file from its upstream revision, checks its size and SHA-256, and keeps it
 * on disk; every later request is answered from disk, with a year of caching since the name
 * changes whenever the file does. Browsers never contact the upstream. Server only.
 */
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, open, rename, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'

import { ON_DEVICE_MODELS } from '#/features/background-removal/constants'
import type { SegmentationModel } from '#/features/background-removal/types'

type ModelFile = Pick<SegmentationModel, 'file' | 'bytes' | 'sha256' | 'upstream'>

export interface ModelServerOptions {
  /** Where fetched models are kept. */
  directory: string
  models: ModelFile[]
  fetch?: typeof fetch
}

/** `HEXLODE_MODEL_DIR`, or a folder in the system's temporary directory. */
export function modelDirectory() {
  return process.env.HEXLODE_MODEL_DIR || join(tmpdir(), 'hexlode-models')
}

export function createModelServer(options: ModelServerOptions) {
  const fetchFile = options.fetch ?? fetch
  const pending = new Map<string, Promise<string>>()

  const kept = async (model: ModelFile, path: string) => {
    try {
      return (await stat(path)).size === model.bytes
    } catch {
      return false
    }
  }

  /** Downloads to a partial file while hashing, and renames it only once it checks out. */
  const fetchModel = async (model: ModelFile, path: string) => {
    await mkdir(options.directory, { recursive: true })
    const partial = `${path}.${process.pid}.partial`
    const response = await fetchFile(model.upstream)
    if (!response.ok || !response.body) throw new Error(`Upstream answered ${response.status}.`)
    const hash = createHash('sha256')
    const file = await open(partial, 'w')
    let size = 0
    try {
      for await (const chunk of Readable.fromWeb(response.body as never)) {
        const bytes = chunk as Uint8Array
        size += bytes.byteLength
        if (size > model.bytes) throw new Error('The model is larger than pinned.')
        hash.update(bytes)
        await file.write(bytes)
      }
    } catch (reason) {
      await file.close()
      await rm(partial, { force: true })
      throw reason
    }
    await file.close()
    if (size !== model.bytes || hash.digest('hex') !== model.sha256) {
      await rm(partial, { force: true })
      throw new Error('The model does not match its pinned checksum.')
    }
    await rename(partial, path)
    return path
  }

  const ensure = (model: ModelFile) => {
    const path = join(options.directory, model.file)
    let entry = pending.get(model.file)
    if (!entry) {
      entry = (async () => ((await kept(model, path)) ? path : fetchModel(model, path)))()
      pending.set(model.file, entry)
      // A failed fetch is tried again on the next request; a kept file is not checked again.
      entry.catch(() => pending.delete(model.file))
    }
    return entry
  }

  return {
    async respond(file: string, request: Request): Promise<Response> {
      const model = options.models.find((candidate) => candidate.file === file)
      if (!model) return new Response('Not found', { status: 404 })
      const etag = `"${model.sha256}"`
      const headers = {
        'cache-control': 'public, max-age=31536000, immutable',
        etag,
      }
      if (request.headers.get('if-none-match') === etag) {
        return new Response(null, { status: 304, headers })
      }
      let path: string
      try {
        path = await ensure(model)
      } catch (reason) {
        console.error('A model could not be fetched:', reason)
        return new Response('The model is not available right now.', {
          status: 502,
          headers: { 'cache-control': 'no-store' },
        })
      }
      const body = Readable.toWeb(createReadStream(path)) as ReadableStream<Uint8Array>
      return new Response(body, {
        headers: {
          ...headers,
          'content-type': 'application/octet-stream',
          'content-length': String(model.bytes),
        },
      })
    },
  }
}

let shared: ReturnType<typeof createModelServer> | undefined

/** The server's one model server, for the pinned models. */
export function modelServer() {
  shared ??= createModelServer({
    directory: modelDirectory(),
    models: Object.values(ON_DEVICE_MODELS),
  })
  return shared
}
