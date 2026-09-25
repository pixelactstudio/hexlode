import { downloadZip } from 'client-zip'

import { createNameResolver } from '#/features/engine/delivery-names'
import {
  directoryAt,
  fileOf,
  listNames,
  readFile,
  removeEntry,
  writeFile,
} from '#/features/engine/opfs/files'
import { decodeBlob, decodeHeader, encodeRecord } from '#/features/engine/opfs/record-file'
import type { OutputStore, SpillStore } from '#/features/engine/stores'
import { compareOrder } from '#/features/engine/stores'
import type { Delivery, Item, ItemMeta, OutputSink } from '#/features/engine/types'

export const RUNS_PATH = ['runs']

export function runPath(runId: string) {
  return [...RUNS_PATH, runId]
}

/** Deletes files of earlier runs. Called when a run starts and on each visit. */
export async function clearRuns(root: FileSystemDirectoryHandle, keep?: string) {
  const runs = await directoryAt(root, RUNS_PATH)
  if (!runs) return
  for (const name of await listNames(runs)) {
    if (name !== keep) await removeEntry(runs, name, true)
  }
}

let sequence = 0

export interface WrittenOutput {
  nodeId: string
  name: string
  file: string
  size: number
}

/** Worker side of Output nodes: saves each item's bytes to OPFS and reports it. */
export function createOpfsOutputSink(
  root: FileSystemDirectoryHandle,
  runId: string,
  report: (written: WrittenOutput) => void,
): OutputSink {
  const prefix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  return {
    async write(nodeId, name, bytes) {
      const directory = (await directoryAt(root, [
        ...runPath(runId),
        'output',
        nodeId,
      ])) as FileSystemDirectoryHandle
      sequence += 1
      const file = `${prefix}-${sequence}.bin`
      const size = await writeFile(directory, file, [bytes])
      report({ nodeId, name, file, size })
    },
  }
}

export interface FolderTarget {
  getDirectoryHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<FileSystemDirectoryHandle>
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>
}

/**
 * Main-thread side of Output nodes. Records what workers saved and builds each delivery by
 * streaming a ZIP from OPFS into OPFS, so the browser receives a file backed by storage.
 */
export function createOpfsOutputStore(
  root: FileSystemDirectoryHandle,
  runId: string,
  options: { folders?: Map<string, FolderTarget>; archiveNames?: Map<string, string> } = {},
): OutputStore & { record(written: WrittenOutput): void } {
  const written = new Map<string, WrittenOutput[]>()
  const outputDirectory = (nodeId: string) =>
    directoryAt(root, [...runPath(runId), 'output', nodeId]) as Promise<FileSystemDirectoryHandle>

  return {
    record(entry) {
      written.set(entry.nodeId, [...(written.get(entry.nodeId) ?? []), entry])
    },
    async write() {
      throw new Error('Workers write output files; the main thread only records them.')
    },
    async deliver(nodeId): Promise<Delivery> {
      const entries = written.get(nodeId) ?? []
      const resolve = createNameResolver()
      const directory = await outputDirectory(nodeId)
      const files = await Promise.all(
        entries.map(async (entry) => ({
          name: resolve(entry.name),
          file: (await fileOf(directory, entry.file)) as File,
          stored: entry.file,
        })),
      )
      const summary = files.map(({ name, file }) => ({ name, size: file.size }))
      const bytes = summary.reduce((total, file) => total + file.size, 0)
      const folder = options.folders?.get(nodeId)
      if (folder) {
        for (const { name, file } of files) await copyToFolder(folder, name, file)
        for (const { stored } of files) await removeEntry(directory, stored)
        return { nodeId, files: summary, bytes }
      }
      if (files.length === 0) return { nodeId, files: summary, bytes }
      const deliveries = (await directoryAt(root, [
        ...runPath(runId),
        'deliveries',
      ])) as FileSystemDirectoryHandle
      const zipName = `${nodeId}.zip`
      const handle = await deliveries.getFileHandle(zipName, { create: true })
      const writable = await handle.createWritable()
      const zip = downloadZip(
        files.map(({ name, file }) => ({ name, input: file, lastModified: file.lastModified })),
      )
      await (zip.body as ReadableStream<Uint8Array>).pipeTo(writable)
      const archive = await handle.getFile()
      // The ZIP now holds the items; the single files are no longer needed.
      for (const { stored } of files) await removeEntry(directory, stored)
      const archiveName = options.archiveNames?.get(nodeId) ?? 'hexlode'
      return {
        nodeId,
        files: summary,
        bytes,
        archive: new File([archive], `${archiveName}.zip`, { type: 'application/zip' }),
      }
    },
  }
}

async function copyToFolder(root: FolderTarget, path: string, file: File) {
  const segments = path.split('/')
  const leaf = segments.pop() as string
  let directory = root
  for (const segment of segments)
    directory = await directory.getDirectoryHandle(segment, { create: true })
  const handle = await directory.getFileHandle(leaf, { create: true })
  const writable = await handle.createWritable()
  await file.stream().pipeTo(writable)
}

interface SpillHeader {
  order: number[]
  meta: ItemMeta
}

/** Items waiting at combining nodes, stored per run in OPFS so any worker can read them. */
export function createOpfsSpillStore(
  root: FileSystemDirectoryHandle,
  runId: string,
  storable: (item: Item) => unknown,
): SpillStore {
  const directory = (nodeId: string) =>
    directoryAt(root, [...runPath(runId), 'spill', nodeId]) as Promise<FileSystemDirectoryHandle>
  const reader = (dir: FileSystemDirectoryHandle, key: string) => (start: number, length: number) =>
    readFile(dir, `${key}.bin`, start, length)
  return {
    async put(nodeId, order, key, item) {
      const { parts } = encodeRecord<SpillHeader>({ order, meta: item.meta }, [storable(item)])
      await writeFile(await directory(nodeId), `${key}.bin`, parts)
    },
    async list(nodeId) {
      const dir = await directory(nodeId)
      const entries: { key: string; order: number[] }[] = []
      for (const name of await listNames(dir)) {
        const key = name.replace(/\.bin$/, '')
        const record = await decodeHeader<SpillHeader>(reader(dir, key))
        if (record) entries.push({ key, order: record.header.order })
      }
      return entries.sort((a, b) => compareOrder(a.order, b.order))
    },
    async load(nodeId, key) {
      const dir = await directory(nodeId)
      const read = reader(dir, key)
      const record = await decodeHeader<SpillHeader>(read)
      if (!record) throw new Error('The waiting item is missing.')
      return { meta: record.header.meta, payload: await decodeBlob(record, 0, read) }
    },
  }
}
