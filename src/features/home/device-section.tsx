import { Button } from '@astryxdesign/core/Button'
import { Icon } from '@astryxdesign/core/Icon'
import { Heading, Text } from '@astryxdesign/core/Text'
import {
  Archive,
  ArrowRight,
  Cpu,
  FolderOpen,
  Layers,
  MonitorSmartphone,
  ShieldCheck,
} from 'lucide-react'
import { type ComponentType, type SVGProps, useRef, useState } from 'react'

import { REPOSITORY_URL } from '#/features/app-shell/constants'
import { GitHubMark } from '#/features/app-shell/github-mark'
import { HexlodeMark } from '#/features/app-shell/hexlode-mark'
import { BEAT, EASE } from '#/features/home/constants'
import { Drop, FitDrawing, Reveal, Rolling } from '#/features/home/motion-kit'
import { useScene } from '#/features/home/scene'
import { Section, SectionHeader } from '#/features/home/section'

const WIDTH = 900
const HEIGHT = 250
const CHIP = { width: 212, height: 54 }
const TAB = { x: 334, y: 25, width: 232, height: 200 }

const INPUTS = [
  { name: 'IMG_2041.jpg', size: '4.1 MB', photo: 'dusk', y: 28 },
  { name: 'scan-07.png', size: '2.8 MB', photo: 'dawn', y: 98 },
  { name: 'banner.webp', size: '640 KB', photo: 'desert', y: 168 },
] as const

const OUTPUTS = [
  { icon: Archive, name: 'photos.zip', detail: 'Download', y: 28 },
  { icon: FolderOpen, name: 'photos/', detail: 'Or save to a folder', y: 168 },
]

function curve(sx: number, sy: number, tx: number, ty: number) {
  const bend = (tx - sx) / 2
  return `M${sx} ${sy} C${sx + bend} ${sy} ${tx - bend} ${ty} ${tx} ${ty}`
}

const PATHS = [
  ...INPUTS.map((input, index) => ({
    d: curve(CHIP.width, input.y + CHIP.height / 2, TAB.x, TAB.y + 70 + index * 30),
  })),
  ...OUTPUTS.map((output, index) => ({
    d: curve(
      TAB.x + TAB.width,
      TAB.y + 70 + index * 60,
      WIDTH - CHIP.width,
      output.y + CHIP.height / 2,
    ),
  })),
]

type Input = (typeof INPUTS)[number]
type Output = (typeof OUTPUTS)[number]

const CHIP_CLASS =
  'flex items-center gap-2.5 rounded-lg border border-border bg-card px-2.5 shadow-sm'

function InputChip({
  input,
  className = '',
  style,
}: {
  input: Input
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <div className={`${CHIP_CLASS} ${className}`} style={style}>
      <img src={`/home/photo-${input.photo}.webp`} alt="" className="size-8 rounded object-cover" />
      <span className="flex flex-col">
        <span className="font-medium text-[13px] text-primary">{input.name}</span>
        <span className="text-[11px] text-secondary">{input.size}</span>
      </span>
    </div>
  )
}

function OutputChip({
  output,
  detail = output.detail,
  isDelivered = false,
  className = '',
  style,
}: {
  output: Output
  detail?: string
  isDelivered?: boolean
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <div
      className={`${CHIP_CLASS} transition-shadow duration-500 ${
        isDelivered ? 'shadow-[0_0_40px_-12px_var(--color-green-vivid)]' : ''
      } ${className}`}
      style={style}
    >
      <span className="inline-flex size-8 items-center justify-center rounded bg-green-subtle text-green-vivid">
        <Icon icon={output.icon} size="sm" color="inherit" />
      </span>
      <span className="flex flex-col">
        <span className="font-medium text-[13px] text-primary">{output.name}</span>
        <span className="text-[11px] text-secondary">
          <Rolling value={detail} />
        </span>
      </span>
    </div>
  )
}

const STAGES = ['Decode', 'Edit', 'Encode'] as const

function BrowserTab({
  status = 'Web Workers · WebAssembly',
  isBusy = false,
  className = '',
  style,
}: {
  status?: string
  isBusy?: boolean
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <div
      className={`flex flex-col gap-3 rounded-lg border border-red-ring/50 bg-card p-4 transition-shadow duration-500 ${
        isBusy
          ? 'shadow-[0_0_80px_-12px_var(--color-border-red)]'
          : 'shadow-[0_0_60px_-20px_var(--color-border-red)]'
      } ${className}`}
      style={style}
    >
      <span className="flex items-center gap-2">
        <HexlodeMark />
        <span className="font-semibold text-primary text-sm">This browser tab</span>
      </span>
      <span className="flex flex-col gap-1.5">
        {STAGES.map((stage) => (
          <span
            key={stage}
            className="relative flex items-center justify-between overflow-hidden rounded bg-muted px-2.5 py-1.5 text-primary text-xs"
          >
            <span
              data-fill=""
              className="absolute inset-0 origin-left scale-x-0 bg-linear-to-r from-red-vivid/10 to-red-vivid/30"
            />
            <span className="relative">{stage}</span>
            <span className="relative inline-flex">
              <Icon icon={Cpu} size="xsm" color="secondary" />
            </span>
          </span>
        ))}
      </span>
      <span className="mt-auto text-[11px] text-secondary">
        <Rolling value={status} />
      </span>
    </div>
  )
}

/** What the output chips say once a pass has delivered its three files to them. */
const DELIVERED = ['3 files · 2.1 MB', '3 files saved']

/**
 * Images flowing into this browser tab and out as a ZIP or a folder, left to right, as a directed
 * scene. Each file leaves its chip, runs through decode, edit and encode, and the finished batch
 * goes to the ZIP on the first pass and to the folder on the second. Pointing at a chip lights its
 * path, and pressing an input sends that file through next.
 */
function DeviceGraph() {
  const [status, setStatus] = useState<string>('Waiting for images')
  const [isBusy, setBusy] = useState(false)
  const [delivered, setDelivered] = useState<(string | null)[]>([null, null])
  const [hovered, setHovered] = useState<number | null>(null)
  const timeline = useRef<gsap.core.Timeline | null>(null)
  const ref = useScene(
    (scene, q) => {
      const chips = q('[data-chip]')
      const trails = q('[data-trail]')
      const fills = q('[data-fill]')
      // A signal runs along a link: the line draws in from its source, then drains into the
      // chip or tab it points at, so it never fades out halfway.
      const signal = (index: number, position?: gsap.Position) =>
        scene
          .fromTo(
            trails[index],
            { attr: { 'stroke-dashoffset': 1 }, autoAlpha: 1 },
            { attr: { 'stroke-dashoffset': 0 }, duration: BEAT.move, ease: EASE.move },
            position,
          )
          .to(trails[index], {
            attr: { 'stroke-dashoffset': -1 },
            duration: BEAT.base,
            ease: EASE.exit,
          })
      OUTPUTS.forEach((output, pass) => {
        scene
          .call(() => {
            setStatus('Waiting for images')
            setDelivered([null, null])
          })
          .to({}, { duration: BEAT.base })
        INPUTS.forEach((input, index) => {
          const leave = `${pass}-${index}`
          // Each file sets off once the tab is free, so pressing a file starts from a clean frame.
          scene.addLabel(leave)
          if (pass === 0) scene.addLabel(`file${index}`, leave)
          scene
            .to(chips[index], { scale: 0.96, duration: 0.1, yoyo: true, repeat: 1 }, leave)
            .call(setStatus, [`Reading ${input.name}`], leave)
          signal(index, leave).call(setBusy, [true], '<')
          STAGES.forEach((stage, step) => {
            scene
              .call(setStatus, [`${stage} · ${input.name}`])
              .fromTo(
                fills[step],
                { scaleX: 0, autoAlpha: 1 },
                { scaleX: 1, duration: 0.24, ease: EASE.enter },
              )
          })
          scene.to(fills, { autoAlpha: 0, duration: BEAT.quick })
        })
        const outputPath = INPUTS.length + pass
        scene.call(setStatus, [`3 images · ${output.name}`]).call(setBusy, [false])
        signal(outputPath)
          .call(() =>
            setDelivered((current) =>
              current.map((entry, index) => (index === pass ? DELIVERED[pass] : entry)),
            ),
          )
          .to(
            chips[outputPath],
            { scale: 1.04, duration: BEAT.quick, yoyo: true, repeat: 1, ease: EASE.enter },
            '<',
          )
        if (pass === 0) scene.addLabel('poster')
        scene.to({}, { duration: BEAT.rest })
      })
    },
    { repeat: -1, repeatDelay: 0, timelineRef: timeline },
  )

  function sendNext(index: number) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    timeline.current?.play(`file${index}`)
  }

  const chipBox = (y: number, left: number) => ({
    left,
    top: y,
    width: CHIP.width,
    height: CHIP.height,
  })
  return (
    <FitDrawing width={WIDTH} height={HEIGHT}>
      <div ref={ref} aria-hidden="true" className="absolute inset-0">
        <svg
          aria-hidden="true"
          className="absolute inset-0 overflow-visible"
          width={WIDTH}
          height={HEIGHT}
          fill="none"
        >
          {PATHS.map((path, index) => (
            <path
              key={path.d}
              d={path.d}
              className={`transition-colors duration-300 ${
                hovered === index ? 'stroke-red-vivid/60' : 'stroke-border-strong'
              }`}
              strokeWidth={1.5}
            />
          ))}
          {PATHS.map((path) => (
            <path
              key={`trail-${path.d}`}
              data-trail=""
              d={path.d}
              pathLength={1}
              className="invisible text-red-vivid"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeDasharray="1 1"
              strokeDashoffset={1}
            />
          ))}
        </svg>
        {INPUTS.map((input, index) => (
          <button
            key={input.name}
            type="button"
            tabIndex={-1}
            data-chip=""
            className="absolute cursor-pointer text-start"
            style={chipBox(input.y, 0)}
            onClick={() => sendNext(index)}
            onPointerEnter={() => setHovered(index)}
            onPointerLeave={() => setHovered(null)}
          >
            <InputChip
              input={input}
              className={`size-full transition-colors ${hovered === index ? 'border-border-strong' : ''}`}
            />
          </button>
        ))}
        <BrowserTab
          status={status}
          isBusy={isBusy}
          className="absolute"
          style={{ left: TAB.x, top: TAB.y, width: TAB.width, height: TAB.height }}
        />
        {OUTPUTS.map((output, index) => (
          <div
            key={output.name}
            data-chip=""
            className="absolute"
            style={chipBox(output.y, WIDTH - CHIP.width)}
            onPointerEnter={() => setHovered(INPUTS.length + index)}
            onPointerLeave={() => setHovered(null)}
          >
            <OutputChip
              output={output}
              detail={delivered[index] ?? output.detail}
              isDelivered={delivered[index] !== null}
              className="size-full"
            />
          </div>
        ))}
      </div>
    </FitDrawing>
  )
}

/** The same flow on phones, from top to bottom. */
function DeviceStack() {
  return (
    <div className="flex w-full max-w-[300px] flex-col items-center">
      <span className="flex w-full flex-col gap-2">
        {INPUTS.map((input) => (
          <InputChip key={input.name} input={input} className="h-13" />
        ))}
      </span>
      <Drop />
      <BrowserTab className="w-full" />
      <Drop delay={0.6} />
      <span className="flex w-full flex-col gap-2">
        {OUTPUTS.map((output) => (
          <OutputChip key={output.name} output={output} className="h-13" />
        ))}
      </span>
    </div>
  )
}

function DeviceDiagram() {
  return (
    <div className="flex items-center justify-center px-6 py-10 md:h-72 md:py-0">
      <span className="hidden w-full md:block">
        <DeviceGraph />
      </span>
      <span className="flex w-full justify-center md:hidden">
        <DeviceStack />
      </span>
    </div>
  )
}

const NOTES: {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  title: string
  text: string
}[] = [
  {
    icon: ShieldCheck,
    title: 'No upload needed',
    text: 'Your browser reads, processes and saves the files, so you can use Hexlode without sending them anywhere.',
  },
  {
    icon: Layers,
    title: 'Modern formats',
    text: 'AVIF, WebP and JPEG XL as well as JPEG and PNG, with the settings each codec offers.',
  },
  {
    icon: GitHubMark,
    title: 'Open source',
    text: 'Read every line on GitHub. Hexlode is released under the Apache License 2.0.',
  },
]

/** How Hexlode works on the device, with three short notes. */
export function DeviceSection() {
  return (
    <Section id="device">
      <SectionHeader
        icon={MonitorSmartphone}
        pill="On your device"
        title="Works right where your images are."
        text="Hexlode decodes, edits and encodes images inside your browser with WebAssembly codecs. You can use it entirely on your device, without uploading your data."
      />
      <div className="border-border border-t">
        <DeviceDiagram />
      </div>
      <div className="grid gap-px border-border border-t bg-border md:grid-cols-3">
        {NOTES.map((note, index) => (
          <div key={note.title} className="bg-surface">
            <Reveal delay={index as 0 | 1 | 2} className="flex flex-col gap-3 px-6 py-8 md:px-8">
              <span className="inline-flex size-9 items-center justify-center rounded-lg border border-border bg-muted text-primary">
                <Icon icon={note.icon} size="sm" color="inherit" />
              </span>
              <Heading level={3}>{note.title}</Heading>
              <Text type="body" color="secondary">
                {note.text}
              </Text>
            </Reveal>
          </div>
        ))}
      </div>
    </Section>
  )
}

/** The last word: a large line and the two ways in. */
export function ClosingCall() {
  return (
    <Section>
      <div className="relative overflow-hidden px-6 py-24 text-center md:py-32">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(var(--color-border)_1px,transparent_1px)] bg-[size:18px_18px] [mask-image:radial-gradient(ellipse_60%_70%_at_50%_100%,black,transparent)]"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-64 left-1/2 h-[480px] w-[min(900px,100%)] -translate-x-1/2 rounded-full bg-linear-to-r from-orange-ring/25 via-red-ring/30 to-pink-ring/25 blur-[120px]"
        />
        <Reveal className="relative flex flex-col items-center gap-6">
          <span className="inline-flex size-16 items-center justify-center rounded-lg border border-border bg-card shadow-[0_0_60px_-12px_var(--color-border-red)]">
            <HexlodeMark size="lg" />
          </span>
          <Heading level={2} type="display-1">
            <span className="block max-w-3xl text-balance tracking-[-0.04em]">
              Your next batch is one drop away.
            </span>
          </Heading>
          <span className="block max-w-xl text-pretty">
            <Text type="large" color="secondary" weight="normal">
              Open a quick tool for a single job, or build a pipeline you can run again and again.
            </Text>
          </span>
          <span className="flex flex-wrap items-center justify-center gap-3">
            <Button
              label="Open the Studio"
              href="/studio"
              variant="primary"
              size="lg"
              endContent={<Icon icon={ArrowRight} size="sm" />}
            />
            <Button
              label="View on GitHub"
              href={REPOSITORY_URL}
              variant="secondary"
              size="lg"
              icon={<Icon icon={GitHubMark} size="sm" />}
            />
          </span>
        </Reveal>
      </div>
    </Section>
  )
}
