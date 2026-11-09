import { Button } from '@astryxdesign/core/Button'
import { Link } from '@astryxdesign/core/Link'
import { HStack, VStack } from '@astryxdesign/core/Stack'
import { Text } from '@astryxdesign/core/Text'
import { useNavigate } from '@tanstack/react-router'
import { useCallback, useRef } from 'react'

import { builtInToolProblem } from '#/features/built-in-tools/tools'
import type { BuiltInTool } from '#/features/built-in-tools/types'
import type { Pipeline } from '#/features/engine/types'
import { openInStudio } from '#/features/pipeline-tools/open-in-studio'
import { PipelineToolBody } from '#/features/pipeline-tools/pipeline-tool-page'
import { ToolPageFrame } from '#/features/quick-tools/quick-tool-page'
import { usePageView } from '#/features/usage/use-page-view'

const CHECKED_DATE = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

/** A built-in tool at `/tools/<slug>`, rendered on the server with the tool in place. */
export function BuiltInToolPage({ tool }: { tool: BuiltInTool }) {
  usePageView({ page: 'built-in-tool', builtInTool: tool.slug })
  const navigate = useNavigate()
  // The pipeline as the page's settings have changed it, for Open in the Studio.
  const current = useRef<Pipeline>(tool.pipeline)
  const track = useCallback((pipeline: Pipeline) => {
    current.current = pipeline
  }, [])
  const problem = useCallback((pipeline: Pipeline) => builtInToolProblem(tool, pipeline), [tool])
  return (
    <ToolPageFrame
      title={tool.heading}
      eyebrow="Ready-made tool"
      description={
        <VStack gap={2}>
          <HStack gap={3} vAlign="center" wrap="wrap">
            <Text type="large" color="secondary" weight="normal">
              {tool.description}
            </Text>
            <Button
              label="Open in the Studio"
              size="sm"
              variant="ghost"
              onClick={() => {
                openInStudio({ name: tool.name, pipeline: current.current })
                void navigate({ to: '/studio', search: { pipeline: undefined } })
              }}
            />
          </HStack>
          {tool.guidance ? (
            <Text type="supporting" color="secondary">
              Sizes follow{' '}
              <Link href={tool.guidance.url} isExternalLink>
                {tool.guidance.label}
              </Link>
              , checked {CHECKED_DATE.format(new Date(tool.guidance.checked))}.
            </Text>
          ) : null}
        </VStack>
      }
    >
      <PipelineToolBody
        path={`/tools/${tool.slug}`}
        pipeline={tool.pipeline}
        surface="built-in-tool"
        builtInTool={tool.slug}
        adjustable={tool.adjustable}
        problem={problem}
        onPipelineChange={track}
      />
    </ToolPageFrame>
  )
}
