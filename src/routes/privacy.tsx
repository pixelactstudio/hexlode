import { Card } from '@astryxdesign/core/Card'
import { Center } from '@astryxdesign/core/Center'
import { Link } from '@astryxdesign/core/Link'
import { List, ListItem } from '@astryxdesign/core/List'
import { VStack } from '@astryxdesign/core/Stack'
import { Heading, Text } from '@astryxdesign/core/Text'
import { createFileRoute } from '@tanstack/react-router'
import { EVENTS } from '#/features/analytics/events'
import { usePageView } from '#/features/analytics/use-page-view'
import { AppFrame } from '#/features/app-shell/app-frame'

export const Route = createFileRoute('/privacy')({
  head: () => ({ meta: [{ title: 'Privacy — Hexlode' }] }),
  component: Privacy,
})

function Privacy() {
  usePageView({ page: 'privacy' })
  return (
    <AppFrame current="privacy" contentPadding={0}>
      <Center axis="horizontal">
        <VStack width="100%" gap={6} maxWidth={760} paddingInline={6} paddingBlock={10}>
          <VStack gap={2}>
            <Heading level={1}>Privacy</Heading>
            <Text type="body" as="p">
              Hexlode processes your images on your device. Images, file names and metadata never
              leave it.
            </Text>
          </VStack>
          <Card elevation="low" padding={6}>
            <VStack gap={3}>
              <Heading level={2}>What Hexlode stores in your browser</Heading>
              <List listStyle="disc">
                <ListItem
                  label="Run files"
                  description="While a run is active, items and step results are kept in your browser's private file storage. Run files are deleted after delivery, when a new run starts and on your next visit. Step results are kept up to the size you set, then the oldest are deleted."
                />
                <ListItem
                  label="Saved pipelines and settings"
                  description="Only when you click Save or change a setting. Clearing site data deletes them."
                />
              </List>
              <Text type="body" as="p">
                Hexlode sets no cookies.
              </Text>
            </VStack>
          </Card>
          <Card elevation="low" padding={6}>
            <VStack gap={3}>
              <Heading level={2}>What Hexlode measures</Heading>
              <Text type="body" as="p">
                Product analytics run without cookies and without identifying you. Your IP address
                is discarded. Events contain only counts, timings, node types, settings and error
                codes. They never contain file names, paths, pixels, image metadata or text you
                type.
              </Text>
              <List listStyle="disc">
                {Object.entries(EVENTS).map(([name, event]) => (
                  <ListItem key={name} label={name} description={event.description} />
                ))}
              </List>
            </VStack>
          </Card>
          <Card elevation="low" padding={6}>
            <VStack gap={3}>
              <Heading level={2}>Error reports</Heading>
              <Text type="body" as="p">
                When something breaks, an error report with the technical cause is sent. File names
                are removed from it, and it contains no personal data and no screen recording.
              </Text>
            </VStack>
          </Card>
          <Card elevation="low" padding={6}>
            <VStack gap={3}>
              <Heading level={2}>Licences</Heading>
              <Text type="body" as="p">
                Hexlode is open source under the Apache License 2.0. Images are encoded and decoded
                with the jSquash codecs, whose licences come with the app.
              </Text>
              <Link href="/licenses/jsquash.txt" isExternalLink isStandalone>
                Codec licences
              </Link>
            </VStack>
          </Card>
        </VStack>
      </Center>
    </AppFrame>
  )
}
