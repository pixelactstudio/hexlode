import { Icon } from '@astryxdesign/core/Icon'
import { Aperture, CalendarClock, Camera, Check, MapPin, RotateCw } from 'lucide-react'
import { AnimatePresence, motion, useSpring, useTransform } from 'motion/react'
import { useEffect } from 'react'

import { useLoop } from '#/features/home/motion-kit'
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

/** A label that slides to its next value. */
function Rolling({ value }: { value: string }) {
  return (
    <span className="relative inline-flex overflow-hidden">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '-100%', opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="inline-block"
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
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
      className={`flex w-32 flex-col gap-2 rounded-xl border bg-card p-2 shadow-sm ${
        isResult
          ? 'border-red-vivid/40 shadow-[0_0_40px_-12px_var(--color-red-vivid)]'
          : 'border-border'
      }`}
    >
      <div className="aspect-[4/3] overflow-hidden rounded-md">
        <Photo />
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

function ConvertDemo() {
  const { ref, step } = useLoop(CONVERT_TARGETS.length, 1800)
  const target = CONVERT_TARGETS[step]
  return (
    <div ref={ref} className="flex items-center gap-3">
      <FileTile format="JPG" size="2.4 MB" />
      <span className="relative flex h-2 w-12 items-center" aria-hidden="true">
        <span className="absolute inset-x-0 h-px bg-border-strong" />
        {[0, 1, 2].map((index) => (
          <motion.span
            key={index}
            className="absolute size-1.5 rounded-full bg-red-vivid"
            animate={{ x: [0, 42], opacity: [0, 1, 0] }}
            transition={{
              duration: 1.4,
              delay: index * 0.46,
              repeat: Number.POSITIVE_INFINITY,
              ease: 'easeInOut',
            }}
          />
        ))}
      </span>
      <FileTile format={target.format} size={target.size} isResult />
    </div>
  )
}

function kilobytes(value: number) {
  return value >= 1024 ? `${(value / 1024).toFixed(1)} MB` : `${Math.round(value)} KB`
}

function CompressDemo() {
  const { ref, step } = useLoop(2, 2400)
  const after = step === 1
  const size = useSpring(2458, { stiffness: 60, damping: 18 })
  const label = useTransform(size, kilobytes)
  useEffect(() => size.set(after ? 338 : 2458), [after, size])
  return (
    <div
      ref={ref}
      className="flex w-72 flex-col gap-5 rounded-xl border border-border bg-card p-5 shadow-sm"
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
            transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          />
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-secondary text-xs">Quality 75</span>
        <motion.span
          className="rounded-full bg-green-subtle px-2 py-0.5 font-semibold text-green-vivid text-xs tabular-nums"
          animate={{ opacity: after ? 1 : 0, y: after ? 0 : 4 }}
          transition={{ duration: 0.4, delay: after ? 0.6 : 0 }}
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
        <span className="absolute right-1 bottom-1 size-2 rounded-[2px] border border-on-dark bg-red-vivid" />
      </motion.div>
      <span className="absolute right-2 bottom-2 rounded-md border border-border bg-card px-2 py-1 font-medium text-primary text-xs tabular-nums shadow-sm">
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
        <span className="absolute top-1.5 left-1.5 rounded bg-body/80 px-1.5 py-0.5 font-semibold text-[11px] text-primary">
          <Rolling value={crop.label} />
        </span>
      </motion.div>
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
      <span className="absolute right-0 bottom-0 inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 font-medium text-primary text-xs tabular-nums shadow-sm">
        <Icon icon={RotateCw} size="xsm" color="secondary" />
        <Rolling value={`${angle % 360}°`} />
      </span>
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
      className="flex w-72 flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-sm"
    >
      <div className="flex items-center gap-2.5">
        <span className="block size-9 overflow-hidden rounded-md">
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
              exit={{ opacity: 0, x: 24, transition: { duration: 0.3 } }}
              className="flex items-center gap-2 rounded-md bg-muted px-2 py-1.5 text-xs"
            >
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
