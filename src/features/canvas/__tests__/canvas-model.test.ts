import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  createInitialCanvas,
  getCanvasConnectionIssue,
  selectCanvasNode,
} from '#/features/canvas/canvas-model'

describe('canvas connection validation', () => {
  it('uses current edges while excluding the edge being reconnected', () => {
    const canvas = createInitialCanvas()
    const connection = { source: 'files', target: 'inspect' }

    assert.equal(
      getCanvasConnectionIssue(connection, canvas.nodes, canvas.edges),
      'Files already has an output connection.',
    )
    assert.equal(
      getCanvasConnectionIssue(connection, canvas.nodes, canvas.edges, 'files-inspect'),
      null,
    )
  })
})

describe('canvas node selection', () => {
  it('selects one workflow step and clears the previous selection', () => {
    const canvas = createInitialCanvas()
    const selected = selectCanvasNode(canvas.nodes, 'download')

    assert.deepEqual(
      selected.filter((node) => node.selected).map((node) => node.id),
      ['download'],
    )
  })
})
