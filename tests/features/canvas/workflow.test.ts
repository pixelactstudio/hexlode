import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  compileWorkflow,
  createStarterGraph,
  getConnectionIssue,
} from '#/features/canvas/workflow/graph'

describe('workflow graph', () => {
  it('compiles the starter graph in execution order', () => {
    const graph = createStarterGraph()
    assert.deepEqual(compileWorkflow(graph.nodes, graph.edges), [
      'files',
      'inspect',
      'resize',
      'webp',
      'compare',
      'download',
    ])
  })

  it('rejects incompatible and branching connections', () => {
    const graph = createStarterGraph()
    assert.equal(
      getConnectionIssue({ source: 'files', target: 'resize' }, graph.nodes, []),
      'Files connects only to Inspect.',
    )
    assert.equal(
      getConnectionIssue({ source: 'files', target: 'inspect' }, graph.nodes, graph.edges),
      'Files already has an output connection.',
    )
  })

  it('does not compile a graph with a missing node or edge', () => {
    const graph = createStarterGraph()
    assert.throws(() => compileWorkflow(graph.nodes.slice(1), graph.edges))
    assert.throws(() => compileWorkflow(graph.nodes, graph.edges.slice(1)))
  })
})
