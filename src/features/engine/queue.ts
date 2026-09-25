/**
 * Runs tasks with bounded concurrency, in order of the input. A failed task does not stop the
 * others. Stops starting new tasks once `shouldStop` returns true.
 */
export async function runQueue<T>(
  items: readonly T[],
  concurrency: number,
  process: (item: T) => Promise<void>,
  shouldStop: () => boolean,
) {
  let next = 0
  const errors: unknown[] = []
  const lane = async () => {
    while (next < items.length && !shouldStop()) {
      const item = items[next]
      next += 1
      try {
        await process(item)
      } catch (reason) {
        errors.push(reason)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, lane))
  return errors
}
