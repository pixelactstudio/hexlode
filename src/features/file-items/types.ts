import type { DataFormat, DocumentFormat, Item } from '#/features/engine/types'

/** Data and document items carry their finished file. Nothing after them re-encodes it. */
export interface FilePayload {
  bytes: Uint8Array
}

export type FileItem = Item<FilePayload>

export type FileKind =
  | { kind: 'data'; format: DataFormat }
  | { kind: 'document'; format: DocumentFormat }
