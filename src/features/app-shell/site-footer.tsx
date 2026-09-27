import { Center } from '@astryxdesign/core/Center'
import { HStack, VStack } from '@astryxdesign/core/Stack'
import { Text } from '@astryxdesign/core/Text'

import { PAGE_WIDTH, REPOSITORY_URL } from '#/features/app-shell/constants'
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

/** The name and a line about Hexlode, the site's links in columns, and a large dotted wordmark. */
export function SiteFooter() {
  return (
    <footer className="overflow-hidden border-border border-t">
      <Center axis="horizontal">
        <VStack width="100%" maxWidth={PAGE_WIDTH + 48} paddingInline={6} gap={10}>
          <span className="grid gap-10 pt-14 md:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
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
            </VStack>
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
          <span
            aria-hidden="true"
            className="block select-none bg-[radial-gradient(var(--color-border-strong)_1px,transparent_1.4px)] bg-[length:5px_5px] bg-clip-text text-center font-bold text-[clamp(88px,19vw,260px)] text-transparent leading-[0.8] tracking-[-0.04em] [mask-image:linear-gradient(to_bottom,black_40%,transparent)]"
          >
            Hexlode
          </span>
        </VStack>
      </Center>
    </footer>
  )
}
