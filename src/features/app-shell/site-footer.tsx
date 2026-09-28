import { Center } from '@astryxdesign/core/Center'
import { HStack, VStack } from '@astryxdesign/core/Stack'
import { Text } from '@astryxdesign/core/Text'

import {
  DAMN_LABS_URL,
  ENVSIFT_URL,
  PAGE_WIDTH,
  PIXELACT_STUDIO_URL,
  REPOSITORY_URL,
} from '#/features/app-shell/constants'
import { FooterWordmark } from '#/features/app-shell/footer-wordmark'
import { HexlodeMark } from '#/features/app-shell/hexlode-mark'
import { QUICK_TOOL_GROUPS } from '#/features/quick-tools/tool-ui'
import { QUICK_TOOL_DEFINITIONS } from '#/features/quick-tools/tools'
import { RouterLink } from '#/lib/router-link'

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: 'Tools',
    links: QUICK_TOOL_GROUPS.flatMap((group) => group.tools).map((tool) => ({
      label: QUICK_TOOL_DEFINITIONS[tool].title,
      href: QUICK_TOOL_DEFINITIONS[tool].path,
    })),
  },
  {
    title: 'Hexlode',
    links: [
      { label: 'Studio', href: '/studio' },
      { label: 'Privacy', href: '/privacy' },
    ],
  },
  {
    title: 'Source',
    links: [
      { label: 'GitHub', href: REPOSITORY_URL },
      { label: 'Codec licences', href: '/licenses/jsquash.txt' },
    ],
  },
  {
    title: 'Damn Labs',
    links: [
      { label: 'Damn Labs', href: DAMN_LABS_URL },
      { label: 'EnvSift', href: ENVSIFT_URL },
      { label: 'Pixelact Studio', href: PIXELACT_STUDIO_URL },
    ],
  },
]

function FooterLink({ href, label }: { href: string; label: string }) {
  const external = href.startsWith('http') || href.endsWith('.txt')
  return (
    <RouterLink
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noreferrer' : undefined}
      className="text-secondary text-sm no-underline transition-colors hover:text-primary"
    >
      {label}
    </RouterLink>
  )
}

/** A link inside the credit line, underlined so it reads as one inside the sentence. */
function CreditLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-primary underline decoration-border-strong underline-offset-4 transition-colors hover:decoration-current"
    >
      {label}
    </a>
  )
}

/**
 * The name and a line about Hexlode, who makes it, the site's links in columns, and a large dotted
 * wordmark that lights up under the pointer.
 */
export function SiteFooter() {
  return (
    <footer className="overflow-hidden border-border border-t">
      <Center axis="horizontal">
        <VStack width="100%" maxWidth={PAGE_WIDTH + 48} paddingInline={6} gap={10}>
          <span className="grid grid-cols-2 gap-x-6 gap-y-10 pt-14 md:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]">
            <span className="col-span-2 md:col-span-1">
              <VStack gap={3}>
                <HStack gap={2} vAlign="center">
                  <HexlodeMark size="lg" />
                  <Text type="large" weight="semibold">
                    Hexlode
                  </Text>
                </HStack>
                <span className="block max-w-xs">
                  <Text type="body" color="secondary">
                    Image tools and pipelines that run in your browser. Open source under the Apache
                    License 2.0.
                  </Text>
                </span>
                <span className="block max-w-xs">
                  <Text type="body" color="secondary">
                    Built by <CreditLink href={DAMN_LABS_URL} label="Damn Labs" />, a{' '}
                    <CreditLink href={PIXELACT_STUDIO_URL} label="Pixelact Studio" /> product.
                  </Text>
                </span>
              </VStack>
            </span>
            {COLUMNS.map((column) => (
              <VStack key={column.title} gap={3}>
                <Text type="label" weight="semibold">
                  {column.title}
                </Text>
                <VStack gap={2}>
                  {column.links.map((link) => (
                    <FooterLink key={link.href} {...link} />
                  ))}
                </VStack>
              </VStack>
            ))}
          </span>
          <FooterWordmark />
        </VStack>
      </Center>
    </footer>
  )
}
