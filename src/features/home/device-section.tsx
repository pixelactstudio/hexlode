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
import { motion, useInView } from 'motion/react'
import { type ComponentType, type SVGProps, useRef } from 'react'

import { REPOSITORY_URL } from '#/features/app-shell/constants'
import { GitHubMark } from '#/features/app-shell/github-mark'
import { HexlodeMark } from '#/features/app-shell/hexlode-mark'
import { Drop, FitDrawing, Reveal } from '#/features/home/motion-kit'
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
  { icon: Archive, name: 'photos.zip', detail: 'Download', y: 63 },
  { icon: FolderOpen, name: 'photos/', detail: 'Or save to a folder', y: 133 },
]

function curve(sx: number, sy: number, tx: number, ty: number) {
  const bend = (tx - sx) / 2
  return `M${sx} ${sy} C${sx + bend} ${sy} ${tx - bend} ${ty} ${tx} ${ty}`
}

const PATHS = [
  ...INPUTS.map((input, index) => ({
    d: curve(CHIP.width, input.y + CHIP.height / 2, TAB.x, TAB.y + 70 + index * 30),
    delay: index * 0.25,
  })),
  ...OUTPUTS.map((output, index) => ({
    d: curve(
      TAB.x + TAB.width,
      TAB.y + 85 + index * 30,
      WIDTH - CHIP.width,
      output.y + CHIP.height / 2,
    ),
    delay: 1.3 + index * 0.25,
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
      <img
        src={`/home/photo-${input.photo}.webp`}
        alt=""
        className="size-8 rounded-md object-cover"
      />
      <span className="flex flex-col">
        <span className="font-medium text-[13px] text-primary">{input.name}</span>
        <span className="text-[11px] text-secondary">{input.size}</span>
      </span>
    </div>
  )
}

function OutputChip({
  output,
  className = '',
  style,
}: {
  output: Output
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <div className={`${CHIP_CLASS} ${className}`} style={style}>
      <span className="inline-flex size-8 items-center justify-center rounded-md bg-green-subtle text-green-vivid">
        <Icon icon={output.icon} size="sm" color="inherit" />
      </span>
      <span className="flex flex-col">
        <span className="font-medium text-[13px] text-primary">{output.name}</span>
        <span className="text-[11px] text-secondary">{output.detail}</span>
      </span>
    </div>
  )
}

function BrowserTab({
  className = '',
  style,
}: {
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border border-red-ring/50 bg-card p-4 shadow-[0_0_60px_-20px_var(--color-border-red)] ${className}`}
      style={style}
    >
      <span className="flex items-center gap-2">
        <HexlodeMark />
        <span className="font-semibold text-primary text-sm">This browser tab</span>
      </span>
      <span className="flex flex-col gap-1.5">
        {['Decode', 'Edit', 'Encode'].map((stage) => (
          <span
            key={stage}
            className="flex items-center justify-between rounded-md bg-muted px-2.5 py-1.5 text-primary text-xs"
          >
            {stage}
            <Icon icon={Cpu} size="xsm" color="secondary" />
          </span>
        ))}
      </span>
      <span className="mt-auto text-[11px] text-secondary">Web Workers · WebAssembly</span>
    </div>
  )
}

/** Images flowing into this browser tab and out as a ZIP or a folder, left to right. */
function DeviceGraph({ isLit }: { isLit: boolean }) {
  return (
    <FitDrawing width={WIDTH} height={HEIGHT}>
      <svg
        aria-hidden="true"
        className="absolute inset-0 overflow-visible"
        width={WIDTH}
        height={HEIGHT}
        fill="none"
      >
        {PATHS.map((path) => (
          <path key={path.d} d={path.d} className="stroke-border-strong" strokeWidth={1.5} />
        ))}
        {isLit
          ? PATHS.map((path) => (
              <motion.path
                key={`beam-${path.d}`}
                d={path.d}
                pathLength={1}
                className="text-red-vivid"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeDasharray="0.3 1"
                initial={{ strokeDashoffset: 0.3 }}
                animate={{ strokeDashoffset: -1 }}
                transition={{
                  duration: 1,
                  delay: path.delay,
                  ease: 'easeInOut',
                  repeat: Number.POSITIVE_INFINITY,
                  repeatDelay: 2.4,
                }}
              />
            ))
          : null}
      </svg>
      {INPUTS.map((input) => (
        <InputChip
          key={input.name}
          input={input}
          className="absolute"
          style={{ left: 0, top: input.y, width: CHIP.width, height: CHIP.height }}
        />
      ))}
      <BrowserTab
        className="absolute"
        style={{ left: TAB.x, top: TAB.y, width: TAB.width, height: TAB.height }}
      />
      {OUTPUTS.map((output) => (
        <OutputChip
          key={output.name}
          output={output}
          className="absolute"
          style={{
            left: WIDTH - CHIP.width,
            top: output.y,
            width: CHIP.width,
            height: CHIP.height,
          }}
        />
      ))}
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
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { margin: '-10% 0px' })
  return (
    <div ref={ref} className="flex items-center justify-center px-6 py-10 md:h-72 md:py-0">
      <span className="hidden w-full md:block">
        <DeviceGraph isLit={inView} />
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
          <span className="inline-flex size-16 items-center justify-center rounded-2xl border border-border bg-card shadow-[0_0_60px_-12px_var(--color-border-red)]">
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
