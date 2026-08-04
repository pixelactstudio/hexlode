export interface ProcessingOptions {
  format: OutputFormat
  maxDimension: number
  quality: number
}

export type OutputFormat = 'jpeg' | 'png' | 'webp'

export interface ProcessedImage {
  durationMs: number
  format: OutputFormat
  height: number
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
  outputName: string
  size: number
  warnings: string[]
  width: number
}

export type BatchItemStatus = 'cancelled' | 'complete' | 'failed' | 'processing' | 'ready'

export interface BatchItem {
  error?: string
  file: File
  id: string
  info: import('#/features/image-input/types').ImageInfo
  output?: ProcessedImage
  progress: number
  relativePath: string
  status: BatchItemStatus
}

export interface TournamentResult extends ProcessedImage {
  compatibility: string
  transparency: 'flattened' | 'preserved'
}

export interface ProcessingPlan {
  width: number
  height: number
  estimatedPeakBytes: number
}

export interface ProcessingWorker {
  onerror: ((event: ErrorEvent) => void) | null
  onmessage: ((event: MessageEvent<unknown>) => void) | null
  postMessage(message: unknown, transfer: Transferable[]): void
  terminate(): void
}

export type ProcessingWorkerFactory = () => ProcessingWorker

export type ProcessingErrorCode =
  | 'cancelled'
  | 'decode_failed'
  | 'encode_failed'
  | 'invalid_message'
  | 'unsupported_browser'
  | 'worker_failed'
