import { describe, expect, it } from 'vitest'

import { productRegistry } from '#/features/nodes/registry'
import { TEMPLATES } from '#/features/pipelines/templates'
import { createStudioStore } from '#/features/studio/studio-store'

function blank() {
  const store = createStudioStore(productRegistry)
  store.load({ name: 'Untitled pipeline', pipeline: TEMPLATES[1].pipeline })
  return store
}

const at = { x: 0, y: 0 }

describe('studio store', () => {
  it('adds nodes with default settings and allows only one Files node', () => {
    const store = blank()
    const id = store.addNode('resize', at)
    expect(store.getState().pipeline.nodes.find((node) => node.id === id)?.settings).toEqual({})
    expect(store.addNode('files', at)).toBeNull()
    expect(store.getState().pipeline.nodes.filter((node) => node.type === 'files')).toHaveLength(1)
  })

  it('connects compatible nodes, labels narrowing ones and refuses the rest', () => {
    const store = blank()
    const convert = store.addNode('convert', at) as string
    const optimize = store.addNode('optimize-png', at) as string
    expect(store.connect({ source: 'files', sourcePort: 'out', target: convert })).toEqual({
      status: 'ok',
    })
    expect(store.connect({ source: convert, sourcePort: 'out', target: optimize })).toMatchObject({
      status: 'refused',
      message: 'Optimize PNG needs PNG images. Add Convert to PNG before it.',
    })
    expect(store.connect({ source: 'files', sourcePort: 'out', target: optimize })).toMatchObject({
      status: 'narrows',
      label: 'PNG only',
    })
    expect(store.getState().pipeline.connections).toHaveLength(2)
    expect(store.getState().checks[store.getState().pipeline.connections[1].id]).toMatchObject({
      status: 'narrows',
    })
  })

  it('removes a node with its connections but never removes Files', () => {
    const store = blank()
    const resize = store.addNode('resize', at) as string
    store.connect({ source: 'files', sourcePort: 'out', target: resize })
    store.removeNodes(['files', resize])
    expect(store.getState().pipeline.nodes.map((node) => node.type)).toEqual(['files'])
    expect(store.getState().pipeline.connections).toEqual([])
  })

  it('undoes and redoes changes', () => {
    const store = blank()
    const resize = store.addNode('resize', at) as string
    store.updateSettings(resize, { mode: 'percent', percent: 25 })
    store.undo()
    expect(store.getState().pipeline.nodes.find((node) => node.id === resize)?.settings).toEqual({})
    store.undo()
    expect(store.getState().pipeline.nodes).toHaveLength(1)
    store.redo()
    store.redo()
    expect(store.getState().pipeline.nodes.find((node) => node.id === resize)?.settings).toEqual({
      mode: 'percent',
      percent: 25,
    })
    expect(store.getState().canRedo).toBe(false)
  })

  it('folds quick settings edits of one node into one undo step', () => {
    const store = blank()
    const resize = store.addNode('resize', at) as string
    store.updateSettings(resize, { percent: 10 })
    store.updateSettings(resize, { percent: 20 })
    store.updateSettings(resize, { percent: 30 })
    store.undo()
    expect(store.getState().pipeline.nodes.find((node) => node.id === resize)?.settings).toEqual({})
  })

  it('refreshes connection checks when settings change what a node produces', () => {
    const store = blank()
    const convert = store.addNode('convert', at) as string
    const optimize = store.addNode('optimize-png', at) as string
    store.updateSettings(convert, { format: 'png' })
    store.connect({ source: 'files', sourcePort: 'out', target: convert })
    store.connect({ source: convert, sourcePort: 'out', target: optimize })
    store.updateSettings(convert, { format: 'webp' })
    const connection = store.getState().pipeline.connections.find((c) => c.target === optimize)
    expect(store.getState().checks[connection?.id as string]).toMatchObject({ status: 'refused' })
  })

  it('marks the pipeline dirty until it is saved', () => {
    const store = blank()
    expect(store.getState().dirty).toBe(false)
    store.addNode('inspect', at)
    expect(store.getState().dirty).toBe(true)
    store.markSaved('id-1', 'Mine')
    expect(store.getState()).toMatchObject({ dirty: false, savedId: 'id-1', name: 'Mine' })
  })
})
