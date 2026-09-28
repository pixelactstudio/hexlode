export type PlannedJob = { index: number; worker: number; start: number; end: number }

/**
 * Hands out jobs the way the engine's worker pool does: every worker starts one at once, and each
 * next job goes to the worker that frees up first, the lowest-numbered one on a tie. Times are in
 * the same unit as `durations`.
 */
export function planWorkers(durations: number[], workers: number): PlannedJob[] {
  const freeAt = Array.from({ length: workers }, () => 0)
  return durations.map((duration, index) => {
    const worker = freeAt.indexOf(Math.min(...freeAt))
    const start = freeAt[worker]
    freeAt[worker] = start + duration
    return { index, worker, start, end: start + duration }
  })
}
