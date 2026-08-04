import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createInitialCanvas } from '#/features/canvas/canvas-model'
import { createRecipe, exportRecipe, importRecipe } from '#/features/recipes/recipe'

describe('recipes', () => {
  it('round-trips execution and visual layout through versioned JSON', () => {
    const canvas = createInitialCanvas()
    const recipe = createRecipe({
      ...canvas,
      name: 'Web-ready photos',
      options: { format: 'webp', maxDimension: 1920, quality: 82 },
      renameTemplate: '{name}',
    })
    const imported = importRecipe(exportRecipe(recipe))

    assert.deepEqual(imported.execution, recipe.execution)
    assert.deepEqual(imported.layout, recipe.layout)
  })

  it('rejects unknown schema versions', () => {
    assert.throws(() => importRecipe('{"schemaVersion":2}'))
  })
})
