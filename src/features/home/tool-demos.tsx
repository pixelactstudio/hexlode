import { Icon } from '@astryxdesign/core/Icon'
import { Aperture, CalendarClock, Camera, Check, MapPin, RotateCw } from 'lucide-react'
import { AnimatePresence, motion, useSpring, useTransform } from 'motion/react'
import { Fragment, useEffect, useState } from 'react'

import { POINTER_PATH, Rolling, useLoop } from '#/features/home/motion-kit'
import type { QuickTool } from '#/features/quick-tools/tools'

/*
 * Small moving pictures of each quick tool for the home page. Every demo loops only while it is on
 * screen, starts from a still first frame, and uses the sample photos in public/home.
 */

const SPRING = { type: 'spring', stiffness: 140, damping: 20 } as const

function Photo({ name = 'dusk' }: { name?: 'dusk' | 'dawn' | 'desert' }) {
  return (
    <img
      src={`/home/photo-${name}.webp`}
      alt=""
      draggable={false}
      className="block size-full select-none object-cover"
    />
  )
}

function FileTile({
  format,
  size,
  isResult = false,
}: {
  format: string
  size: string
  isResult?: boolean
}) {
  return (
    <div
      className={`flex w-32 flex-col gap-2 rounded-lg border bg-card p-2 shadow-sm ${
        isResult
          ? 'border-red-vivid/40 shadow-[0_0_40px_-12px_var(--color-red-vivid)]'
          : 'border-border'
      }`}
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded">
        <Photo />
        {isResult ? (
          // A band that passes over the picture each time it is encoded to a new format.
          <AnimatePresence initial={false}>
            <motion.span
              key={format}
              aria-hidden="true"
              className="absolute inset-x-0 top-0 h-1/2 bg-linear-to-b from-transparent via-red-vivid/35 to-transparent"
              initial={{ y: '-100%' }}
              animate={{ y: '200%' }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.7, ease: 'easeInOut' }}
            />
          </AnimatePresence>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-1 px-0.5 text-[11px] tabular-nums">
        <span className="rounded bg-muted px-1.5 py-0.5 font-semibold text-primary">
          <Rolling value={format} />
        </span>
        <span className="text-secondary">
          <Rolling value={size} />
        </span>
      </div>
    </div>
  )
}

const CONVERT_TARGETS = [
  { format: 'WebP', size: '412 KB' },
  { format: 'AVIF', size: '268 KB' },
  { format: 'JXL', size: '301 KB' },
  { format: 'PNG', size: '3.1 MB' },
]

/** Seconds a pulse takes to cross the link from the source file to the result. */
const PULSE = 0.6

/**
 * The source file on the left, the result on the right, and a link between them with a port at
 * each end. Each format change sends a pulse across the link; it lands in the result's port, and
 * only then does the result re-encode to the new format.
 */
function ConvertDemo() {
  const { ref, tick, step } = useLoop(CONVERT_TARGETS.length, 1800)
  const [shown, setShown] = useState(step)
  useEffect(() => {
    const timer = setTimeout(() => setShown(step), PULSE * 1000)
    return () => clearTimeout(timer)
  }, [step])
  const target = CONVERT_TARGETS[shown]
  return (
    <div ref={ref} className="flex items-center">
      <FileTile format="JPG" size="2.4 MB" />
      <span className="relative z-10 -mx-1 flex h-3 w-16 items-center" aria-hidden="true">
        <span className="absolute inset-x-1 h-px bg-border-strong" />
        {tick > 0 ? (
          <Fragment key={tick}>
            <motion.span
              className="absolute inset-x-1 h-px origin-left bg-linear-to-r from-transparent to-red-vivid"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: [0, 1, 1], opacity: [1, 1, 0] }}
              transition={{ duration: PULSE + 0.4, times: [0, 0.6, 1], ease: 'easeIn' }}
            />
            <motion.span
              className="absolute left-0 size-2 rounded-full bg-red-vivid shadow-[0_0_10px_var(--color-red-vivid)]"
              initial={{ x: 0, opacity: 0 }}
              animate={{ x: [0, 56, 56], opacity: [0, 1, 0], scale: [0.6, 1, 2.2] }}
              transition={{ duration: PULSE + 0.3, times: [0, 0.67, 1], ease: 'easeIn' }}
            />
          </Fragment>
        ) : null}
        <span className="absolute left-0 size-2 rounded-full border border-border-strong bg-card" />
        <span className="absolute right-0 size-2 rounded-full border border-border-strong bg-card" />
        {tick > 0 ? (
          <motion.span
            key={`port-${tick}`}
            className="absolute right-0 size-2 rounded-full bg-red-vivid"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 0.7, delay: PULSE - 0.1, times: [0, 0.2, 1] }}
          />
        ) : null}
      </span>
      <FileTile format={target.format} size={target.size} isResult />
    </div>
  )
}

function kilobytes(value: number) {
  return value >= 1024 ? `${(value / 1024).toFixed(1)} MB` : `${Math.round(value)} KB`
}

/** Quality moves from 100 to 75 first, then the file shrinks to match. */
function CompressDemo() {
  const { ref, step } = useLoop(2, 2400)
  const after = step === 1
  const size = useSpring(2458, { stiffness: 60, damping: 18 })
  const label = useTransform(size, kilobytes)
  useEffect(() => {
    const timer = setTimeout(() => size.set(after ? 338 : 2458), after ? 350 : 0)
    return () => clearTimeout(timer)
  }, [after, size])
  return (
    <div
      ref={ref}
      className="flex w-72 flex-col gap-5 rounded-lg border border-border bg-card p-5 shadow-sm"
    >
      <div className="flex flex-col gap-2">
        <div className="flex justify-between text-secondary text-xs">
          <span>Original</span>
          <span className="tabular-nums">2.4 MB</span>
        </div>
        <span className="block h-2.5 rounded-full bg-border-strong" />
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex justify-between text-xs">
          <span className="text-secondary">Compressed</span>
          <motion.span className="font-semibold text-primary tabular-nums">{label}</motion.span>
        </div>
        <span className="block h-2.5 overflow-hidden rounded-full bg-muted">
          <motion.span
            className="block h-full origin-left rounded-full bg-linear-to-r from-red-vivid to-pink-vivid"
            animate={{ scaleX: after ? 0.14 : 1 }}
            transition={{ duration: 1.1, delay: after ? 0.35 : 0, ease: [0.22, 1, 0.36, 1] }}
          />
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="w-16 shrink-0 text-secondary text-xs tabular-nums">
          Quality <Rolling value={after ? '75' : '100'} />
        </span>
        <span className="relative flex h-3 flex-1 items-center">
          <span className="absolute inset-x-0 h-1 rounded-full bg-muted" />
          <motion.span
            className="absolute left-0 h-1 rounded-full bg-border-strong"
            initial={false}
            animate={{ width: after ? '75%' : '100%' }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          />
          <motion.span
            className="absolute size-3 -translate-x-1/2 rounded-full border-2 border-primary bg-card shadow-sm"
            initial={false}
            animate={{ left: after ? '75%' : '100%', scale: [1, 1.25, 1] }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          />
        </span>
        <motion.span
          className="rounded-full bg-green-subtle px-2 py-0.5 font-semibold text-green-vivid text-xs tabular-nums"
          animate={{ opacity: after ? 1 : 0, y: after ? 0 : 4 }}
          transition={{ duration: 0.4, delay: after ? 0.9 : 0 }}
        >
          −86%
        </motion.span>
      </div>
    </div>
  )
}

function ResizeDemo() {
  const { ref, step } = useLoop(2, 2200)
  const small = step === 1
  return (
    <div ref={ref} className="relative h-44 w-64">
      <span className="absolute inset-0 rounded-lg border border-border-strong border-dashed" />
      <motion.div
        className="relative overflow-hidden rounded-lg shadow-md"
        initial={false}
        animate={{ width: small ? '46%' : '100%', height: small ? '46%' : '100%' }}
        transition={SPRING}
      >
        <Photo name="dawn" />
        <motion.span
          className="absolute right-1 bottom-1 size-2 rounded-[2px] border border-on-dark bg-red-vivid"
          animate={{ scale: [1, 1.6, 1] }}
          transition={{ duration: 0.5 }}
          key={small ? 'small' : 'large'}
        />
      </motion.div>
      {/* The pointer holds the handle, so it follows the corner as the picture changes size. */}
      <motion.svg
        aria-hidden="true"
        viewBox="0 0 16 20"
        className="pointer-events-none absolute top-0 left-0 w-4 text-primary drop-shadow-md"
        initial={false}
        animate={{ x: small ? 110 : 248, y: small ? 73 : 168 }}
        transition={SPRING}
      >
        <path
          d={POINTER_PATH}
          fill="currentColor"
          className="stroke-body"
          strokeWidth={1.2}
          strokeLinejoin="round"
        />
      </motion.svg>
      <span className="absolute bottom-2 left-2 rounded-sm border border-border bg-card px-2 py-1 font-medium text-primary text-xs tabular-nums shadow-sm">
        <Rolling value={small ? '1600 × 1200' : '4032 × 3024'} />
      </span>
    </div>
  )
}

/** Crop boxes on a 3:2 photo, as a share of its width and height. */
const CROPS = [
  { label: '1:1', width: 66.7, height: 100 },
  { label: '4:5', width: 53.3, height: 100 },
  { label: '16:9', width: 100, height: 84.4 },
]

function CropDemo() {
  const { ref, step } = useLoop(CROPS.length, 1900)
  const crop = CROPS[step]
  return (
    <div ref={ref} className="relative h-44 w-66 overflow-hidden rounded-lg shadow-md">
      <Photo name="dawn" />
      <motion.div
        className="absolute rounded-sm border-[1.5px] border-on-dark shadow-[0_0_0_999px_color-mix(in_oklab,var(--color-background-body)_72%,transparent)]"
        initial={false}
        animate={{
          width: `${crop.width}%`,
          height: `${crop.height}%`,
          left: `${(100 - crop.width) / 2}%`,
          top: `${(100 - crop.height) / 2}%`,
        }}
        transition={SPRING}
      >
        <span className="absolute inset-y-0 left-1/3 w-px bg-on-dark/35" />
        <span className="absolute inset-y-0 left-2/3 w-px bg-on-dark/35" />
        <span className="absolute inset-x-0 top-1/3 h-px bg-on-dark/35" />
        <span className="absolute inset-x-0 top-2/3 h-px bg-on-dark/35" />
      </motion.div>
      <span className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-0.5 rounded-md bg-body/80 p-0.5 backdrop-blur-sm">
        {CROPS.map((entry) => (
          <span
            key={entry.label}
            className={`relative rounded px-2 py-0.5 font-semibold text-[11px] transition-colors duration-300 ${
              entry.label === crop.label ? 'text-primary' : 'text-secondary'
            }`}
          >
            {entry.label === crop.label ? (
              <motion.span
                layoutId="crop-chip"
                className="absolute inset-0 rounded bg-muted ring-1 ring-border"
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              />
            ) : null}
            <span className="relative">{entry.label}</span>
          </span>
        ))}
      </span>
    </div>
  )
}

function RotateDemo() {
  const { ref, tick } = useLoop(4, 1700)
  const angle = tick * 90
  return (
    <div ref={ref} className="relative flex size-48 items-center justify-center">
      <span className="absolute h-[118px] w-44 rounded-lg border border-border-strong border-dashed" />
      <motion.div
        className="h-[118px] w-44 overflow-hidden rounded-lg shadow-md"
        initial={false}
        animate={{ rotate: angle }}
        transition={SPRING}
      >
        <Photo name="desert" />
      </motion.div>
      <motion.span
        key={tick}
        className="absolute right-0 bottom-0 inline-flex items-center gap-1.5 rounded-sm border border-border bg-card px-2 py-1 font-medium text-primary text-xs tabular-nums shadow-sm"
        initial={{ scale: tick === 0 ? 1 : 0.88 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 18 }}
      >
        <motion.span
          className="inline-flex"
          initial={{ rotate: angle - 90 }}
          animate={{ rotate: angle }}
          transition={SPRING}
        >
          <Icon icon={RotateCw} size="xsm" color="secondary" />
        </motion.span>
        <Rolling value={`${angle % 360}°`} />
      </motion.span>
    </div>
  )
}

const FIELDS = [
  { icon: MapPin, label: 'Location', value: '46.55° N, 7.98° E' },
  { icon: Camera, label: 'Camera', value: 'Pixel 8 Pro' },
  { icon: Aperture, label: 'Exposure', value: 'f/1.7 · 1/120 s' },
  { icon: CalendarClock, label: 'Taken', value: '14 Aug, 18:42' },
]

function StripDemo() {
  // Nothing removed, then one field more each step, then a pause on the clean file.
  const { ref, step } = useLoop(FIELDS.length + 3, 900)
  const removed = Math.max(0, Math.min(FIELDS.length, step - 1))
  const left = FIELDS.slice(removed)
  return (
    <div
      ref={ref}
      className="flex w-72 flex-col gap-3 rounded-lg border border-border bg-card p-3 shadow-sm"
    >
      <div className="flex items-center gap-2.5">
        <span className="block size-9 overflow-hidden rounded">
          <Photo name="desert" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-medium text-primary text-sm">IMG_2041.jpg</span>
          <span className="text-secondary text-xs tabular-nums">
            <Rolling value={left.length === 0 ? 'No metadata' : `${left.length} fields`} />
          </span>
        </span>
      </div>
      <div className="relative flex h-[132px] flex-col gap-1">
        <AnimatePresence initial={false}>
          {left.map((field) => (
            <motion.div
              key={field.label}
              layout
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit="removed"
              variants={{
                removed: { opacity: 0, x: 24, transition: { delay: 0.3, duration: 0.3 } },
              }}
              className="relative flex items-center gap-2 rounded bg-muted px-2 py-1.5 text-xs"
            >
              {/* Struck through first, so each field is seen going before it slides away. */}
              <motion.span
                aria-hidden="true"
                className="absolute inset-x-2 top-1/2 h-px origin-left bg-red-vivid"
                style={{ scaleX: 0 }}
                variants={{ removed: { scaleX: 1, transition: { duration: 0.3 } } }}
              />
              <Icon icon={field.icon} size="xsm" color="secondary" />
              <span className="text-secondary">{field.label}</span>
              <span className="ms-auto truncate text-primary">{field.value}</span>
            </motion.div>
          ))}
        </AnimatePresence>
        <AnimatePresence>
          {left.length === 0 ? (
            <motion.div
              key="clean"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-2"
            >
              <span className="inline-flex size-9 items-center justify-center rounded-full bg-green-subtle text-green-vivid">
                <Icon icon={Check} size="sm" color="inherit" />
              </span>
              <span className="text-secondary text-xs">Location, camera and dates removed</span>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  )
}

export const TOOL_DEMOS: Record<QuickTool, () => React.ReactNode> = {
  convert: ConvertDemo,
  compress: CompressDemo,
  resize: ResizeDemo,
  crop: CropDemo,
  rotate: RotateDemo,
  'strip-metadata': StripDemo,
}
