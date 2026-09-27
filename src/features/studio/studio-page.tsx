import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Center } from '@astryxdesign/core/Center'
import { Divider } from '@astryxdesign/core/Divider'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Icon } from '@astryxdesign/core/Icon'
import { IconButton } from '@astryxdesign/core/IconButton'
import { Layout, LayoutContent, LayoutHeader, LayoutPanel } from '@astryxdesign/core/Layout'
import { Link } from '@astryxdesign/core/Link'
import { MoreMenu } from '@astryxdesign/core/MoreMenu'
import { Popover } from '@astryxdesign/core/Popover'
import { HStack, VStack } from '@astryxdesign/core/Stack'
import { Text } from '@astryxdesign/core/Text'
import { useToast } from '@astryxdesign/core/Toast'
import { useNavigate } from '@tanstack/react-router'
import { ReactFlowProvider, useReactFlow } from '@xyflow/react'
import { CircleHelp, Download, Play, Redo2, Settings, Undo2 } from 'lucide-react'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

import { describeEstimate } from '#/features/engine/estimate'
import type { FolderTarget } from '#/features/engine/opfs/run-stores'
import { pickOutputFolder } from '#/features/image-input/folder'
import { productRegistry } from '#/features/nodes/registry'
import { draftStore } from '#/features/pipelines/draft'
import {
  exportPipelineFile,
  importPipelineFile,
  PipelineFileError,
  pipelineFileName,
  validatePipeline,
} from '#/features/pipelines/pipeline-file'
import { pipelineStore } from '#/features/pipelines/storage'
import { QUICK_TOOL_GROUPS } from '#/features/quick-tools/tool-ui'
import { QUICK_TOOL_DEFINITIONS } from '#/features/quick-tools/tools'
import { EngineGate } from '#/features/runs/engine-unavailable'
import { downloadDelivery } from '#/features/runs/run-controller'
import { useController, useRunState } from '#/features/runs/use-run-controller'
import {
  DRAFT_SAVE_DELAY_MS,
  FIT_VIEW,
  INSPECTOR_WIDTH,
  LIBRARY_RAIL_WIDTH,
  LIBRARY_WIDTH,
  STUDIO_MIN_WIDTH,
} from '#/features/studio/constants'
import { NodeInspector } from '#/features/studio/node-inspector'
import { NodeLibrary } from '#/features/studio/node-library'
import { PipelineName } from '#/features/studio/pipeline-name'
import { NODE_WIDTH } from '#/features/studio/pipeline-node'
import { type AddNodeRequest, StudioCanvas } from '#/features/studio/studio-canvas'
import {
  NodePicker,
  OpenDialog,
  SaveDialog,
  SettingsDialog,
  StudioHelp,
  TemplatePicker,
} from '#/features/studio/studio-dialogs'
import { createStudioSession, type StudioSession } from '#/features/studio/studio-session'
import { pipelineShape } from '#/features/usage/pipeline-shape'
import { track } from '#/features/usage/usage'
import { usePageView } from '#/features/usage/use-page-view'
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
            {QUICK_TOOL_GROUPS.flatMap((group) => group.tools).map((tool) => (
              <Link key={tool} href={QUICK_TOOL_DEFINITIONS[tool].path} hasUnderline isStandalone>
                {QUICK_TOOL_DEFINITIONS[tool].title}
              </Link>
            ))}
          </VStack>
        }
      />
    </Center>
  )
}

/** The saved pipeline or the draft to open, or null to offer the templates. */
function initialPipeline(savedPipelineId: string | undefined) {
  const draft = draftStore().read()
  const saved = savedPipelineId ? pipelineStore().get(savedPipelineId) : undefined
  const usable = (pipeline: Parameters<typeof validatePipeline>[0]) => {
    try {
      validatePipeline(pipeline, registry)
      return true
    } catch {
      return false
    }
  }
  if (saved) {
    if (draft?.savedId === saved.id && usable(draft.pipeline)) {
      const changed = JSON.stringify(draft.pipeline) !== JSON.stringify(saved.pipeline)
      return { named: draft, savedId: saved.id, dirty: changed || draft.name !== saved.name }
    }
    return { named: saved, savedId: saved.id, dirty: false }
  }
  if (!savedPipelineId && draft && draft.savedId === null && usable(draft.pipeline)) {
    return { named: draft, savedId: null, dirty: true }
  }
  return null
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
  const [nodeRequest, setNodeRequest] = useState<AddNodeRequest | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const [libraryCollapsed, setLibraryCollapsed] = useState(false)

  useEffect(() => {
    const initial = initialPipeline(savedPipelineId)
    if (initial) {
      store.load(initial.named, initial.savedId, { dirty: initial.dirty })
      requestAnimationFrame(() => void flow.fitView(FIT_VIEW))
    } else {
      setDialog('templates')
    }
    session.refresh()
  }, [savedPipelineId, session, store, flow])

  // Keep the pipeline being edited, so a reload or a closed tab does not lose it.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const unsubscribe = store.subscribe(() => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        const { name, pipeline, savedId } = store.getState()
        draftStore().write({ name, pipeline, savedId })
      }, DRAFT_SAVE_DELAY_MS)
    })
    return () => {
      clearTimeout(timer)
      unsubscribe()
    }
  }, [store])

  const centre = () => {
    const { x, y, zoom } = flow.getViewport()
    const bounds = document.querySelector('.react-flow')?.getBoundingClientRect()
    const offset = studio.pipeline.nodes.length * 12
    return bounds
      ? {
          x: (bounds.width / 2 - x) / zoom - NODE_WIDTH / 2 + offset,
          y: (bounds.height / 2 - y) / zoom - 60 + offset,
        }
      : { x: offset, y: offset }
  }

  const addNode = (type: string, method: 'click' | 'search', request?: AddNodeRequest) => {
    const position = request?.position ?? centre()
    if (request?.after) {
      const added = store.addNodeAfter(type, request.after, position)
      if (added) {
        track('node_added', { nodeType: type, method })
        if (added.check.status === 'refused') {
          showToast({ body: added.check.message, type: 'error', uniqueID: 'connection' })
        }
      }
      return
    }
    const id = store.addNode(type, position)
    if (id) track('node_added', { nodeType: type, method })
  }

  /** Adds an Output after a node, or after the one node nothing follows yet. */
  const addOutput = (after?: string) => {
    const { pipeline, selectedNodeId } = store.getState()
    const leaves = pipeline.nodes.filter(
      (node) =>
        node.type !== 'output' &&
        !pipeline.connections.some((connection) => connection.source === node.id),
    )
    const selected = pipeline.nodes.find(
      (node) => node.id === selectedNodeId && node.type !== 'output',
    )
    const source = after ?? selected?.id ?? (leaves.length === 1 ? leaves[0].id : undefined)
    const node = pipeline.nodes.find((candidate) => candidate.id === source)
    addNode('output', 'click', {
      position: node ? { x: node.position.x + NODE_WIDTH + 60, y: node.position.y } : centre(),
      after: source,
    })
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, [contenteditable=true]')) return
      const mod = event.metaKey || event.ctrlKey
      const key = event.key.toLowerCase()
      if (mod && key === 'z') {
        event.preventDefault()
        if (event.shiftKey) store.redo()
        else store.undo()
      } else if (mod && key === 'y') {
        event.preventDefault()
        store.redo()
      } else if (mod && key === 's') {
        event.preventDefault()
        setDialog('save')
      } else if (mod && key === 'k') {
        event.preventDefault()
        setNodeRequest({ position: centre() })
      } else if (mod && key === 'd') {
        event.preventDefault()
        const { selectedNodeId } = store.getState()
        if (selectedNodeId && !runs.getState().running) store.duplicateNode(selectedNodeId)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const selected = studio.pipeline.nodes.find((node) => node.id === studio.selectedNodeId)
  const hasFiles = studio.pipeline.nodes.some((node) => node.type === 'files')
  const hasOutput = studio.pipeline.nodes.some((node) => node.type === 'output')

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
    await session.start({ folders })
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
      requestAnimationFrame(() => void flow.fitView(FIT_VIEW))
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
  const imageCount = `${formatCount(run.sources.length)} image${run.sources.length === 1 ? '' : 's'}`
  const status = run.running
    ? `Running · ${formatCount(run.stats.finishedItems)} of ${formatCount(run.sources.length)}`
    : run.sources.length === 0
      ? 'No images yet'
      : estimate
        ? `${imageCount} · ${describeEstimate(estimate)}`
        : imageCount
  const downloads = Object.values(run.stats.deliveries).filter((delivery) => delivery.archive)
  const runBlocker =
    run.sources.length === 0
      ? 'Add images first: drop them on the canvas.'
      : !hasOutput
        ? 'Add an Output node first, or nothing is saved.'
        : undefined

  const header = (
    <LayoutHeader hasDivider padding={0}>
      <HStack gap={3} paddingInline={3} paddingBlock={2} vAlign="center" hAlign="between">
        <HStack gap={1} vAlign="center">
          <PipelineName name={studio.name} onRename={(name) => store.rename(name)} />
          <Divider orientation="vertical" />
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
            variant="ghost"
            onClick={() => setDialog('save')}
          />
          <MoreMenu
            label="Pipeline menu"
            size="sm"
            items={[
              { label: 'New pipeline…', onClick: () => setDialog('templates') },
              { label: 'Open saved pipeline…', onClick: () => setDialog('open') },
              { type: 'divider' },
              { label: 'Import .hexlode file…', onClick: () => importInput.current?.click() },
              { label: 'Export .hexlode file', onClick: exportFile },
              ...(studio.savedId
                ? [
                    { type: 'divider' as const },
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
        </HStack>
        <HStack gap={1} vAlign="center">
          <Text type="supporting" maxLines={1}>
            {status}
          </Text>
          <Divider orientation="vertical" />
          <Popover
            content={<StudioHelp />}
            label="Studio help"
            placement="below"
            alignment="end"
            isOpen={helpOpen}
            onOpenChange={setHelpOpen}
            hasAutoFocus={false}
          >
            <IconButton
              label="Help"
              tooltip="How the Studio works"
              icon={<CircleHelp size={16} />}
              variant="ghost"
              size="sm"
            />
          </Popover>
          <IconButton
            label="Settings"
            tooltip="Settings"
            icon={<Settings size={16} />}
            variant="ghost"
            size="sm"
            onClick={() => setDialog('settings')}
          />
          {!run.running && downloads.length > 0 ? (
            <Button
              label={downloads.length === 1 ? 'Download' : `Download ${downloads.length} ZIPs`}
              size="sm"
              icon={<Icon icon={Download} size="sm" />}
              onClick={() => {
                for (const delivery of downloads) downloadDelivery(delivery, 'studio')
              }}
            />
          ) : null}
          {run.running ? (
            <Button label="Cancel" size="sm" variant="secondary" onClick={() => runs.cancel()} />
          ) : (
            <Button
              label="Run"
              size="sm"
              icon={<Icon icon={Play} size="sm" />}
              variant="primary"
              tooltip={runBlocker}
              isDisabled={runBlocker !== undefined || run.preparing}
              clickAction={start}
            />
          )}
        </HStack>
      </HStack>
    </LayoutHeader>
  )

  return (
    <>
      <Layout
        height="fill"
        header={header}
        start={
          <LayoutPanel
            width={libraryCollapsed ? LIBRARY_RAIL_WIDTH : LIBRARY_WIDTH}
            hasDivider
            padding={libraryCollapsed ? 2 : 3}
            label="Nodes"
          >
            <NodeLibrary
              registry={registry}
              onAdd={addNode}
              hasFiles={hasFiles}
              isCollapsed={libraryCollapsed}
              onCollapsedChange={setLibraryCollapsed}
            />
          </LayoutPanel>
        }
        end={
          selected ? (
            <LayoutPanel width={INSPECTOR_WIDTH} hasDivider padding={0} label="Inspector">
              <VStack gap={0}>
                {run.error || previews.error ? (
                  <VStack gap={2} padding={4}>
                    {run.error ? (
                      <Banner status="error" title="The run stopped" description={run.error} />
                    ) : null}
                    {previews.error ? (
                      <Banner
                        status="warning"
                        title="Preview unavailable"
                        description={previews.error}
                      />
                    ) : null}
                  </VStack>
                ) : null}
                <NodeInspector
                  session={session}
                  registry={registry}
                  node={selected}
                  run={run}
                  previews={previews}
                  onClose={() => store.select(null)}
                />
              </VStack>
            </LayoutPanel>
          ) : undefined
        }
        content={
          <LayoutContent padding={0} isScrollable={false} label="Canvas">
            <VStack gap={0} height="100%">
              {run.error && !selected ? (
                <Banner status="error" title="The run stopped" description={run.error} />
              ) : null}
              <StudioCanvas
                session={session}
                registry={registry}
                studio={studio}
                run={run}
                previews={previews}
                onAddNode={setNodeRequest}
                onAddOutput={addOutput}
              />
            </VStack>
          </LayoutContent>
        }
      />
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
      <TemplatePicker
        isOpen={dialog === 'templates'}
        onOpenChange={(open) => setDialog(open ? 'templates' : null)}
        registry={registry}
        hasSaved={saved.length > 0}
        onImport={() => importInput.current?.click()}
        onOpenSaved={() => setDialog('open')}
        onChoose={(template) => {
          store.load({
            name: template.id === 'blank' ? 'Untitled pipeline' : template.name,
            pipeline: template.pipeline,
          })
          session.refresh()
          setDialog(null)
          track('template_chosen', { template: template.id })
          requestAnimationFrame(() => void flow.fitView(FIT_VIEW))
        }}
      />
      <NodePicker
        isOpen={nodeRequest !== null}
        onOpenChange={(open) => {
          if (!open) setNodeRequest(null)
        }}
        registry={registry}
        hasFiles={hasFiles}
        onChoose={(type) => {
          if (nodeRequest) addNode(type, 'search', nodeRequest)
          setNodeRequest(null)
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
    <span className="flex min-h-0 flex-1 flex-col">
      {mounted ? (
        <EngineGate>
          <StudioClient savedPipelineId={savedPipelineId} />
        </EngineGate>
      ) : null}
    </span>
  )
}
