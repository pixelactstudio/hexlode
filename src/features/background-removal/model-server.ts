/**
 * Serves on-device models from Hexlode's own server (ADR 0017). The first request for a model
 * fetches the pinned file from its upstream revision, checks its size and SHA-256, and keeps it
 * on disk; every later request is answered from disk, with a year of caching since the name
 * changes whenever the file does. Browsers never contact the upstream. Server only.
 */
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { lstat, mkdir, open, rename, rm, stat } from 'node:fs/promises'
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

/** Group and others may write: anyone with that access could swap the files the server sends. */
const WRITABLE_BY_OTHERS = 0o022

/**
 * Makes the model folder, only for the server's own user, and refuses one that is a link, belongs
 * to another user or others can write to: the server sends what is in it to every visitor, and the
 * default folder sits in the shared temporary directory.
 */
async function privateFolder(directory: string) {
  await mkdir(directory, { recursive: true, mode: 0o700 })
  const folder = await lstat(directory)
  const ownUser = typeof process.getuid === 'function' ? process.getuid() : folder.uid
  const posix = process.platform !== 'win32'
  if (
    !folder.isDirectory() ||
    folder.uid !== ownUser ||
    (posix && (folder.mode & WRITABLE_BY_OTHERS) !== 0)
  ) {
    throw new Error(
      `The model folder ${directory} must belong to the server's user and not be writable by others. Set HEXLODE_MODEL_DIR to such a folder.`,
    )
  }
}

/** The SHA-256 of a file, as hex, or undefined when there is no such file. */
async function fileHash(path: string) {
  try {
    const hash = createHash('sha256')
    for await (const chunk of createReadStream(path)) hash.update(chunk as Uint8Array)
    return hash.digest('hex')
  } catch {
    return undefined
  }
}

export function createModelServer(options: ModelServerOptions) {
  const fetchFile = options.fetch ?? fetch
  const pending = new Map<string, Promise<string>>()

  /** Whether the folder already holds the pinned file, checked by its hash, not only its size. */
  const kept = async (model: ModelFile, path: string) => {
    try {
      if ((await stat(path)).size !== model.bytes) return false
    } catch {
      return false
    }
    return (await fileHash(path)) === model.sha256
  }

  /** Downloads to a partial file while hashing, and renames it only once it checks out. */
  const fetchModel = async (model: ModelFile, path: string) => {
    const partial = `${path}.${process.pid}.partial`
    const response = await fetchFile(model.upstream)
    if (!response.ok || !response.body) throw new Error(`Upstream answered ${response.status}.`)
    const hash = createHash('sha256')
    // A new file only the server's user can read or write, never one already there or a link.
    await rm(partial, { force: true })
    const file = await open(partial, 'wx', 0o600)
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

  /** The kept file's path, checked once per process; a failure is tried again on the next request. */
  const ensure = (model: ModelFile) => {
    const path = join(options.directory, model.file)
    let entry = pending.get(model.file)
    if (!entry) {
      entry = (async () => {
        await privateFolder(options.directory)
        return (await kept(model, path)) ? path : fetchModel(model, path)
      })()
      pending.set(model.file, entry)
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
