import {
  DEFAULT_DEVICE_MEMORY_GB,
  MEMORY_SHARE_FOR_WORKERS,
  WORKER_MEMORY_PER_DECODED_BYTE,
} from '#/features/engine/constants'

export interface DeviceProfile {
  cores: number
  deviceMemoryGb: number
  /** Decoded size of the largest item in the run. */
  largestDecodeBytes: number
}

/** Workers for a run: one per core but one, fewer when the largest items would not fit. */
export function choosePoolSize({ cores, deviceMemoryGb, largestDecodeBytes }: DeviceProfile) {
  const byCores = Math.max(1, cores - 1)
  const budget = deviceMemoryGb * 1024 ** 3 * MEMORY_SHARE_FOR_WORKERS
  const perWorker = Math.max(1, largestDecodeBytes * WORKER_MEMORY_PER_DECODED_BYTE)
  return Math.max(1, Math.min(byCores, Math.floor(budget / perWorker)))
}

export function deviceProfile(largestDecodeBytes: number): DeviceProfile {
  const nav = typeof navigator === 'undefined' ? undefined : navigator
  return {
    cores: nav?.hardwareConcurrency ?? 4,
    deviceMemoryGb:
      (nav as (Navigator & { deviceMemory?: number }) | undefined)?.deviceMemory ??
      DEFAULT_DEVICE_MEMORY_GB,
    largestDecodeBytes,
  }
}
