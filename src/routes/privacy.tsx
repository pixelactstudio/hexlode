import { Link } from '@astryxdesign/core/Link'
import { List, ListItem } from '@astryxdesign/core/List'
import { VStack } from '@astryxdesign/core/Stack'
import { Heading, Text } from '@astryxdesign/core/Text'
import { createFileRoute } from '@tanstack/react-router'
import { PROSE_WIDTH } from '#/features/app-shell/constants'
import { Eyebrow } from '#/features/app-shell/eyebrow'
import { PageColumn } from '#/features/app-shell/page-column'
import { EVENTS } from '#/features/usage/events'
import { usePageView } from '#/features/usage/use-page-view'

export const Route = createFileRoute('/privacy')({
  head: () => ({ meta: [{ title: 'Privacy — Hexlode' }] }),
  component: Privacy,
})

function Privacy() {
  usePageView({ page: 'privacy' })
  return (
    <PageColumn>
      <VStack gap={8} maxWidth={PROSE_WIDTH}>
        <VStack gap={3}>
          <Eyebrow>Privacy</Eyebrow>
          <Heading level={1} type="display-2">
            Your images stay on your device
          </Heading>
          <Text type="large" color="secondary" weight="normal">
            Hexlode processes your images in your browser. Images, file names and metadata never
            leave it.
          </Text>
        </VStack>
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
            <ListItem
              label="The pipeline open in the Studio"
              description="Its nodes, settings and name, so a reload does not lose your work. Never your images. Clearing site data deletes it."
            />
            <ListItem
              label="Your colour mode"
              description="Dark, light or system, once you pick one in the top bar. Clearing site data deletes it."
            />
          </List>
          <Text type="body" as="p">
            Hexlode sets no cookies.
          </Text>
        </VStack>
        <VStack gap={3}>
          <Heading level={2}>What Hexlode measures</Heading>
          <Text type="body" as="p">
            Product analytics run without cookies and without identifying you. Your IP address is
            discarded. Events contain only counts, timings, node types, settings and error codes.
            They never contain file names, paths, pixels, image metadata or text you type.
          </Text>
          <List listStyle="disc">
            {Object.entries(EVENTS).map(([name, event]) => (
              <ListItem key={name} label={name} description={event.description} />
            ))}
          </List>
        </VStack>
        <VStack gap={3}>
          <Heading level={2}>Error reports</Heading>
          <Text type="body" as="p">
            When something breaks, an error report with the technical cause is sent. File names are
            removed from it, and it contains no personal data and no screen recording.
          </Text>
        </VStack>
        <VStack gap={3}>
          <Heading level={2}>Licences</Heading>
          <Text type="body" as="p">
            Hexlode is open source under the Apache License 2.0. Images are encoded and decoded with
            the jSquash codecs, whose licences come with the app.
          </Text>
          <Link href="/licenses/jsquash.txt" isExternalLink isStandalone>
            Codec licences
          </Link>
        </VStack>
      </VStack>
    </PageColumn>
  )
}
