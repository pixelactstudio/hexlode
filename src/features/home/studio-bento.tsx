import { Button } from '@astryxdesign/core/Button'
import { Icon } from '@astryxdesign/core/Icon'
import { ArrowRight, Bookmark, Check, LoaderCircle, Workflow } from 'lucide-react'
import { AnimatePresence, motion, useInView } from 'motion/react'
import { type ReactNode, useRef } from 'react'

import { IconTile, type Tone } from '#/features/app-shell/icon-tile'
import { Drop, FitDrawing, useLoop } from '#/features/home/motion-kit'
import { Cell, Section, SectionHeader } from '#/features/home/section'
import { TEMPLATES } from '#/features/pipelines/templates'
import { NODE_ICONS } from '#/features/studio/node-ui'
import { RouterLink } from '#/lib/router-link'

/*
 * The Studio's features, each with a small moving picture drawn in HTML with the Studio's own
 * node icons and colours. Every claim matches idea.md: previews per node, workers per core, the
 * step cache, and saving a pipeline as a tool.
 */

const TONES: Record<string, Tone> = {
  files: 'blue',
  resize: 'purple',
  crop: 'purple',
  rotate: 'purple',
  convert: 'green',
  output: 'green',
}

function NodeIcon({ type }: { type: string }) {
  const icon = NODE_ICONS[type]
  return icon ? <IconTile icon={icon} tone={TONES[type] ?? 'gray'} size="sm" /> : null
}

// ─── Chain steps ────────────────────────────────────────────────────────────

const NODE_WIDTH = 176
const NODE_HEIGHT = 52
const GRAPH_WIDTH = 800
const GRAPH_HEIGHT = 240
/** Seconds for one pass of items through the whole graph. */
const PERIOD = 3.6

const GRAPH_NODES = [
  { id: 'files', type: 'files', title: 'Files', detail: '240 images', x: 0, y: 94, stage: 0 },
  {
    id: 'resize',
    type: 'resize',
    title: 'Resize',
    detail: 'Longest edge 1600 px',
    x: 206,
    y: 94,
    stage: 1,
  },
  {
    id: 'webp',
    type: 'convert',
    title: 'Convert',
    detail: 'WebP, quality 80',
    x: 412,
    y: 24,
    stage: 2,
  },
  {
    id: 'avif',
    type: 'convert',
    title: 'Convert',
    detail: 'AVIF, quality 60',
    x: 412,
    y: 164,
    stage: 2,
  },
  { id: 'web', type: 'output', title: 'Output', detail: 'web.zip', x: 618, y: 24, stage: 3 },
  { id: 'thumbs', type: 'output', title: 'Output', detail: 'avif.zip', x: 618, y: 164, stage: 3 },
]

const GRAPH_EDGES = [
  ['files', 'resize'],
  ['resize', 'webp'],
  ['resize', 'avif'],
  ['webp', 'web'],
  ['avif', 'thumbs'],
] as const

function nodeById(id: string) {
  return GRAPH_NODES.find((node) => node.id === id) ?? GRAPH_NODES[0]
}

function edgePath(sourceId: string, targetId: string) {
  const source = nodeById(sourceId)
  const target = nodeById(targetId)
  const sx = source.x + NODE_WIDTH
  const sy = source.y + NODE_HEIGHT / 2
  const tx = target.x
  const ty = target.y + NODE_HEIGHT / 2
  const bend = (tx - sx) / 2
  return `M${sx} ${sy} C${sx + bend} ${sy} ${tx - bend} ${ty} ${tx} ${ty}`
}

type GraphNode = (typeof GRAPH_NODES)[number]

/** A node drawn like the Studio's, with a dot that lights up as items pass through. */
function GraphNodeCard({
  node,
  isLit,
  className = '',
  style,
}: {
  node: GraphNode
  isLit: boolean
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 shadow-sm ${className}`}
      style={style}
    >
      <NodeIcon type={node.type} />
      <span className="flex min-w-0 flex-col">
        <span className="font-semibold text-[13px] text-primary leading-tight">{node.title}</span>
        <span className="truncate text-[11px] text-secondary">{node.detail}</span>
      </span>
      <span className="absolute top-2 right-2 size-1.5 rounded-full bg-border-strong" />
      {isLit ? (
        <motion.span
          className="absolute top-2 right-2 size-1.5 rounded-full bg-green-vivid"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 1, 0] }}
          transition={{
            duration: PERIOD,
            times: [0, 0.08, 0.7, 1],
            delay: node.stage * 0.8 + 0.6,
            repeat: Number.POSITIVE_INFINITY,
          }}
        />
      ) : null}
    </div>
  )
}

/** The graph on wider screens: nodes in columns with beams running along the edges. */
function PipelineGraph({ isLit }: { isLit: boolean }) {
  return (
    <FitDrawing width={GRAPH_WIDTH} height={GRAPH_HEIGHT}>
      <svg
        aria-hidden="true"
        className="absolute inset-0 overflow-visible"
        width={GRAPH_WIDTH}
        height={GRAPH_HEIGHT}
        fill="none"
      >
        {GRAPH_EDGES.map(([source, target]) => (
          <path
            key={`${source}-${target}`}
            d={edgePath(source, target)}
            className="stroke-border-strong"
            strokeWidth={1.5}
          />
        ))}
        {isLit
          ? GRAPH_EDGES.map(([source, target]) => (
              <motion.path
                key={`beam-${source}-${target}`}
                d={edgePath(source, target)}
                pathLength={1}
                className="text-red-vivid"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeDasharray="0.3 1"
                initial={{ strokeDashoffset: 0.3 }}
                animate={{ strokeDashoffset: -1 }}
                transition={{
                  duration: 0.9,
                  delay: nodeById(source).stage * 0.8,
                  ease: 'easeInOut',
                  repeat: Number.POSITIVE_INFINITY,
                  repeatDelay: PERIOD - 0.9,
                }}
              />
            ))
          : null}
      </svg>
      {GRAPH_NODES.map((node) => (
        <GraphNodeCard
          key={node.id}
          node={node}
          isLit={isLit}
          className="absolute"
          style={{ left: node.x, top: node.y, width: NODE_WIDTH, height: NODE_HEIGHT }}
        />
      ))}
    </FitDrawing>
  )
}

/** The same graph on phones, stacked from top to bottom. */
function PipelineStack({ isLit }: { isLit: boolean }) {
  const [files, resize, webp, avif, web, thumbs] = GRAPH_NODES
  const card = (node: GraphNode) => (
    <GraphNodeCard node={node} isLit={isLit} className="relative h-12 w-full" />
  )
  return (
    <div className="flex w-full max-w-[340px] flex-col items-center">
      <span className="block w-44">{card(files)}</span>
      <Drop />
      <span className="block w-44">{card(resize)}</span>
      <Drop delay={0.4} />
      <span className="block h-3 w-1/2 rounded-t-md border-border-strong border-x border-t" />
      <span className="grid w-full grid-cols-2 gap-3">
        {[
          [webp, web],
          [avif, thumbs],
        ].map(([convert, output]) => (
          <span key={convert.id} className="flex flex-col items-center">
            {card(convert)}
            <Drop delay={0.8} />
            {card(output)}
          </span>
        ))}
      </span>
    </div>
  )
}

function PipelineDemo() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { margin: '-10% 0px' })
  return (
    <div ref={ref} className="flex size-full items-center justify-center px-6">
      <span className="hidden w-full sm:block">
        <PipelineGraph isLit={inView} />
      </span>
      <span className="flex w-full justify-center sm:hidden">
        <PipelineStack isLit={inView} />
      </span>
    </div>
  )
}

// ─── Preview every step ─────────────────────────────────────────────────────

const PREVIEW_SHAPES = [
  { label: '1:1', detail: '1:1 from the centre', width: 112, height: 112, size: '1024 × 1024' },
  { label: '4:5', detail: '4:5 from the centre', width: 90, height: 112, size: '819 × 1024' },
  { label: '16:9', detail: '16:9 from the centre', width: 200, height: 112, size: '1536 × 864' },
]

function PreviewDemo() {
  const { ref, step } = useLoop(PREVIEW_SHAPES.length, 2000)
  const shape = PREVIEW_SHAPES[step]
  return (
    <div
      ref={ref}
      className="flex w-[264px] flex-col gap-2.5 rounded-xl border border-border bg-card p-3 shadow-sm"
    >
      <div className="flex items-center gap-2">
        <NodeIcon type="crop" />
        <span className="flex min-w-0 flex-col">
          <span className="font-semibold text-[13px] text-primary leading-tight">Crop</span>
          <span className="text-[11px] text-secondary">{shape.detail}</span>
        </span>
      </div>
      <div className="flex gap-1">
        {PREVIEW_SHAPES.map((entry) => (
          <span
            key={entry.label}
            className="relative flex-1 rounded-md py-1 text-center font-medium text-[11px] text-secondary"
          >
            {entry.label === shape.label ? (
              <motion.span
                layoutId="preview-shape"
                className="absolute inset-0 rounded-md bg-muted ring-1 ring-border"
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              />
            ) : null}
            <span className={`relative ${entry.label === shape.label ? 'text-primary' : ''}`}>
              {entry.label}
            </span>
          </span>
        ))}
      </div>
      <div className="flex h-[128px] items-center justify-center rounded-lg bg-muted">
        <motion.div
          className="overflow-hidden rounded-md shadow-md"
          initial={false}
          animate={{ width: shape.width, height: shape.height }}
          transition={{ type: 'spring', stiffness: 160, damping: 22 }}
        >
          <img
            src="/home/photo-dusk.webp"
            alt=""
            draggable={false}
            className="block size-full object-cover"
          />
        </motion.div>
      </div>
      <span className="text-[11px] text-secondary tabular-nums">JPEG · {shape.size}</span>
    </div>
  )
}

// ─── Every core ─────────────────────────────────────────────────────────────

const LANES = [1.3, 1.75, 1.1, 1.5]
const BATCH = 240

function WorkersDemo() {
  const { ref, tick } = useLoop(1, 220)
  const done = 60 + ((tick * 3) % (BATCH - 60))
  const inView = useInView(ref, { margin: '-10% 0px' })
  return (
    <div
      ref={ref}
      className="flex w-72 flex-col gap-3.5 rounded-xl border border-border bg-card p-4 shadow-sm"
    >
      <div className="flex items-baseline justify-between">
        <span className="font-medium text-primary text-sm">Converting</span>
        <span className="text-secondary text-xs tabular-nums">
          <span className="font-semibold text-primary">{done}</span> of {BATCH}
        </span>
      </div>
      {LANES.map((duration, index) => (
        <div key={duration} className="flex items-center gap-3">
          <span className="w-16 text-[11px] text-secondary">Worker {index + 1}</span>
          <span className="block h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <motion.span
              className="block h-full origin-left rounded-full bg-linear-to-r from-red-vivid to-pink-vivid"
              initial={{ scaleX: 0.35 + index * 0.15 }}
              animate={inView ? { scaleX: [0, 1] } : undefined}
              transition={{
                duration,
                repeat: Number.POSITIVE_INFINITY,
                ease: 'easeInOut',
                delay: index * 0.2,
              }}
            />
          </span>
        </div>
      ))}
      <span className="block h-1 overflow-hidden rounded-full bg-muted">
        <span
          className="block h-full origin-left rounded-full bg-border-strong transition-transform duration-200"
          style={{ transform: `scaleX(${done / BATCH})` }}
        />
      </span>
    </div>
  )
}

// ─── Step cache ─────────────────────────────────────────────────────────────

type RowState = 'done' | 'changed' | 'cached' | 'running' | 'processed'

const CACHE_STEPS: { type: string; title: string; states: RowState[] }[] = [
  { type: 'rotate', title: 'Rotate', states: ['done', 'done', 'cached', 'cached', 'cached'] },
  { type: 'resize', title: 'Resize', states: ['done', 'done', 'cached', 'cached', 'cached'] },
  {
    type: 'convert',
    title: 'Convert',
    states: ['done', 'changed', 'running', 'processed', 'processed'],
  },
  {
    type: 'output',
    title: 'Output',
    states: ['done', 'changed', 'changed', 'running', 'processed'],
  },
]

function StateBadge({ state }: { state: RowState }) {
  const look: Record<RowState, { label: string; className: string; icon?: ReactNode }> = {
    done: { label: 'Done', className: 'text-secondary' },
    changed: { label: 'Changed', className: 'text-orange-vivid' },
    cached: { label: 'From step cache', className: 'text-blue-vivid' },
    running: {
      label: 'Running',
      className: 'text-primary',
      icon: (
        <span className="inline-flex animate-spin">
          <Icon icon={LoaderCircle} size="xsm" color="inherit" />
        </span>
      ),
    },
    processed: {
      label: 'Processed',
      className: 'text-green-vivid',
      icon: <Icon icon={Check} size="xsm" color="inherit" />,
    },
  }
  const { label, className, icon } = look[state]
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={state}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.25 }}
        className={`ms-auto inline-flex items-center gap-1 font-medium text-[11px] ${className}`}
      >
        {icon}
        {label}
      </motion.span>
    </AnimatePresence>
  )
}

function CacheDemo() {
  const { ref, step } = useLoop(6, 1100)
  const phase = Math.min(step, 4)
  return (
    <div
      ref={ref}
      className="flex w-72 flex-col gap-1.5 rounded-xl border border-border bg-card p-3 shadow-sm"
    >
      {CACHE_STEPS.map((row) => {
        const state = row.states[phase]
        const isEdited = row.type === 'convert' && phase === 1
        return (
          <div
            key={row.type}
            className={`flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors ${
              isEdited ? 'bg-muted ring-1 ring-orange-vivid/50' : ''
            }`}
          >
            <NodeIcon type={row.type} />
            <span className="flex min-w-0 flex-col">
              <span className="font-semibold text-[13px] text-primary leading-tight">
                {row.title}
              </span>
              {row.type === 'convert' ? (
                <span className="text-[11px] text-secondary tabular-nums">
                  WebP, quality {phase >= 1 ? 60 : 80}
                </span>
              ) : null}
            </span>
            <StateBadge state={state} />
          </div>
        )
      })}
    </div>
  )
}

// ─── Save as a tool ─────────────────────────────────────────────────────────

const SAVED = ['Photos for email', 'Square thumbnails']

function SaveDemo() {
  const { ref, step } = useLoop(5, 1200)
  const pressed = step === 1
  const added = step >= 2
  return (
    <div ref={ref} className="flex w-72 flex-col gap-3">
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-2.5 shadow-sm">
        {['files', 'resize', 'convert', 'output'].map((type, index) => (
          <span key={type} className="flex items-center gap-2">
            {index > 0 ? <span className="h-px w-2.5 bg-border-strong" /> : null}
            <NodeIcon type={type} />
          </span>
        ))}
        <motion.span
          className="ms-auto rounded-md bg-primary px-2.5 py-1 font-semibold text-[11px] text-on-accent"
          animate={{ scale: pressed ? 0.9 : 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 20 }}
        >
          Save
        </motion.span>
      </div>
      <div className="flex flex-col gap-1 rounded-xl border border-border bg-card p-2 shadow-sm">
        <span className="flex items-center gap-1.5 px-1.5 pt-0.5 pb-1 text-[11px] text-secondary">
          <Icon icon={Bookmark} size="xsm" color="inherit" />
          Your tools
        </span>
        <AnimatePresence initial={false}>
          {added ? (
            <motion.span
              key="new"
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 26 }}
              className="block overflow-hidden"
            >
              <span className="flex items-center justify-between rounded-md bg-red-vivid/10 px-2 py-1.5 font-medium text-[13px] text-primary ring-1 ring-red-vivid/30">
                Shop photos
                <Icon icon={ArrowRight} size="xsm" color="secondary" />
              </span>
            </motion.span>
          ) : null}
          {SAVED.map((name) => (
            <motion.span
              key={name}
              layout
              className="flex items-center justify-between rounded-md px-2 py-1.5 text-[13px] text-secondary"
            >
              {name}
              <Icon icon={ArrowRight} size="xsm" color="secondary" />
            </motion.span>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ─── Section ────────────────────────────────────────────────────────────────

const TEMPLATE_NAMES = TEMPLATES.filter((template) => template.id !== 'blank').map(
  (template) => template.name,
)

/** The Studio, the flagship: what it does, shown in five cells. */
export function StudioBento() {
  return (
    <Section id="studio">
      <SectionHeader
        icon={Workflow}
        pill="The Studio"
        title="Build a pipeline once. Run it on every image."
        text="Connect steps on a canvas, check each one on a sample image, then run the whole batch. Start from a template or from a blank canvas."
      />
      <div className="grid gap-px border-border border-t bg-border lg:grid-cols-3">
        <Cell
          className="lg:col-span-2"
          title="Chain steps on a canvas"
          text="Drag steps in, connect them, and branch one input into several results, such as a WebP for the web and an AVIF for thumbnails."
        >
          <PipelineDemo />
        </Cell>
        <Cell
          title="See every step before you run"
          text="Each step shows its result on a sample image, and updates the moment you change a setting."
        >
          <PreviewDemo />
        </Cell>
        <Cell
          title="Uses every core"
          text="Work is spread over Web Workers, one for each spare processor core, so a big folder never freezes the page."
        >
          <WorkersDemo />
        </Cell>
        <Cell
          title="Reruns only what changed"
          text="Change one setting and run again. Steps before it come straight from the step cache."
        >
          <CacheDemo />
        </Cell>
        <Cell
          title="Save it as your own tool"
          text="A saved pipeline gets its own page. Drop new images on it and run, without opening the canvas."
        >
          <SaveDemo />
        </Cell>
      </div>
      <div className="flex flex-col items-center gap-4 border-border border-t px-6 py-8 md:flex-row md:justify-between md:px-8">
        <span className="flex flex-wrap items-center justify-center gap-2 text-secondary text-sm md:justify-start">
          <span className="me-1">Templates</span>
          {TEMPLATE_NAMES.map((name) => (
            <RouterLink
              key={name}
              href="/studio"
              className="rounded-full border border-border px-3 py-1 text-primary no-underline outline-accent transition-colors hover:bg-muted focus-visible:outline-2"
            >
              {name}
            </RouterLink>
          ))}
        </span>
        <Button
          label="Open the Studio"
          href="/studio"
          variant="secondary"
          endContent={<Icon icon={ArrowRight} size="sm" />}
        />
      </div>
    </Section>
  )
}
