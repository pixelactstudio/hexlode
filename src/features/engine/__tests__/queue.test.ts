import { describe, expect, it } from 'vitest'

import { createNameResolver } from '#/features/engine/delivery-names'
import { runQueue } from '#/features/engine/queue'

describe('runQueue', () => {
  it('keeps processing when one task fails', async () => {
    const completed: number[] = []
    const errors = await runQueue(
      [1, 2, 3],
      1,
      async (value) => {
        if (value === 2) throw new Error('Corrupt image')
        completed.push(value)
      },
      () => false,
    )
    expect(completed).toEqual([1, 3])
    expect(errors).toHaveLength(1)
  })

  it('never runs more tasks at once than the concurrency', async () => {
    let active = 0
    let peak = 0
    await runQueue(
      Array.from({ length: 10 }, (_, index) => index),
      3,
      async () => {
        active += 1
        peak = Math.max(peak, active)
        await new Promise((resolve) => setTimeout(resolve, 2))
        active -= 1
      },
      () => false,
    )
    expect(peak).toBe(3)
  })
})

describe('createNameResolver', () => {
  it('numbers duplicate names and keeps folders', () => {
    const resolve = createNameResolver()
    expect(
      ['photo.webp', 'Photo.webp', 'trip/a.png', 'trip/a.png', '../x?.jpg'].map(resolve),
    ).toEqual(['photo.webp', 'Photo-2.webp', 'trip/a.png', 'trip/a-2.png', 'x-.jpg'])
  })
})
