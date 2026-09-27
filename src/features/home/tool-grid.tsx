import { Icon } from '@astryxdesign/core/Icon'
import { Heading, Text } from '@astryxdesign/core/Text'
import { ArrowUpRight, Bookmark, Wrench } from 'lucide-react'
import { useSyncExternalStore } from 'react'

import { Section, SectionHeader } from '#/features/home/section'
import { TOOL_DEMOS } from '#/features/home/tool-demos'
import { pipelineStore } from '#/features/pipelines/storage'
import { QUICK_TOOL_GROUPS } from '#/features/quick-tools/tool-ui'
import { QUICK_TOOL_DEFINITIONS, type QuickTool } from '#/features/quick-tools/tools'
import { RouterLink } from '#/lib/router-link'

const TOOLS = QUICK_TOOL_GROUPS.flatMap((group) => group.tools)
const NO_PIPELINES: never[] = []

function ToolCell({ tool }: { tool: QuickTool }) {
  const definition = QUICK_TOOL_DEFINITIONS[tool]
  const Demo = TOOL_DEMOS[tool]
  return (
    <RouterLink
      href={definition.path}
      className="group flex flex-col bg-surface no-underline outline-accent transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:-outline-offset-2"
    >
      <span className="relative flex h-64 items-center justify-center overflow-hidden">
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(var(--color-border)_1px,transparent_1px)] bg-[size:16px_16px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_72%)]"
        />
        <span className="relative">
          <Demo />
        </span>
      </span>
      <span className="flex flex-col gap-2 px-6 pb-8 md:px-8">
        <span className="flex items-center justify-between gap-3">
          <Heading level={3}>{definition.title}</Heading>
          <span className="inline-flex text-secondary transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary">
            <Icon icon={ArrowUpRight} size="sm" color="inherit" />
          </span>
        </span>
        <Text type="body" color="secondary">
          {definition.summary}
        </Text>
      </span>
    </RouterLink>
  )
}

/** Pipelines saved in this browser, as links to their tool pages. */
function SavedTools() {
  const store = pipelineStore()
  const saved = useSyncExternalStore(store.subscribe, store.list, () => NO_PIPELINES)
  if (saved.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-2 border-border border-t px-6 py-6 md:px-8">
      <span className="me-2 inline-flex items-center gap-2 text-secondary text-sm">
        <Icon icon={Bookmark} size="sm" color="inherit" />
        Your tools
      </span>
      {saved.map((pipeline) => (
        <RouterLink
          key={pipeline.id}
          href={`/tools/${pipeline.id}`}
          className="rounded-full border border-border px-3 py-1 text-primary text-sm no-underline outline-accent transition-colors hover:bg-muted focus-visible:outline-2"
        >
          {pipeline.name}
        </RouterLink>
      ))}
    </div>
  )
}

/** The quick tools, each with a moving picture of what it does, and any saved pipelines. */
export function ToolGrid() {
  return (
    <Section id="tools">
      <SectionHeader
        icon={Wrench}
        pill="Quick tools"
        title="One job? There is a tool for it."
        text="Six focused tools for everyday fixes. Drop images, pick a setting, download the results."
      />
      <div className="grid gap-px border-border border-t bg-border sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((tool) => (
          <ToolCell key={tool} tool={tool} />
        ))}
      </div>
      <SavedTools />
    </Section>
  )
}
