import { z } from 'zod'
import { ALL_IMAGE_TYPES, OUTPUT_PORT } from '#/features/nodes/constants'
import { defineNode } from '#/features/nodes/define-node'

export const filesNode = defineNode({
  type: 'files',
  label: 'Files',
  category: 'input',
  description: 'Takes dropped files or a folder. Starts every pipeline.',
  hasInput: false,
  schema: z.object({}),
  ports: () => OUTPUT_PORT,
  accepts: () => new Set(),
  produces: () => ALL_IMAGE_TYPES,
  async run() {
    throw new Error('Files has no input to process.')
  },
})
