import { z } from 'zod'

import { processingOptionsSchema } from '#/features/processing/validators'

const positionSchema = z.object({ x: z.number().finite(), y: z.number().finite() }).strict()
const workflowKindSchema = z.enum(['files', 'inspect', 'resize', 'encode', 'compare', 'download'])

export const recipeSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().min(1).max(120),
    name: z.string().trim().min(1).max(80),
    kind: z.enum(['macro', 'recipe']),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    execution: processingOptionsSchema.extend({ renameTemplate: z.string().min(1).max(80) }),
    graph: z
      .object({
        nodes: z.array(z.object({ id: z.string().min(1), kind: workflowKindSchema }).strict()),
        edges: z.array(
          z
            .object({
              id: z.string().min(1),
              source: z.string().min(1),
              target: z.string().min(1),
            })
            .strict(),
        ),
      })
      .strict(),
    layout: z.object({ positions: z.record(z.string(), positionSchema) }).strict(),
  })
  .strict()

export function parseRecipe(value: unknown) {
  return recipeSchema.parse(value)
}
