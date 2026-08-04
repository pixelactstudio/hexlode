export interface ProcessingOptions {
  maxDimension: number
  quality: number
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
