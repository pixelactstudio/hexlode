import { describe, expect, it } from 'vitest'

import { workerRequestSchema, workerResponseSchema } from '#/features/engine/worker-protocol'

describe('worker protocol', () => {
  it('accepts a source request carrying a file and rejects one without', () => {
    const request = {
      type: 'source',
      taskId: 't1',
      source: {
        index: 0,
        key: 'k',
        meta: { kind: 'image', format: 'png', name: 'a.png', source: { size: 1, format: 'png' } },
        file: new Blob([new Uint8Array(1)]),
      },
    }
    expect(workerRequestSchema.safeParse(request).success).toBe(true)
    expect(
      workerRequestSchema.safeParse({ ...request, source: { ...request.source, file: 'a.png' } })
        .success,
    ).toBe(false)
  })

  it('rejects malformed worker responses', () => {
    expect(
      workerResponseSchema.safeParse({ type: 'cache-stored', key: 'k', bytes: -1, entry: {} })
        .success,
    ).toBe(false)
    expect(workerResponseSchema.safeParse({ type: 'done' }).success).toBe(false)
  })
})
