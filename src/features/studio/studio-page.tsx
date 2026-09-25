import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Center } from '@astryxdesign/core/Center'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { IconButton } from '@astryxdesign/core/IconButton'
import { Layout, LayoutContent, LayoutHeader, LayoutPanel } from '@astryxdesign/core/Layout'
import { Link } from '@astryxdesign/core/Link'
import { MoreMenu } from '@astryxdesign/core/MoreMenu'
import { HStack, VStack } from '@astryxdesign/core/Stack'
import { Text } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import { useToast } from '@astryxdesign/core/Toast'
import { useNavigate } from '@tanstack/react-router'
import { ReactFlowProvider, useReactFlow } from '@xyflow/react'
import { Redo2, Settings, Undo2 } from 'lucide-react'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

import { track } from '#/features/analytics/analytics'
import { pipelineShape } from '#/features/analytics/pipeline-shape'
import { usePageView } from '#/features/analytics/use-page-view'
import { AppFrame } from '#/features/app-shell/app-frame'
import { describeEstimate } from '#/features/engine/estimate'
import type { FolderTarget } from '#/features/engine/opfs/run-stores'
import { pickOutputFolder } from '#/features/image-input/folder'
import { productRegistry } from '#/features/nodes/registry'
import {
  exportPipelineFile,
  importPipelineFile,
  PipelineFileError,
  pipelineFileName,
} from '#/features/pipelines/pipeline-file'
import { pipelineStore } from '#/features/pipelines/storage'
import { isEngineSupported } from '#/features/runs/engine-runtime'
import { useController, useRunState } from '#/features/runs/use-run-controller'
import { STUDIO_MIN_WIDTH } from '#/features/studio/constants'
import { NodeInspector } from '#/features/studio/node-inspector'
import { NodeSidebar } from '#/features/studio/node-sidebar'
import { StudioCanvas } from '#/features/studio/studio-canvas'
import {
  OpenDialog,
  SaveDialog,
  SettingsDialog,
  TemplatePicker,
} from '#/features/studio/studio-dialogs'
import { createStudioSession, type StudioSession } from '#/features/studio/studio-session'
import { downloadBlob } from '#/lib/download'
import { formatCount } from '#/lib/format'

const registry = productRegistry
const NO_PIPELINES: never[] = []

function useWideEnough() {
  const query = `(min-width: ${STUDIO_MIN_WIDTH}px)`
  return useSyncExternalStore(
    (notify) => {
      const media = window.matchMedia(query)
      media.addEventListener('change', notify)
      return () => media.removeEventListener('change', notify)
    },
    () => window.matchMedia(query).matches,
    () => true,
  )
}

function NarrowScreen() {
  return (
    <Center height="100%">
      <EmptyState
        title="The Studio needs a larger screen"
        description="Open it on a desktop or widen this window. The quick tools work on any screen."
        actions={
          <VStack gap={2}>
            <Link href="/convert" isStandalone>
              Convert
            </Link>
            <Link href="/compress" isStandalone>
              Compress
            </Link>
            <Link href="/resize" isStandalone>
              Resize
            </Link>
            <Link href="/strip-metadata" isStandalone>
              Strip metadata
            </Link>
          </VStack>
        }
      />
    </Center>
  )
}

function Studio({
  session,
  savedPipelineId,
}: {
  session: StudioSession
  savedPipelineId?: string
}) {
  const { store, runs } = session
  const studio = useSyncExternalStore(store.subscribe, store.getState, store.getState)
  const run = useRunState(runs)
  const previews = useSyncExternalStore(
    session.subscribePreviews,
    session.getPreviews,
    session.getPreviews,
  )
  const saved = useSyncExternalStore(
    pipelineStore().subscribe,
    pipelineStore().list,
    () => NO_PIPELINES,
  )
  const flow = useReactFlow()
  const showToast = useToast()
  const navigate = useNavigate()
  const importInput = useRef<HTMLInputElement>(null)
  const [dialog, setDialog] = useState<'templates' | 'save' | 'open' | 'settings' | null>(null)

  useEffect(() => {
    const existing = savedPipelineId ? pipelineStore().get(savedPipelineId) : undefined
    if (existing) {
      store.load(existing, existing.id)
    } else {
      setDialog('templates')
    }
    session.refresh()
  }, [savedPipelineId, session, store])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, [contenteditable=true]')) return
      const mod = event.metaKey || event.ctrlKey
      if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) store.redo()
        else store.undo()
      } else if (mod && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        store.redo()
      } else if (mod && event.key.toLowerCase() === 's') {
        event.preventDefault()
        setDialog('save')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [store])

  const selected = studio.pipeline.nodes.find((node) => node.id === studio.selectedNodeId)
  const hasFiles = studio.pipeline.nodes.some((node) => node.type === 'files')

  const addNode = (type: string, method: 'click' | 'search') => {
    const { x, y, zoom } = flow.getViewport()
    const bounds = document.querySelector('.react-flow')?.getBoundingClientRect()
    const centre = bounds
      ? { x: (bounds.width / 2 - x) / zoom - 104, y: (bounds.height / 2 - y) / zoom - 60 }
      : { x: 0, y: 0 }
    const offset = studio.pipeline.nodes.length * 12
    const id = store.addNode(type, { x: centre.x + offset, y: centre.y + offset })
    if (id) track('node_added', { nodeType: type, method })
  }

  const start = async () => {
    const folders = new Map<string, FolderTarget>()
    for (const node of studio.pipeline.nodes) {
      if (node.type !== 'output' || node.settings.destination !== 'folder') continue
      try {
        folders.set(node.id, await pickOutputFolder())
      } catch {
        return
      }
    }
    await runs.start({ folders })
  }

  const save = (name: string) => {
    const result = pipelineStore().save({
      id: studio.savedId ?? undefined,
      name,
      pipeline: studio.pipeline,
    })
    store.markSaved(result.id, name)
    track('pipeline_saved', { pipeline: pipelineShape(studio.pipeline, registry) })
    setDialog(null)
    showToast({ body: `Saved “${name}” in this browser.`, uniqueID: 'saved' })
    if (savedPipelineId !== result.id)
      void navigate({ to: '/studio', search: { pipeline: result.id }, replace: true })
  }

  const exportFile = () => {
    const text = exportPipelineFile({ name: studio.name, pipeline: studio.pipeline })
    downloadBlob(new Blob([text], { type: 'application/json' }), pipelineFileName(studio.name))
    track('pipeline_file', {
      action: 'export',
      result: 'ok',
      nodeCount: studio.pipeline.nodes.length,
    })
  }

  const importFile = async (file: File) => {
    try {
      const imported = importPipelineFile(await file.text(), registry)
      store.load(imported)
      session.refresh()
      setDialog(null)
      track('pipeline_file', {
        action: 'import',
        result: 'ok',
        nodeCount: imported.pipeline.nodes.length,
      })
      requestAnimationFrame(() => void flow.fitView({ padding: 0.08, maxZoom: 1 }))
    } catch (reason) {
      const message =
        reason instanceof PipelineFileError ? reason.message : 'The file could not be read.'
      showToast({ body: message, type: 'error' })
      track('pipeline_file', {
        action: 'import',
        result: 'error',
        nodeCount: 0,
        errorCode: 'invalid_file',
      })
    }
  }

  const estimate = run.estimate
  const status = run.running
    ? `Running · ${formatCount(run.stats.finishedItems)} of ${formatCount(run.sources.length)} images`
    : run.sources.length === 0
      ? 'Add images to the Files node to run'
      : estimate
        ? `${formatCount(run.sources.length)} images · ${describeEstimate(estimate)}`
        : `${formatCount(run.sources.length)} images`

  const header = (
    <LayoutHeader hasDivider>
      <HStack gap={3} paddingInline={4} paddingBlock={2} vAlign="center" hAlign="between">
        <HStack gap={2} vAlign="center">
          <TextInput
            label="Pipeline name"
            isLabelHidden
            size="sm"
            width={240}
            value={studio.name}
            onChange={(name) => store.rename(name)}
          />
          <IconButton
            label="Undo"
            tooltip="Undo"
            icon={<Undo2 size={16} />}
            variant="ghost"
            size="sm"
            onClick={() => store.undo()}
            isDisabled={!studio.canUndo}
          />
          <IconButton
            label="Redo"
            tooltip="Redo"
            icon={<Redo2 size={16} />}
            variant="ghost"
            size="sm"
            onClick={() => store.redo()}
            isDisabled={!studio.canRedo}
          />
          <Button
            label={studio.dirty || !studio.savedId ? 'Save' : 'Saved'}
            size="sm"
            onClick={() => setDialog('save')}
          />
          <MoreMenu
            label="Pipeline menu"
            size="sm"
            items={[
              { label: 'New from template…', onClick: () => setDialog('templates') },
              { label: 'Open saved pipeline…', onClick: () => setDialog('open') },
              { type: 'divider' },
              { label: 'Import .hexlode file…', onClick: () => importInput.current?.click() },
              { label: 'Export .hexlode file', onClick: exportFile },
              { type: 'divider' },
              ...(studio.savedId
                ? [
                    {
                      label: 'Open as pipeline tool',
                      onClick: () =>
                        void navigate({
                          to: '/tools/$pipelineId',
                          params: { pipelineId: studio.savedId as string },
                        }),
                    },
                  ]
                : []),
            ]}
          />
          <IconButton
            label="Settings"
            tooltip="Settings"
            icon={<Settings size={16} />}
            variant="ghost"
            size="sm"
            onClick={() => setDialog('settings')}
          />
        </HStack>
        <HStack gap={3} vAlign="center">
          <Text type="supporting" maxLines={1}>
            {status}
          </Text>
          {run.running ? (
            <Button label="Cancel" size="sm" variant="secondary" onClick={() => runs.cancel()} />
          ) : (
            <Button
              label="Run"
              size="sm"
              variant="primary"
              isDisabled={run.sources.length === 0 || run.preparing}
              clickAction={start}
            />
          )}
        </HStack>
      </HStack>
      <input
        ref={importInput}
        type="file"
        hidden
        accept=".hexlode,application/json"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void importFile(file)
          event.target.value = ''
        }}
      />
    </LayoutHeader>
  )

  return (
    <>
      <Layout
        height="fill"
        header={header}
        start={
          <LayoutPanel width={264} hasDivider padding={4} label="Nodes">
            <NodeSidebar registry={registry} onAdd={addNode} hasFiles={hasFiles} />
          </LayoutPanel>
        }
        end={
          <LayoutPanel width={380} hasDivider padding={4} label="Inspector">
            <VStack gap={4}>
              {run.error ? (
                <Banner status="error" title="The run stopped" description={run.error} />
              ) : null}
              {previews.error ? (
                <Banner status="warning" title="Preview unavailable" description={previews.error} />
              ) : null}
              <NodeInspector
                session={session}
                registry={registry}
                node={selected}
                run={run}
                previews={previews}
              />
            </VStack>
          </LayoutPanel>
        }
        content={
          <LayoutContent padding={0} isScrollable={false} label="Canvas">
            <StudioCanvas
              session={session}
              registry={registry}
              studio={studio}
              run={run}
              previews={previews}
            />
          </LayoutContent>
        }
      />
      <TemplatePicker
        isOpen={dialog === 'templates'}
        onOpenChange={(open) => setDialog(open ? 'templates' : null)}
        registry={registry}
        onChoose={(template) => {
          store.load({
            name: template.id === 'blank' ? 'Untitled pipeline' : template.name,
            pipeline: template.pipeline,
          })
          session.refresh()
          setDialog(null)
          track('template_chosen', { template: template.id })
          requestAnimationFrame(() => void flow.fitView({ padding: 0.08, maxZoom: 1 }))
        }}
      />
      <SaveDialog
        isOpen={dialog === 'save'}
        onOpenChange={(open) => setDialog(open ? 'save' : null)}
        name={studio.name}
        onSave={save}
      />
      <OpenDialog
        isOpen={dialog === 'open'}
        onOpenChange={(open) => setDialog(open ? 'open' : null)}
        pipelines={saved}
        onOpen={(pipeline) => {
          setDialog(null)
          void navigate({ to: '/studio', search: { pipeline: pipeline.id } })
        }}
        onDelete={(pipeline) => pipelineStore().remove(pipeline.id)}
      />
      <SettingsDialog
        isOpen={dialog === 'settings'}
        onOpenChange={(open) => setDialog(open ? 'settings' : null)}
      />
    </>
  )
}

function StudioClient({ savedPipelineId }: { savedPipelineId?: string }) {
  const session = useController(() => createStudioSession(registry))
  const wide = useWideEnough()
  if (!wide) return <NarrowScreen />
  if (!isEngineSupported()) {
    return (
      <Center height="100%">
        <EmptyState
          title="This browser cannot run the Studio"
          description="Hexlode needs Web Workers and the Origin Private File System. Use a current Chrome, Edge, Firefox or Safari."
        />
      </Center>
    )
  }
  return (
    <ReactFlowProvider>
      <Studio session={session} savedPipelineId={savedPipelineId} />
    </ReactFlowProvider>
  )
}

export function StudioPage({ savedPipelineId }: { savedPipelineId?: string }) {
  usePageView({ page: 'studio' })
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return (
    <AppFrame current="studio" height="fill" contentPadding={0}>
      {mounted ? <StudioClient savedPipelineId={savedPipelineId} /> : null}
    </AppFrame>
  )
}
