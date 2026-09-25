import { AppShell } from '@astryxdesign/core/AppShell'
import { Center } from '@astryxdesign/core/Center'
import { Link } from '@astryxdesign/core/Link'
import { HStack, VStack } from '@astryxdesign/core/Stack'
import { Heading, Text } from '@astryxdesign/core/Text'
import { createFileRoute } from '@tanstack/react-router'
import { useSyncExternalStore } from 'react'

import { usePageView } from '#/features/analytics/use-page-view'
import { HexlodeMark } from '#/features/app-shell/hexlode-mark'
import { pipelineStore } from '#/features/pipelines/storage'
import { QUICK_TOOL_DEFINITIONS } from '#/features/quick-tools/tools'

export const Route = createFileRoute('/')({ component: Home })

const NO_PIPELINES: never[] = []

function Home() {
  usePageView({ page: 'home' })
  const store = pipelineStore()
  const saved = useSyncExternalStore(store.subscribe, store.list, () => NO_PIPELINES)
  return (
    <AppShell height="fill" variant="surface">
      <Center height="100%">
        <VStack gap={8} hAlign="start" width={320}>
          <HStack gap={2} vAlign="center">
            <HexlodeMark size="lg" />
            <Heading level={1}>Hexlode</Heading>
          </HStack>
          <VStack gap={3} as="nav">
            {Object.values(QUICK_TOOL_DEFINITIONS).map((tool) => (
              <Link key={tool.path} href={tool.path} isStandalone>
                {tool.title}
              </Link>
            ))}
            <Link href="/studio" isStandalone>
              Studio
            </Link>
          </VStack>
          {saved.length > 0 ? (
            <VStack gap={3} as="nav">
              <Text type="supporting">Your pipeline tools</Text>
              {saved.map((pipeline) => (
                <Link key={pipeline.id} href={`/tools/${pipeline.id}`} isStandalone>
                  {pipeline.name}
                </Link>
              ))}
            </VStack>
          ) : null}
          <Link href="/privacy" isStandalone>
            <Text type="supporting">Privacy</Text>
          </Link>
        </VStack>
      </Center>
    </AppShell>
  )
}
