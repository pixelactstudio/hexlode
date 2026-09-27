import type { z } from 'zod'

import type { NodeDefinition } from '#/features/engine/types'

type Spec<S extends Record<string, unknown>> = Omit<
  NodeDefinition<S>,
  'defaults' | 'parseSettings' | 'version' | 'hasInput' | 'mode' | 'cacheable'
> &
  Partial<Pick<NodeDefinition<S>, 'version' | 'hasInput' | 'mode' | 'cacheable'>> & {
    schema: z.ZodType<S>
  }

/** Builds a node definition whose settings are parsed, and defaulted, by a zod schema. */
export function defineNode<S extends Record<string, unknown>>(spec: Spec<S>): NodeDefinition<S> {
  const { schema, ...rest } = spec
  return {
    version: 1,
    hasInput: true,
    mode: 'each',
    cacheable: true,
    ...rest,
    defaults: schema.parse({}),
    parseSettings: (value) => schema.parse(value ?? {}),
  }
}
