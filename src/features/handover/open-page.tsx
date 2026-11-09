import { Banner } from '@astryxdesign/core/Banner'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Icon } from '@astryxdesign/core/Icon'
import { List, ListItem } from '@astryxdesign/core/List'
import { VStack } from '@astryxdesign/core/Stack'
import { Heading, Text } from '@astryxdesign/core/Text'
import { useNavigate } from '@tanstack/react-router'
import { Bookmark, ChevronRight, Image as ImageIcon } from 'lucide-react'
import { useEffect, useState, useSyncExternalStore } from 'react'

import { IconTile } from '#/features/app-shell/icon-tile'
import { handOver } from '#/features/handover/handover'
import {
  type LaunchQueueLike,
  listenForLaunches,
  openLaunchedPipeline,
} from '#/features/handover/launch'
import { draftStore } from '#/features/pipelines/draft'
import { PipelineFileError } from '#/features/pipelines/pipeline-file'
import { pipelineStore } from '#/features/pipelines/storage'
import { ToolColumns, ToolPageFrame } from '#/features/quick-tools/quick-tool-page'
import { QUICK_TOOL_GROUPS, QUICK_TOOL_ICONS } from '#/features/quick-tools/tool-ui'
import { QUICK_TOOL_DEFINITIONS } from '#/features/quick-tools/tools'
import { ToolPanel } from '#/features/runs/run-panel'
import { track } from '#/features/usage/usage'
import { usePageView } from '#/features/usage/use-page-view'
import { formatBytes, formatCount } from '#/lib/format'

const TOOLS = QUICK_TOOL_GROUPS.flatMap((group) => group.tools)
const NO_PIPELINES: never[] = []
/** The open page names this many files, then counts the rest. */
const LISTED_FILES = 8

function plural(count: number, noun: string) {
  return `${formatCount(count)} ${noun}${count === 1 ? '' : 's'}`
}

function OpenedFiles({ files }: { files: File[] }) {
  if (files.length === 0) {
    return (
      <EmptyState
        isCompact
        title="No images yet"
        description="Open images with Hexlode from your file manager, or pick a tool and add them there."
      />
    )
  }
  const rest = files.length - LISTED_FILES
  return (
    <VStack gap={3}>
      <List density="compact" hasDividers>
        {files.slice(0, LISTED_FILES).map((file) => (
          <ListItem
            key={`${file.name}-${file.size}-${file.lastModified}`}
            label={file.name}
            description={formatBytes(file.size)}
            startContent={<IconTile icon={ImageIcon} size="sm" />}
          />
        ))}
      </List>
      {rest > 0 ? (
        <Text type="supporting" color="secondary">
          and {plural(rest, 'more image')}
        </Text>
      ) : null}
    </VStack>
  )
}

const chevron = <Icon icon={ChevronRight} size="sm" color="secondary" />

/**
 * Where the installed app opens files from the file manager. A `.hexlode` file goes straight to
 * the Studio; images wait here while the user picks a quick tool or a saved pipeline tool, then go
 * with them, in memory, to that page.
 */
export function OpenPage() {
  usePageView({ page: 'open' })
  const navigate = useNavigate()
  const store = pipelineStore()
  const saved = useSyncExternalStore(store.subscribe, store.list, () => NO_PIPELINES)
  const [files, setFiles] = useState<File[]>([])
  const [problem, setProblem] = useState<string | null>(null)

  useEffect(() => {
    const queue = (window as { launchQueue?: LaunchQueueLike }).launchQueue
    listenForLaunches(queue, async ({ pipelines, images }) => {
      track('files_opened', {
        source: 'file-handler',
        images: images.length,
        pipelineFiles: pipelines.length,
      })
      const [pipeline] = pipelines
      if (pipeline) {
        try {
          const opened = await openLaunchedPipeline(pipeline, draftStore())
          track('pipeline_file', {
            action: 'import',
            result: 'ok',
            nodeCount: opened.pipeline.nodes.length,
          })
          void navigate({ to: '/studio', search: { pipeline: undefined }, replace: true })
          return
        } catch (reason) {
          setProblem(
            reason instanceof PipelineFileError ? reason.message : 'The file could not be read.',
          )
          track('pipeline_file', {
            action: 'import',
            result: 'error',
            nodeCount: 0,
            errorCode: 'invalid_file',
          })
        }
      }
      setFiles(images)
    })
  }, [navigate])

  const choose = (path: string) => {
    handOver(path, files)
    void navigate({ href: path })
  }

  const count = files.length
  return (
    <ToolPageFrame
      eyebrow="Open with Hexlode"
      title={count > 0 ? `Open ${plural(count, 'image')}` : 'Open images'}
      description={
        count > 0
          ? 'Pick a tool. The images go with you, ready to run.'
          : 'Pick a tool to start with.'
      }
    >
      <ToolColumns
        start={
          <ToolPanel step={1} title="Images">
            {problem ? (
              <Banner
                status="error"
                title="This pipeline file did not open"
                description={problem}
              />
            ) : null}
            <OpenedFiles files={files} />
          </ToolPanel>
        }
        end={
          <ToolPanel step={2} title="Open in">
            <List hasDividers>
              {TOOLS.map((tool) => {
                const definition = QUICK_TOOL_DEFINITIONS[tool]
                return (
                  <ListItem
                    key={tool}
                    label={definition.title}
                    // Text rather than a string, so the line wraps on phones instead of being cut.
                    description={
                      <Text type="supporting" color="secondary">
                        {definition.summary}
                      </Text>
                    }
                    startContent={<IconTile icon={QUICK_TOOL_ICONS[tool]} size="sm" />}
                    endContent={chevron}
                    onClick={() => choose(definition.path)}
                  />
                )
              })}
            </List>
            {saved.length > 0 ? (
              <VStack gap={2}>
                <Heading level={3}>Your tools</Heading>
                <List hasDividers>
                  {saved.map((pipeline) => (
                    <ListItem
                      key={pipeline.id}
                      label={pipeline.name}
                      description={plural(pipeline.pipeline.nodes.length, 'step')}
                      startContent={<IconTile icon={Bookmark} tone="pink" size="sm" />}
                      endContent={chevron}
                      onClick={() => choose(`/tools/${pipeline.id}`)}
                    />
                  ))}
                </List>
              </VStack>
            ) : null}
          </ToolPanel>
        }
      />
    </ToolPageFrame>
  )
}
