import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { runBatchQueue } from '#/features/processing/batch-runner'
import { createOutputNames } from '#/features/processing/output'

describe('batch processing', () => {
  it('keeps successful results when another file fails', async () => {
    const completed: string[] = []
    const results = await runBatchQueue(
      [
        { id: 'one', value: 1 },
        { id: 'bad', value: 2 },
        { id: 'three', value: 3 },
      ],
      async (value) => {
        if (value === 2) throw new Error('Corrupt image')
        return value * 2
      },
      ({ id }) => completed.push(id),
      () => false,
    )

    assert.deepEqual(completed, ['one', 'bad', 'three'])
    assert.deepEqual(
      results.map(({ result }) => result),
      [2, undefined, 6],
    )
  })

  it('resolves naming collisions deterministically', () => {
    assert.deepEqual(createOutputNames(['photo.png', 'photo.jpg'], 'webp'), [
      'photo.webp',
      'photo-2.webp',
    ])
    assert.deepEqual(createOutputNames(['a.png'], 'jpeg', '{index}-{name}'), ['01-a.jpg'])
  })
})
