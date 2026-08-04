import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { solveQualityConstraint } from '#/features/processing/constraint-solver'

describe('constraint solver', () => {
  it('finds the highest quality under the byte limit with bounded work', async () => {
    const result = await solveQualityConstraint(
      8_000,
      async (quality) => quality * 100,
      () => false,
    )

    assert.equal(result.best?.quality, 80)
    assert.ok(result.attempts.length <= 7)
  })
})
