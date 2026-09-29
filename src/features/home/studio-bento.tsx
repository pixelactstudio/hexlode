import { Button } from '@astryxdesign/core/Button'
import { Icon } from '@astryxdesign/core/Icon'
import { gsap } from 'gsap'
import {
  ArrowRight,
  Bookmark,
  Check,
  CornerDownLeft,
  LoaderCircle,
  Play,
  Workflow,
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { type ReactNode, useState } from 'react'

import { IconTile, type Tone } from '#/features/app-shell/icon-tile'
import { BATCH_SIZE, BEAT, COLUMN_DELAY, EASE, STAGGER } from '#/features/home/constants'
import { FitDrawing, Rolling, SceneCursor } from '#/features/home/motion-kit'
import { clickOn, useScene } from '#/features/home/scene'
import { Cell, Section, SectionHeader } from '#/features/home/section'
import { planWorkers } from '#/features/home/worker-plan'
import { TEMPLATES } from '#/features/pipelines/templates'
import { NODE_ICONS } from '#/features/studio/node-ui'
import { RouterLink } from '#/lib/router-link'

/*
 * The Studio's features, each a short directed scene drawn in HTML with the Studio's own node
 * icons and colours. Every scene follows the same batch of 240 photos, has one thing moving at a
 * time, and rests on its last frame before it plays again. Every claim matches idea.md: previews
 * per node, workers per core, the step cache, and saving a pipeline as a tool.
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

/** A card that holds a scene: a 12px corner, so the 4px corners inside sit 8px in. */
const CARD = 'relative rounded-lg border border-border bg-card shadow-sm'

// ─── Chain steps ────────────────────────────────────────────────────────────

const NODE_WIDTH = 176
const NODE_HEIGHT = 52
const GRAPH_WIDTH = 800
const GRAPH_HEIGHT = 240
/** Seconds between one stage of the graph lighting up and the next. */
const STAGE_GAP = 0.75
const LAST_STAGE = 3
/**
 * The beam is a dash a sixth of an edge long, with a gap longer than any edge. It waits just
 * before the start, where its round cap cannot show, and runs until it is just past the end.
 */
const BEAM = 0.16
const BEAM_START = BEAM + 0.05
const BEAM_END = -1.05

const GRAPH_NODES = [
  {
    id: 'files',
    type: 'files',
    title: 'Files',
    detail: `${BATCH_SIZE} images`,
    x: 0,
    y: 94,
    stage: 0,
  },
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

/** A node drawn like the Studio's, with a lamp that lights as the batch passes through. */
function GraphNodeCard({
  node,
  className = '',
  style,
}: {
  node: GraphNode
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <div
      data-stage={node.stage}
      className={`flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 shadow-sm ${className}`}
      style={style}
    >
      <span
        data-glow=""
        className="pointer-events-none absolute -inset-px rounded-[inherit] border border-red-vivid/70 opacity-0 shadow-[0_0_28px_-8px_var(--color-red-vivid)]"
      />
      <NodeIcon type={node.type} />
      <span className="flex min-w-0 flex-col">
        <span className="font-semibold text-[13px] text-primary leading-tight">{node.title}</span>
        <span className="truncate text-[11px] text-secondary">{node.detail}</span>
      </span>
      <span className="absolute top-2 right-2 size-1.5 rounded-full bg-border-strong" />
      <span
        data-lamp=""
        className="absolute top-2 right-2 size-1.5 rounded-full bg-green-vivid opacity-0 shadow-[0_0_8px_var(--color-green-vivid)]"
      />
    </div>
  )
}

/** The graph on wider screens: nodes in columns, joined by curves the batch runs along. */
function PipelineGraph() {
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
            data-edge=""
            data-to={nodeById(target).stage}
            d={edgePath(source, target)}
            pathLength={1}
            strokeDasharray="1"
            className="stroke-border-strong"
            strokeWidth={1.5}
          />
        ))}
        {GRAPH_EDGES.map(([source, target]) => (
          <path
            key={`beam-${source}-${target}`}
            data-beam=""
            data-from={nodeById(source).stage}
            d={edgePath(source, target)}
            pathLength={1}
            className="text-red-vivid"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeDasharray={`${BEAM} 2`}
            strokeDashoffset={BEAM_START}
          />
        ))}
      </svg>
      {GRAPH_NODES.map((node) => (
        <GraphNodeCard
          key={node.id}
          node={node}
          className="absolute"
          style={{ left: node.x, top: node.y, width: NODE_WIDTH, height: NODE_HEIGHT }}
        />
      ))}
    </FitDrawing>
  )
}

/** A short vertical line between stacked steps on phones, drawn in as the next step arrives. */
function Link({ to }: { to: number }) {
  return (
    <span
      aria-hidden="true"
      data-link=""
      data-to={to}
      className="block h-6 w-px origin-top bg-border-strong"
    />
  )
}

/** The same graph on phones, stacked from top to bottom. */
function PipelineStack() {
  const [files, resize, webp, avif, web, thumbs] = GRAPH_NODES
  const card = (node: GraphNode) => <GraphNodeCard node={node} className="relative h-12 w-full" />
  return (
    <div className="flex w-full max-w-[340px] flex-col items-center">
      <span className="block w-44">{card(files)}</span>
      <Link to={1} />
      <span className="block w-44">{card(resize)}</span>
      <Link to={2} />
      <span
        data-link=""
        data-to={2}
        className="block h-3 w-1/2 origin-top rounded-t-sm border-border-strong border-x border-t"
      />
      <span className="grid w-full grid-cols-2 gap-3">
        {[
          [webp, web],
          [avif, thumbs],
        ].map(([convert, output]) => (
          <span key={convert.id} className="flex flex-col items-center">
            {card(convert)}
            <Link to={3} />
            {card(output)}
          </span>
        ))}
      </span>
    </div>
  )
}

/**
 * Builds the pipeline stage by stage, drawing each edge before the step it leads to, then runs
 * the batch through it again and again: each stage lights up as the batch reaches it.
 */
function PipelineDemo() {
  const ref = useScene((timeline, q) => {
    for (let stage = 0; stage <= LAST_STAGE; stage++) {
      if (stage > 0) {
        timeline
          .fromTo(
            q(`[data-edge][data-to="${stage}"]`),
            { attr: { 'stroke-dashoffset': 1 } },
            { attr: { 'stroke-dashoffset': 0 }, duration: BEAT.base, ease: EASE.move },
          )
          .fromTo(
            q(`[data-link][data-to="${stage}"]`),
            { scaleY: 0 },
            { scaleY: 1, duration: BEAT.base, ease: EASE.move },
            '<',
          )
      }
      timeline.from(
        q(`[data-stage="${stage}"]`),
        { autoAlpha: 0, y: 10, duration: BEAT.base, ease: EASE.enter, stagger: STAGGER },
        stage === 0 ? 0 : '-=0.15',
      )
    }
    timeline.addLabel('poster')

    const run = gsap.timeline({ repeat: -1, repeatDelay: BEAT.read })
    for (let stage = 0; stage <= LAST_STAGE; stage++) {
      const at = stage * STAGE_GAP
      run
        .to(q(`[data-stage="${stage}"] [data-lamp]`), { autoAlpha: 1, duration: BEAT.quick }, at)
        .fromTo(
          q(`[data-stage="${stage}"] [data-glow]`),
          { autoAlpha: 1 },
          { autoAlpha: 0, duration: 1, ease: 'power1.out', immediateRender: false },
          at,
        )
      if (stage < LAST_STAGE) {
        run.fromTo(
          q(`[data-beam][data-from="${stage}"]`),
          { attr: { 'stroke-dashoffset': BEAM_START } },
          { attr: { 'stroke-dashoffset': BEAM_END }, duration: STAGE_GAP + 0.1, ease: EASE.move },
          at,
        )
      }
    }
    run.to(q('[data-lamp]'), { autoAlpha: 0, duration: BEAT.base }, `+=${BEAT.rest}`)
    timeline.add(run, '+=0.4')
  })
  return (
    <div ref={ref} className="flex size-full items-center justify-center px-6">
      <span className="hidden w-full sm:block">
        <PipelineGraph />
      </span>
      <span className="flex w-full justify-center sm:hidden">
        <PipelineStack />
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

/** The pointer picks each shape in turn, and the sample photo reframes to match. */
function PreviewDemo() {
  const [step, setStep] = useState(0)
  const shape = PREVIEW_SHAPES[step]
  const ref = useScene(
    (timeline, q, root) => {
      const chips = q('[data-chip]')
      const cursor = q('[data-cursor]')
      timeline.addLabel('poster', 0).set(cursor, { x: 230, y: 200 })
      for (const index of [1, 2, 0]) {
        const chip = chips[index] as HTMLElement
        const next = PREVIEW_SHAPES[index]
        clickOn(timeline, cursor, chip, root)
          .call(setStep, [index])
          .to(
            q('[data-highlight]'),
            { x: chip.offsetLeft, duration: BEAT.base, ease: EASE.enter },
            '<',
          )
          .to(
            q('[data-frame]'),
            { width: next.width, height: next.height, duration: BEAT.move, ease: EASE.move },
            '<',
          )
          .to({}, { duration: BEAT.read })
      }
      timeline.to(cursor, { autoAlpha: 0, duration: BEAT.base })
    },
    { delay: COLUMN_DELAY, repeat: -1, repeatDelay: BEAT.base },
  )
  return (
    <div ref={ref} className={`${CARD} flex w-[264px] flex-col gap-2.5 p-3`}>
      <div className="flex items-center gap-2">
        <NodeIcon type="crop" />
        <span className="flex min-w-0 flex-col">
          <span className="font-semibold text-[13px] text-primary leading-tight">Crop</span>
          <span className="text-[11px] text-secondary">
            <Rolling value={shape.detail} />
          </span>
        </span>
      </div>
      <div className="relative flex gap-1">
        <span
          data-highlight=""
          className="absolute inset-y-0 left-0 w-[calc((100%-8px)/3)] rounded bg-muted ring-1 ring-border"
        />
        {PREVIEW_SHAPES.map((entry) => (
          <span
            key={entry.label}
            data-chip=""
            className={`relative flex-1 rounded py-1 text-center font-medium text-[11px] transition-colors ${
              entry.label === shape.label ? 'text-primary' : 'text-secondary'
            }`}
          >
            {entry.label}
          </span>
        ))}
      </div>
      <div className="flex h-[128px] items-center justify-center rounded bg-muted">
        <div data-frame="" className="size-[112px] overflow-hidden rounded-sm shadow-md">
          <img
            src="/home/photo-dusk.webp"
            alt=""
            draggable={false}
            className="block size-full object-cover"
          />
        </div>
      </div>
      <span className="text-[11px] text-secondary tabular-nums">
        JPEG · <Rolling value={shape.size} />
      </span>
      <SceneCursor />
    </div>
  )
}

// ─── Every core ─────────────────────────────────────────────────────────────

const WORKERS = 4
/** The last stretch of the batch: how long each of its images takes to convert, in seconds. */
const JOB_SECONDS = [2.2, 2.8, 1.9, 2.5, 2.1, 2.6, 1.8, 2.4, 2.3, 2.0, 2.7, 1.9]
const JOBS = planWorkers(JOB_SECONDS, WORKERS)
const FIRST_DONE = BATCH_SIZE - JOBS.length
/** The gap between a worker finishing one image and picking up the next. */
const HANDOFF = 0.25
const PHOTOS = ['dusk', 'dawn', 'desert'] as const

type Lane = { job: number; isDone: boolean } | null

const NO_LANES: Lane[] = Array.from({ length: WORKERS }, () => null)
/** A queued image's slot in the up-next row, in pixels: a 14px thumbnail and its gap. */
const QUEUE_SLOT = 17

/**
 * The last twelve images of the batch shared over four workers. They wait in the up-next row; each
 * worker takes one, shows its progress, and takes the next as soon as it is free, so the row
 * empties as the count climbs. When the batch is done the row gives way to the result, then the
 * workers clear and the row fills again for the next pass.
 */
function WorkersDemo() {
  const [lanes, setLanes] = useState<Lane[]>(NO_LANES)
  const [done, setDone] = useState(FIRST_DONE)
  const ref = useScene(
    (timeline, q) => {
      const bars = q('[data-bar]')
      const queue = q('[data-queued]')
      const setLane = (worker: number, lane: Lane) =>
        setLanes((current) => current.map((entry, index) => (index === worker ? lane : entry)))
      timeline
        .call(() => {
          setDone(FIRST_DONE)
          setLanes(NO_LANES)
        })
        .set(bars, { scaleX: 0, autoAlpha: 1 })
      const start = BEAT.base
      const finishes = [...JOBS].sort((a, b) => a.end - b.end)
      for (const job of JOBS) {
        // The first four leave the row one after another rather than as one block.
        const at = start + job.start + (job.start === 0 ? job.worker * STAGGER : 0)
        timeline
          .to(
            queue[job.index],
            { width: 0, autoAlpha: 0, duration: BEAT.quick, ease: EASE.exit },
            at - BEAT.quick,
          )
          .call(setLane, [job.worker, { job: job.index, isDone: false }], at)
          .fromTo(
            bars[job.worker],
            { scaleX: 0 },
            { scaleX: 1, duration: job.end - job.start - HANDOFF, ease: 'power1.inOut' },
            at,
          )
      }
      finishes.forEach((job, order) => {
        const at = start + job.end - HANDOFF
        timeline
          .call(setLane, [job.worker, { job: job.index, isDone: true }], at)
          .call(setDone, [FIRST_DONE + order + 1], at)
      })
      // Rest on the finished batch, then clear the workers and refill the row, which is the frame
      // the scene starts from, so the repeat picks up without a jump.
      timeline
        .addLabel('poster')
        .to({}, { duration: BEAT.rest })
        .call(setLanes, [NO_LANES])
        .to(bars, { autoAlpha: 0, duration: BEAT.base, ease: EASE.exit })
        .call(setDone, [FIRST_DONE])
        .to(queue, {
          width: QUEUE_SLOT,
          autoAlpha: 1,
          duration: BEAT.base,
          ease: EASE.enter,
          stagger: STAGGER / 2,
        })
    },
    { repeat: -1, repeatDelay: 0.4 },
  )
  const isFinished = done === BATCH_SIZE
  const working = lanes.filter((lane) => lane && !lane.isDone).length
  const queued = JOBS.length - (done - FIRST_DONE) - working
  return (
    <div ref={ref} className={`${CARD} flex w-[296px] flex-col gap-3 p-4`}>
      <div className="flex items-baseline justify-between">
        <span className="inline-flex items-center gap-1.5 font-medium text-primary text-sm">
          <Rolling value={isFinished ? 'Batch done' : 'Converting to WebP'} />
        </span>
        <span className="text-secondary text-xs tabular-nums">
          <span className="font-semibold text-primary">
            <Rolling value={String(done)} />
          </span>{' '}
          of {BATCH_SIZE}
        </span>
      </div>
      {lanes.map((lane, worker) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the four workers never reorder
        <div key={worker} className="flex items-center gap-2.5">
          <span className="relative size-7 shrink-0 overflow-hidden rounded bg-muted">
            <AnimatePresence initial={false}>
              {lane ? (
                <motion.img
                  key={lane.job}
                  src={`/home/photo-${PHOTOS[lane.job % PHOTOS.length]}.webp`}
                  alt=""
                  className="absolute inset-0 size-full object-cover"
                  initial={{ opacity: 0, scale: 0.4, x: 12, y: 24 }}
                  animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: BEAT.base, ease: [0.22, 1, 0.36, 1] }}
                />
              ) : null}
            </AnimatePresence>
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="flex items-center justify-between text-[11px]">
              <span className="text-secondary">
                Worker {worker + 1}
                {lane ? (
                  <span className="text-primary">
                    {' · '}
                    <Rolling value={`IMG_${2229 + lane.job}.jpg`} />
                  </span>
                ) : null}
              </span>
              <motion.span
                className="inline-flex text-green-vivid"
                initial={false}
                animate={lane?.isDone ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.5 }}
                transition={{ type: 'spring', stiffness: 500, damping: 24 }}
              >
                <Icon icon={Check} size="xsm" color="inherit" />
              </motion.span>
            </span>
            <span className="block h-1 overflow-hidden rounded-full bg-muted">
              <span
                data-bar=""
                className="block h-full origin-left scale-x-0 rounded-full bg-linear-to-r from-red-vivid to-pink-vivid"
              />
            </span>
          </span>
        </div>
      ))}
      <div className="relative mt-1 h-8 border-border border-t">
        <motion.span
          className="absolute inset-x-0 top-2 bottom-0 flex items-center justify-between gap-2"
          initial={false}
          animate={isFinished ? { opacity: 0, y: -6 } : { opacity: 1, y: 0 }}
          transition={{ duration: BEAT.base }}
        >
          <span className="flex">
            {JOBS.map((job) => (
              <span
                key={job.index}
                data-queued=""
                className="block shrink-0 overflow-hidden"
                style={{ width: QUEUE_SLOT }}
              >
                <img
                  src={`/home/photo-${PHOTOS[job.index % PHOTOS.length]}.webp`}
                  alt=""
                  className="block size-3.5 rounded-[3px] object-cover"
                />
              </span>
            ))}
          </span>
          <span className="shrink-0 text-[11px] text-secondary tabular-nums">
            <Rolling value={queued === 0 ? 'Finishing' : `${queued} queued`} />
          </span>
        </motion.span>
        <motion.span
          className="absolute inset-x-0 top-2 bottom-0 flex items-center gap-1.5 text-primary text-xs"
          initial={false}
          animate={isFinished ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
          transition={{ duration: BEAT.base, delay: isFinished ? BEAT.quick : 0 }}
        >
          <span className="inline-flex text-green-vivid">
            <Icon icon={Check} size="xsm" color="inherit" />
          </span>
          All {BATCH_SIZE} saved as WebP
          <span className="ms-auto text-[11px] text-secondary">{WORKERS} workers</span>
        </motion.span>
      </div>
    </div>
  )
}

// ─── Step cache ─────────────────────────────────────────────────────────────

type RowState = 'done' | 'changed' | 'cached' | 'running' | 'processed'

/** Each step's state in each beat: as run, after the edit, then through the rerun. */
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

/**
 * The pointer lowers Convert's quality, which marks Convert and the step after it as changed, then
 * presses Run: the two steps before come from the step cache at once, and only the changed ones
 * run.
 */
function CacheDemo() {
  const [phase, setPhase] = useState(0)
  const ref = useScene(
    (timeline, q, root) => {
      const cursor = q('[data-cursor]')
      timeline
        .call(setPhase, [0])
        .set(cursor, { x: 250, y: 230 })
        .addLabel('poster')
        .to({}, { duration: BEAT.read })
      clickOn(timeline, cursor, q('[data-quality]')[0], root)
        .call(setPhase, [1])
        .to(q('[data-ring]'), { autoAlpha: 1, duration: BEAT.quick }, '<')
        .to({}, { duration: BEAT.read })
      clickOn(timeline, cursor, q('[data-run]')[0], root)
        .to(q('[data-ring]'), { autoAlpha: 0, duration: BEAT.base })
        .call(setPhase, [2], '<')
        .fromTo(
          q('[data-cached]'),
          { autoAlpha: 1 },
          {
            autoAlpha: 0,
            duration: 0.9,
            ease: 'power1.out',
            stagger: STAGGER,
            immediateRender: false,
          },
          '<',
        )
        .fromTo(
          q('[data-progress]'),
          { scaleX: 0, autoAlpha: 1 },
          { scaleX: 1, duration: 1.6, ease: 'power1.inOut', immediateRender: false },
          '<',
        )
        .to(q('[data-progress]'), { autoAlpha: 0, duration: BEAT.quick })
        .call(setPhase, [3], '<')
        .to({}, { duration: 0.9 })
        .call(setPhase, [4])
        .to(cursor, { autoAlpha: 0, duration: BEAT.base }, `+=${BEAT.rest}`)
    },
    { delay: COLUMN_DELAY, repeat: -1, repeatDelay: BEAT.base },
  )
  return (
    <div ref={ref} className={`${CARD} flex w-72 flex-col gap-1 p-2`}>
      <div className="flex items-center justify-between px-2 pt-1 pb-1.5">
        <span className="text-[11px] text-secondary">Pipeline · {BATCH_SIZE} images</span>
        <span
          data-run=""
          className="inline-flex items-center gap-1 rounded bg-primary px-2 py-0.5 font-semibold text-[11px] text-on-accent"
        >
          <Icon icon={Play} size="xsm" color="inherit" />
          Run
        </span>
      </div>
      {CACHE_STEPS.map((row) => {
        const state = row.states[phase]
        return (
          <div key={row.type} className="relative flex items-center gap-2.5 rounded px-2 py-2">
            {row.type === 'rotate' || row.type === 'resize' ? (
              <span data-cached="" className="absolute inset-0 rounded bg-blue-subtle opacity-0" />
            ) : null}
            {row.type === 'convert' ? (
              <>
                <span
                  data-ring=""
                  className="absolute inset-0 rounded bg-muted opacity-0 ring-1 ring-orange-vivid/50"
                />
                <span
                  data-progress=""
                  className="absolute inset-x-2 bottom-0 h-0.5 origin-left scale-x-0 rounded-full bg-linear-to-r from-red-vivid to-pink-vivid"
                />
              </>
            ) : null}
            <span className="relative flex items-center gap-2.5">
              <NodeIcon type={row.type} />
              <span className="flex min-w-0 flex-col">
                <span className="font-semibold text-[13px] text-primary leading-tight">
                  {row.title}
                </span>
                {row.type === 'convert' ? (
                  <span className="text-[11px] text-secondary">
                    WebP, quality{' '}
                    <span
                      data-quality=""
                      className="inline-flex rounded bg-muted px-1 text-primary tabular-nums ring-1 ring-border"
                    >
                      <Rolling value={phase >= 1 ? '60' : '80'} />
                    </span>
                  </span>
                ) : null}
              </span>
            </span>
            <span className="relative ms-auto">
              <StateBadge state={state} />
            </span>
          </div>
        )
      })}
      <SceneCursor />
    </div>
  )
}

// ─── Save as a tool ─────────────────────────────────────────────────────────

const SAVED = ['Photos for email', 'Square thumbnails']
const NEW_TOOL = 'Shop photos'

/**
 * The pointer presses Save, types a name, and the pipeline joins the list of saved tools, where
 * the pointer opens it.
 */
function SaveDemo() {
  const [typed, setTyped] = useState('')
  const ref = useScene(
    (timeline, q, root) => {
      const cursor = q('[data-cursor]')
      const field = q('[data-field]')
      const row = q('[data-new-row]')
      timeline
        .call(setTyped, [''])
        .set(cursor, { x: 250, y: 210 })
        .set(field, { height: 0, autoAlpha: 0 })
        .set(row, { height: 0, autoAlpha: 0 })
        .to({}, { duration: BEAT.base })
      clickOn(timeline, cursor, q('[data-save]')[0], root).to(field, {
        height: 'auto',
        autoAlpha: 1,
        duration: BEAT.base,
        ease: EASE.enter,
      })
      for (let length = 1; length <= NEW_TOOL.length; length++) {
        timeline.call(setTyped, [NEW_TOOL.slice(0, length)], `+=${length === 1 ? 0.2 : 0.07}`)
      }
      timeline
        .fromTo(
          q('[data-enter]'),
          { scale: 1 },
          { scale: 0.85, duration: 0.1, yoyo: true, repeat: 1 },
          `+=${BEAT.base}`,
        )
        .to(field, { height: 0, autoAlpha: 0, duration: BEAT.base, ease: EASE.move })
        .to(row, { height: 'auto', autoAlpha: 1, duration: BEAT.base, ease: EASE.enter }, '<0.15')
        .fromTo(
          q('[data-new-ring]'),
          { autoAlpha: 1 },
          { autoAlpha: 0, duration: 2, immediateRender: false },
        )
        .addLabel('poster', '<')
      clickOn(timeline, cursor, q('[data-new-name]')[0], root, '<0.4')
        .to({}, { duration: BEAT.rest })
        .to(cursor, { autoAlpha: 0, duration: BEAT.base })
        .to(row, { height: 0, autoAlpha: 0, duration: BEAT.base, ease: EASE.move }, '<')
    },
    { delay: COLUMN_DELAY * 2, repeat: -1, repeatDelay: BEAT.base },
  )
  return (
    <div ref={ref} className="relative flex w-72 flex-col gap-2">
      <div className={`${CARD} flex flex-col p-2`}>
        <div className="flex items-center gap-2">
          {['files', 'resize', 'convert', 'output'].map((type, index) => (
            <span key={type} className="flex items-center gap-2">
              {index > 0 ? <span className="h-px w-2.5 bg-border-strong" /> : null}
              <NodeIcon type={type} />
            </span>
          ))}
          <span
            data-save=""
            className="ms-auto rounded bg-primary px-2.5 py-1 font-semibold text-[11px] text-on-accent"
          >
            Save
          </span>
        </div>
        <div data-field="" className="h-0 overflow-hidden opacity-0">
          <span className="mt-2 flex items-center gap-2 rounded border border-border bg-muted px-2 py-1.5 text-[13px]">
            <span className="text-primary">{typed}</span>
            <span className="-ms-1.5 h-3.5 w-px animate-pulse bg-primary" />
            <span
              data-enter=""
              className="ms-auto inline-flex rounded-sm border border-border px-1 text-secondary"
            >
              <Icon icon={CornerDownLeft} size="xsm" color="inherit" />
            </span>
          </span>
        </div>
      </div>
      <div className={`${CARD} flex flex-col p-2`}>
        <span className="flex items-center gap-1.5 px-1.5 pt-0.5 pb-1.5 text-[11px] text-secondary">
          <Icon icon={Bookmark} size="xsm" color="inherit" />
          Your tools
        </span>
        <span data-new-row="" className="block overflow-hidden">
          <span className="relative mb-0.5 flex items-center justify-between rounded bg-muted px-2 py-1.5 font-medium text-[13px] text-primary">
            <span
              data-new-ring=""
              className="absolute inset-0 rounded bg-red-vivid/10 opacity-0 ring-1 ring-red-vivid/40"
            />
            <span data-new-name="" className="relative">
              {NEW_TOOL}
            </span>
            <Icon icon={ArrowRight} size="xsm" color="secondary" />
          </span>
        </span>
        {SAVED.map((name) => (
          <span
            key={name}
            className="flex items-center justify-between rounded px-2 py-1.5 text-[13px] text-secondary"
          >
            {name}
            <Icon icon={ArrowRight} size="xsm" color="secondary" />
          </span>
        ))}
      </div>
      <SceneCursor />
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
