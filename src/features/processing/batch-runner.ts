export interface BatchQueueItem<T> {
  id: string
  value: T
}

export interface BatchQueueResult<T> {
  error?: string
  id: string
  result?: T
}

export async function runBatchQueue<TInput, TOutput>(
  items: BatchQueueItem<TInput>[],
  process: (value: TInput) => Promise<TOutput>,
  onItem: (result: BatchQueueResult<TOutput>) => void,
  isCancelled: () => boolean,
) {
  const results: BatchQueueResult<TOutput>[] = []

  for (const item of items) {
    if (isCancelled()) break

    let result: BatchQueueResult<TOutput>
    try {
      result = { id: item.id, result: await process(item.value) }
    } catch (reason) {
      if (isCancelled()) break
      result = {
        id: item.id,
        error: reason instanceof Error ? reason.message : 'The image could not be processed.',
      }
    }
    results.push(result)
    onItem(result)
  }

  return results
}
