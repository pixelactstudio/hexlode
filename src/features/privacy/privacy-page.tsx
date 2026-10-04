import { Collapsible, CollapsibleGroup } from '@astryxdesign/core/Collapsible'
import { Link } from '@astryxdesign/core/Link'
import { List, ListItem } from '@astryxdesign/core/List'
import { VStack } from '@astryxdesign/core/Stack'
import { Heading, Text } from '@astryxdesign/core/Text'
import { ChartNoAxesColumn, Cookie, MonitorSmartphone } from 'lucide-react'
import type { ReactNode } from 'react'

import { PROSE_WIDTH, REPOSITORY_URL } from '#/features/app-shell/constants'
import { Eyebrow } from '#/features/app-shell/eyebrow'
import { IconTile, type Tone } from '#/features/app-shell/icon-tile'
import { PageColumn } from '#/features/app-shell/page-column'
import { PRIVACY_UPDATED, STORED_IN_BROWSER } from '#/features/privacy/constants'
import { EVENTS } from '#/features/usage/events'

const SUMMARY: {
  icon: typeof Cookie
  tone: Tone
  title: string
  text: string
}[] = [
  {
    icon: MonitorSmartphone,
    tone: 'green',
    title: 'Processed on your device',
    text: 'Images are decoded, edited and encoded in your browser.',
  },
  {
    icon: Cookie,
    tone: 'orange',
    title: 'No cookies',
    text: 'Nothing is set to recognise you between visits.',
  },
  {
    icon: ChartNoAxesColumn,
    tone: 'blue',
    title: 'Anonymous analytics',
    text: 'Counts, timings and settings. Never your files.',
  },
]

const EVENT_COUNT = Object.keys(EVENTS).length

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-border border-t pt-8">
      <Heading level={2}>{title}</Heading>
      {children}
    </section>
  )
}

function Paragraph({ children }: { children: ReactNode }) {
  return (
    <Text type="body" as="p" color="secondary">
      <span className="leading-relaxed">{children}</span>
    </Text>
  )
}

export function PrivacyPage() {
  return (
    <PageColumn paddingBlock={10}>
      <div className="mx-auto flex w-full flex-col gap-10" style={{ maxWidth: PROSE_WIDTH }}>
        <header className="flex flex-col items-center gap-4 pt-6 text-center">
          <Eyebrow>Privacy</Eyebrow>
          <Heading level={1} type="display-2">
            Your images, on your device
          </Heading>
          <span className="max-w-lg text-pretty">
            <Text type="large" color="secondary" weight="normal">
              Hexlode edits images in your browser. In this version, images, file names and metadata
              stay on your device.
            </Text>
          </span>
          <Text type="supporting" color="secondary">
            Updated {PRIVACY_UPDATED}
          </Text>
        </header>

        <ul className="grid gap-3 sm:grid-cols-3">
          {SUMMARY.map((item) => (
            <li
              key={item.title}
              className="flex items-start gap-3 rounded-lg border border-border bg-card p-4 sm:flex-col"
            >
              <IconTile icon={item.icon} tone={item.tone} />
              <span className="flex flex-col gap-1">
                <span className="font-semibold text-primary text-sm">{item.title}</span>
                <span className="text-secondary text-sm leading-snug">{item.text}</span>
              </span>
            </li>
          ))}
        </ul>

        <Section title="What stays in your browser">
          <Paragraph>
            Hexlode keeps a few things in your browser's storage so it works between visits.
            Clearing this site's data in your browser deletes all of them.
          </Paragraph>
          <List hasDividers>
            {STORED_IN_BROWSER.map((item) => (
              <ListItem
                key={item.label}
                label={item.label}
                description={
                  <Text type="supporting" color="secondary">
                    {item.description}
                  </Text>
                }
              />
            ))}
          </List>
        </Section>

        <Section title="What Hexlode measures">
          <Paragraph>
            Analytics run without cookies and without identifying you. Your IP address becomes an
            anonymous ID that changes every day, and is then discarded. Hexlode records the pages
            you open, where you click and how fast pages load, with the text on screen left out.
            There is no screen recording.
          </Paragraph>
          <Paragraph>
            Hexlode's own events hold only counts, timings, node types, settings and error codes.
            They never hold file names, paths, pixels, image metadata or text you type.
          </Paragraph>
          <div className="rounded-lg border border-border bg-card px-4">
            <CollapsibleGroup type="multiple" density="balanced">
              <Collapsible
                value="events"
                defaultIsOpen={false}
                trigger={
                  <span className="font-medium text-primary text-sm">
                    See all {EVENT_COUNT} events
                  </span>
                }
              >
                <List hasDividers density="compact">
                  {Object.entries(EVENTS).map(([name, event]) => (
                    <ListItem
                      key={name}
                      label={name}
                      description={
                        <Text type="supporting" color="secondary">
                          {event.description}
                        </Text>
                      }
                    />
                  ))}
                </List>
              </Collapsible>
            </CollapsibleGroup>
          </div>
        </Section>

        <Section title="Error reports">
          <Paragraph>
            When something breaks, Hexlode sends an error report with the technical cause, the
            warnings the app logged and how long pages and requests took. File names are removed,
            and reports hold no personal data and no screen recording.
          </Paragraph>
        </Section>

        <Section title="Open source">
          <Paragraph>
            Hexlode is open source under the Apache License 2.0, so you can read exactly what it
            does. Images are encoded and decoded with the jSquash codecs, whose licences ship with
            the app.
          </Paragraph>
          <VStack gap={2}>
            <Link href={REPOSITORY_URL} isExternalLink isStandalone>
              Source code on GitHub
            </Link>
            <Link href="/licenses/jsquash.txt" isExternalLink isStandalone>
              Codec licences
            </Link>
          </VStack>
        </Section>

        <Section title="Questions">
          <Paragraph>
            Open an issue on GitHub. Accounts and cloud processing are planned; this page will be
            updated before either arrives.
          </Paragraph>
          <Link href={`${REPOSITORY_URL}/issues`} isExternalLink isStandalone>
            Ask on GitHub
          </Link>
        </Section>
      </div>
    </PageColumn>
  )
}
