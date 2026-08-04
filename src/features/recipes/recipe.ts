import type { WorkflowCanvasEdge, WorkflowCanvasNode } from '#/features/canvas/types'
import type { ProcessingOptions } from '#/features/processing/types'
import type { Recipe } from '#/features/recipes/types'
import { parseRecipe } from '#/features/recipes/validators'
import { createId } from '#/lib/create-id'

interface CreateRecipeInput {
  edges: WorkflowCanvasEdge[]
  kind?: Recipe['kind']
  name: string
  nodes: WorkflowCanvasNode[]
  options: ProcessingOptions
  renameTemplate: string
}

export function createRecipe({
  edges,
  kind = 'recipe',
  name,
  nodes,
  options,
  renameTemplate,
}: CreateRecipeInput): Recipe {
  const timestamp = new Date().toISOString()

  return parseRecipe({
    schemaVersion: 1,
    id: createId(),
    name,
    kind,
    createdAt: timestamp,
    updatedAt: timestamp,
    execution: { ...options, renameTemplate },
    graph: {
      nodes: nodes.map((node) => ({ id: node.id, kind: node.data.kind })),
      edges: edges.map(({ id, source, target }) => ({ id, source, target })),
    },
    layout: {
      positions: Object.fromEntries(nodes.map(({ id, position }) => [id, position])),
    },
  })
}

export function exportRecipe(recipe: Recipe) {
  return JSON.stringify(parseRecipe(recipe), null, 2)
}

export function importRecipe(source: string) {
  if (source.length > 1024 * 1024) throw new Error('Recipe files must be smaller than 1 MB.')
  return parseRecipe(JSON.parse(source))
}
