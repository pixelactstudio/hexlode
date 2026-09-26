import { Badge } from '@astryxdesign/core/Badge'
import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { Center } from '@astryxdesign/core/Center'
import { ClickableCard } from '@astryxdesign/core/ClickableCard'
import { Grid } from '@astryxdesign/core/Grid'
import { Icon } from '@astryxdesign/core/Icon'
import { Link } from '@astryxdesign/core/Link'
import { HStack, VStack } from '@astryxdesign/core/Stack'
import { Heading, Text } from '@astryxdesign/core/Text'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowRight, Check, Workflow } from 'lucide-react'
import { useSyncExternalStore } from 'react'

import { usePageView } from '#/features/analytics/use-page-view'
import { AppFrame } from '#/features/app-shell/app-frame'
import { IconTile } from '#/features/app-shell/icon-tile'
import { productRegistry } from '#/features/nodes/registry'
import { pipelineStore } from '#/features/pipelines/storage'
import { QUICK_TOOL_UI } from '#/features/quick-tools/tool-ui'
import { QUICK_TOOL_DEFINITIONS, type QuickTool } from '#/features/quick-tools/tools'

export const Route = createFileRoute('/')({ component: Home })

const NO_PIPELINES: never[] = []

const STUDIO_POINTS = [
  'Chain steps such as resize, strip metadata and convert into one pipeline.',
  'See each step on a sample image before you run anything.',
  'Run hundreds of images at once, then download one ZIP.',
]

function Home() {
  usePageView({ page: 'home' })
  const navigate = useNavigate()
  const store = pipelineStore()
  const saved = useSyncExternalStore(store.subscribe, store.list, () => NO_PIPELINES)
  const tools = Object.entries(QUICK_TOOL_DEFINITIONS) as [
    QuickTool,
    (typeof QUICK_TOOL_DEFINITIONS)[QuickTool],
  ][]

  return (
    <AppFrame current="home" contentPadding={0}>
      <Center axis="horizontal">
        <VStack width="100%" maxWidth={1080} gap={10} paddingInline={6} paddingBlock={10}>
          <VStack gap={4} hAlign="center">
            <Badge label="Free · No uploads · No account" variant="success" />
            <Heading level={1} type="display-1" justify="center" textWrap="balance">
              Image tools that run in your browser
            </Heading>
            <VStack maxWidth={620}>
              <Text type="large" color="secondary" justify="center" textWrap="balance">
                Convert, compress, resize and clean up photos one at a time or in batches of
                hundreds. Everything happens on your device, so your images are never uploaded.
              </Text>
            </VStack>
            <HStack gap={3} hAlign="center" wrap="wrap">
              <Button
                label="Open the Studio"
                variant="primary"
                size="lg"
                onClick={() => void navigate({ to: '/studio', search: { pipeline: undefined } })}
              />
              <Button
                label="Convert images"
                size="lg"
                onClick={() => void navigate({ to: '/convert' })}
              />
            </HStack>
          </VStack>

          <VStack gap={4}>
            <VStack gap={1}>
              <Heading level={2}>Quick tools</Heading>
              <Text type="supporting">
                One job each. Add images, choose a setting, download the result.
              </Text>
            </VStack>
            <Grid columns={{ minWidth: 220, max: 4 }} gap={4}>
              {tools.map(([tool, definition]) => {
                const ui = QUICK_TOOL_UI[tool]
                return (
                  <ClickableCard
                    key={tool}
                    label={definition.title}
                    href={definition.path}
                    elevation="low"
                    padding={5}
                    height="100%"
                  >
                    <VStack gap={3} height="100%">
                      <IconTile icon={ui.icon} tone={ui.tone} size="lg" />
                      <VStack gap={1}>
                        <Heading level={3}>{definition.title}</Heading>
                        <Text type="supporting">{definition.description}</Text>
                      </VStack>
                    </VStack>
                  </ClickableCard>
                )
              })}
            </Grid>
          </VStack>

          <Card padding={8} variant="muted">
            <HStack gap={8} vAlign="center" hAlign="between" wrap="wrap">
              <VStack gap={4} maxWidth={560}>
                <HStack gap={3} vAlign="center">
                  <IconTile icon={Workflow} tone="orange" size="lg" />
                  <Heading level={2}>The Studio</Heading>
                </HStack>
                <Text type="body" color="secondary">
                  Build your own pipeline from {productRegistry.list().length} nodes on a canvas,
                  then save it as a tool you can reuse.
                </Text>
                <VStack gap={2}>
                  {STUDIO_POINTS.map((point) => (
                    <HStack key={point} gap={2} vAlign="start">
                      <Icon icon={Check} size="sm" color="success" />
                      <Text type="body">{point}</Text>
                    </HStack>
                  ))}
                </VStack>
              </VStack>
              <Button
                label="Open the Studio"
                variant="primary"
                size="lg"
                endContent={<Icon icon={ArrowRight} size="sm" />}
                onClick={() => void navigate({ to: '/studio', search: { pipeline: undefined } })}
              />
            </HStack>
          </Card>

          {saved.length > 0 ? (
            <VStack gap={4}>
              <VStack gap={1}>
                <Heading level={2}>Your pipeline tools</Heading>
                <Text type="supporting">Pipelines you saved in this browser.</Text>
              </VStack>
              <Grid columns={{ minWidth: 260, max: 3 }} gap={4}>
                {saved.map((pipeline) => (
                  <ClickableCard
                    key={pipeline.id}
                    label={pipeline.name}
                    href={`/tools/${pipeline.id}`}
                    elevation="low"
                  >
                    <VStack gap={1}>
                      <Heading level={3}>{pipeline.name}</Heading>
                      <Text type="supporting" maxLines={2}>
                        {pipeline.pipeline.nodes
                          .map((node) => productRegistry.get(node.type)?.label ?? node.type)
                          .join(' → ')}
                      </Text>
                    </VStack>
                  </ClickableCard>
                ))}
              </Grid>
            </VStack>
          ) : null}

          <HStack gap={4} hAlign="center" wrap="wrap">
            <Text type="supporting">
              Hexlode processes images on your device. Nothing is uploaded.
            </Text>
            <Link href="/privacy" isStandalone>
              <Text type="supporting">Privacy</Text>
            </Link>
          </HStack>
        </VStack>
      </Center>
    </AppFrame>
  )
}
