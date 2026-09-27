import { downloadZip } from 'client-zip'

import { createNameResolver } from '#/features/engine/delivery-names'
import type { OutputStore } from '#/features/engine/stores'

/** Keeps delivered files in memory. Used in tests and for single-image quick tool previews. */
export function createMemoryOutputStore(): OutputStore & {
  files(nodeId: string): { name: string; bytes: Uint8Array }[]
} {
  const written = new Map<string, { name: string; bytes: Uint8Array }[]>()
  return {
    async write(nodeId, name, bytes) {
      written.set(nodeId, [...(written.get(nodeId) ?? []), { name, bytes }])
    },
    files: (nodeId) => written.get(nodeId) ?? [],
    async deliver(nodeId) {
      const resolve = createNameResolver()
      const files = (written.get(nodeId) ?? []).map(({ name, bytes }) => ({
        name: resolve(name),
        bytes,
      }))
      const archive =
        files.length > 0
          ? await downloadZip(
              files.map(({ name, bytes }) => ({ name, input: bytes, lastModified: new Date(0) })),
            ).blob()
          : undefined
      return {
        nodeId,
        files: files.map(({ name, bytes }) => ({ name, size: bytes.byteLength })),
        bytes: files.reduce((total, file) => total + file.bytes.byteLength, 0),
        archive,
      }
    },
  }
}
