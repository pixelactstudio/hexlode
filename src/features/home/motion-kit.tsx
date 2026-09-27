import { motion, useInView, useReducedMotion } from 'motion/react'
import { type ReactNode, useEffect, useRef, useState } from 'react'

/**
 * Counts up every `ms` while the element is on screen, for looping demos: `tick` keeps growing and
 * `step` wraps at `length`. The first state renders on the server and stays put when the user asks
 * for reduced motion.
 */
export function useLoop<T extends Element = HTMLDivElement>(length: number, ms: number) {
  const ref = useRef<T>(null)
  const inView = useInView(ref, { margin: '-10% 0px' })
  const reduced = useReducedMotion()
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!inView || reduced) return
    const timer = setInterval(() => setTick((current) => current + 1), ms)
    return () => clearInterval(timer)
  }, [inView, reduced, ms])
  return { ref, tick, step: tick % length, isRunning: inView && !reduced }
}

/**
 * Draws its children at `width` × `height` pixels and scales them down, box and all, to fit the
 * width it gets.
 */
export function FitDrawing({
  width,
  height,
  children,
}: {
  width: number
  height: number
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      setScale(Math.min(1, entry.contentRect.width / width))
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [width])
  return (
    <div ref={ref} className="w-full">
      <div className="relative mx-auto" style={{ width: width * scale, height: height * scale }}>
        <div
          className="absolute top-0 left-0 origin-top-left"
          style={{ width, height, transform: `scale(${scale})` }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

/** A short vertical line with a dot running down it, joining two stacked steps on phones. */
export function Drop({ delay = 0 }: { delay?: number }) {
  return (
    <span aria-hidden="true" className="relative block h-6 w-px bg-border-strong">
      <motion.span
        className="absolute -left-[2px] size-[5px] rounded-full bg-red-vivid"
        animate={{ y: [0, 20], opacity: [0, 1, 0] }}
        transition={{ duration: 1.2, delay, repeat: Number.POSITIVE_INFINITY, repeatDelay: 0.6 }}
      />
    </span>
  )
}

const DELAYS = ['delay-0', 'delay-100', 'delay-200', 'delay-300'] as const

/**
 * Fades and lifts its children in the first time they scroll into view. Anything already on
 * screen when the page loads, or everything when the user asks for reduced motion, simply shows,
 * so nothing waits for scripts.
 */
export function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: ReactNode
  delay?: 0 | 1 | 2 | 3
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'shown' | 'waiting'>('shown')
  useEffect(() => {
    const element = ref.current
    if (!element) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (element.getBoundingClientRect().top < window.innerHeight) return
    setState('waiting')
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        setState('shown')
        observer.disconnect()
      },
      { rootMargin: '0px 0px -8% 0px' },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return (
    <div
      ref={ref}
      data-reveal={state}
      className={`transition-[opacity,translate,filter] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] data-[reveal=waiting]:translate-y-5 data-[reveal=waiting]:opacity-0 data-[reveal=waiting]:blur-sm ${DELAYS[delay]} ${className}`}
    >
      {children}
    </div>
  )
}

/**
 * A short bright streak that travels around its parent's border. The parent needs a border
 * radius and `position: relative`.
 */
export function BorderBeam({ duration = 12 }: { duration?: number }) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 rounded-[inherit] border-[1.5px] border-transparent [mask-clip:padding-box,border-box] [mask-composite:intersect] [mask-image:linear-gradient(transparent,transparent),linear-gradient(#000,#000)]"
    >
      <motion.span
        className="absolute aspect-square w-60 bg-linear-to-l from-red-vivid via-pink-vivid to-transparent [offset-path:rect(0_auto_auto_0_round_240px)]"
        initial={{ offsetDistance: '0%' }}
        animate={{ offsetDistance: '100%' }}
        transition={{ repeat: Number.POSITIVE_INFINITY, ease: 'linear', duration }}
      />
    </span>
  )
}

/** A small plus mark where a section line meets a rail, like the corner of a drafting sheet. */
export function Crosshair({ side }: { side: 'start' | 'end' }) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute -top-[5px] z-10 hidden size-[9px] before:absolute before:inset-x-0 before:top-1/2 before:h-px before:-translate-y-1/2 before:bg-border-strong after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 after:bg-border-strong md:block ${
        side === 'start' ? '-left-[5px]' : '-right-[5px]'
      }`}
    />
  )
}
