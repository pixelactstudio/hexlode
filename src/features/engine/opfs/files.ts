/**
 * Small helpers over the Origin Private File System. Inside workers, files are written with
 * synchronous access handles; elsewhere with writable streams.
 */

declare const WorkerGlobalScope: { new (): unknown } | undefined

const APP_DIRECTORY = 'hexlode'

interface SyncAccessHandle {
  read(buffer: Uint8Array, options?: { at: number }): number
  write(buffer: Uint8Array, options?: { at: number }): number
  truncate(size: number): void
  getSize(): number
  flush(): void
  close(): void
}

function syncHandle(handle: FileSystemFileHandle) {
  const create = (handle as unknown as { createSyncAccessHandle?: () => Promise<SyncAccessHandle> })
    .createSyncAccessHandle
  return inWorker() && create ? () => create.call(handle) : undefined
}

function inWorker() {
  return typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope
}

export async function appDirectory() {
  const root = await navigator.storage.getDirectory()
  return root.getDirectoryHandle(APP_DIRECTORY, { create: true })
}

export async function directoryAt(
  root: FileSystemDirectoryHandle,
  path: string[],
  create = true,
): Promise<FileSystemDirectoryHandle | undefined> {
  let directory = root
  for (const name of path) {
    try {
      directory = await directory.getDirectoryHandle(name, { create })
    } catch (reason) {
      if (!create && reason instanceof DOMException && reason.name === 'NotFoundError') {
        return undefined
      }
      throw reason
    }
  }
  return directory
}

async function fileHandle(directory: FileSystemDirectoryHandle, name: string, create: boolean) {
  try {
    return await directory.getFileHandle(name, { create })
  } catch (reason) {
    if (reason instanceof DOMException && reason.name === 'NotFoundError') return undefined
    throw reason
  }
}

export async function writeFile(
  directory: FileSystemDirectoryHandle,
  name: string,
  parts: Uint8Array[],
): Promise<number> {
  const handle = (await fileHandle(directory, name, true)) as FileSystemFileHandle
  let written = 0
  const openSync = syncHandle(handle)
  if (openSync) {
    const access = await openSync()
    try {
      access.truncate(0)
      for (const part of parts) written += access.write(part, { at: written })
      access.flush()
    } finally {
      access.close()
    }
    return written
  }
  const writable = await handle.createWritable()
  try {
    for (const part of parts) {
      await writable.write(part as Uint8Array<ArrayBuffer>)
      written += part.byteLength
    }
    await writable.close()
  } catch (reason) {
    await writable.abort(reason).catch(() => undefined)
    throw reason
  }
  return written
}

/** Reads `length` bytes from `start`, or the whole file. Undefined when the file is missing. */
export async function readFile(
  directory: FileSystemDirectoryHandle,
  name: string,
  start = 0,
  length?: number,
): Promise<Uint8Array | undefined> {
  const handle = await fileHandle(directory, name, false)
  if (!handle) return undefined
  const openSync = syncHandle(handle)
  if (openSync) {
    const access = await openSync()
    try {
      const size = access.getSize()
      const count = Math.max(0, Math.min(length ?? size - start, size - start))
      const bytes = new Uint8Array(count)
      access.read(bytes, { at: start })
      return bytes
    } finally {
      access.close()
    }
  }
  const file = await handle.getFile()
  const end = length === undefined ? file.size : start + length
  return new Uint8Array(await file.slice(start, end).arrayBuffer())
}

export async function fileOf(directory: FileSystemDirectoryHandle, name: string) {
  const handle = await fileHandle(directory, name, false)
  return handle ? handle.getFile() : undefined
}

export async function removeEntry(
  directory: FileSystemDirectoryHandle,
  name: string,
  recursive = false,
) {
  try {
    await directory.removeEntry(name, { recursive })
    return true
  } catch (reason) {
    if (reason instanceof DOMException && reason.name === 'NotFoundError') return true
    return false
  }
}

export async function listNames(directory: FileSystemDirectoryHandle) {
  const names: string[] = []
  for await (const name of (directory as unknown as { keys(): AsyncIterable<string> }).keys()) {
    names.push(name)
  }
  return names
}
