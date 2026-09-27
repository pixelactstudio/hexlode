import { Icon } from '@astryxdesign/core/Icon'
import { HStack } from '@astryxdesign/core/Stack'
import { Token } from '@astryxdesign/core/Token'
import { ChevronRight } from 'lucide-react'
import { Fragment } from 'react'

import type { NodeRegistry, Pipeline } from '#/features/engine/types'
import { pipelineSteps } from '#/features/studio/node-summary'
import { NODE_ICONS, toneOf } from '#/features/studio/node-ui'

export function PipelineSteps({
  pipeline,
  registry,
}: {
  pipeline: Pipeline
  registry: NodeRegistry
}) {
  const steps = pipelineSteps(pipeline)
  return (
    <HStack gap={1} vAlign="center" wrap="wrap">
      {steps.map((step, index) => {
        const definition = registry.get(step.type)
        const icon = NODE_ICONS[step.type]
        return (
          <Fragment key={step.type}>
            {index > 0 ? <Icon icon={ChevronRight} size="sm" color="secondary" /> : null}
            <Token
              size="sm"
              color={toneOf(definition?.category)}
              icon={icon ? <Icon icon={icon} size="sm" color="inherit" /> : undefined}
              label={`${definition?.label ?? step.type}${step.count > 1 ? ` ×${step.count}` : ''}`}
            />
          </Fragment>
        )
      })}
    </HStack>
  )
}
