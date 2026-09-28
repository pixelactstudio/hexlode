import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from 'motion/react'
import type { PointerEvent } from 'react'

/** Radius, in pixels, of the circle of dots that lights up under the pointer. */
const GLOW_RADIUS = 180

const WORDMARK =
  'block select-none bg-[length:5px_5px] bg-clip-text text-center font-bold text-[clamp(88px,19vw,260px)] text-transparent leading-[0.8] tracking-[-0.04em]'

/**
 * The large dotted "Hexlode" at the foot of every page. Under the pointer its dots brighten in a
 * circle that fades out towards the edge and trails the pointer a little, then dims when the
 * pointer leaves. Only the dots light up; the gaps between them stay dark.
 */
export function FooterWordmark() {
  const reduced = useReducedMotion()
  const spring = reduced ? { duration: 0 } : { stiffness: 260, damping: 30, mass: 0.6 }
  const x = useSpring(useMotionValue(0), spring)
  const y = useSpring(useMotionValue(0), spring)
  const strength = useSpring(0, reduced ? { duration: 0 } : { stiffness: 120, damping: 24 })
  const mask = useMotionTemplate`radial-gradient(circle ${GLOW_RADIUS}px at ${x}px ${y}px, black, rgb(0 0 0 / 0.35) 45%, transparent 100%), linear-gradient(to bottom, black 40%, transparent)`

  function move(event: PointerEvent<HTMLSpanElement>) {
    const box = event.currentTarget.getBoundingClientRect()
    const left = event.clientX - box.left
    const top = event.clientY - box.top
    // Enter at the pointer rather than sliding in from the last spot the glow was.
    if (strength.get() < 0.01) {
      x.jump(left)
      y.jump(top)
    }
    x.set(left)
    y.set(top)
    strength.set(1)
  }

  return (
    <span
      aria-hidden="true"
      className="relative block"
      onPointerMove={move}
      onPointerLeave={() => strength.set(0)}
    >
      <span
        className={`${WORDMARK} bg-[radial-gradient(var(--color-border-strong)_1px,transparent_1.4px)] [mask-image:linear-gradient(to_bottom,black_40%,transparent)]`}
      >
        Hexlode
      </span>
      <motion.span
        className={`${WORDMARK} pointer-events-none absolute inset-0 bg-[radial-gradient(var(--color-text-primary)_1.2px,transparent_1.6px)] [mask-composite:intersect]`}
        style={{ maskImage: mask, opacity: strength }}
      >
        Hexlode
      </motion.span>
    </span>
  )
}
