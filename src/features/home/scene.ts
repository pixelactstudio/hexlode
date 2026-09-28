import { useGSAP } from '@gsap/react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useRef } from 'react'

import { BEAT, EASE, SCENE_START } from '#/features/home/constants'

gsap.registerPlugin(useGSAP, ScrollTrigger)

type Query = (selector: string) => Element[]

/** Adds a scene's tweens to `timeline`. `q` finds elements inside `root`. */
export type SceneBuilder = (timeline: gsap.core.Timeline, q: Query, root: HTMLElement) => void

/**
 * A directed scene: one GSAP timeline, built once inside the returned element's scope.
 *
 * The timeline waits until the element scrolls into view, then plays after `delay`, pauses while
 * the element is off screen and carries on when it comes back. A scene that loops repeats its
 * whole timeline, or nests a repeating timeline after a part that plays once.
 *
 * When the user asks for reduced motion the scene jumps to the label `poster`, or to its end, and
 * stays there, without its pointer. Callbacks on the way still run, so React state matches the
 * frame shown.
 */
export function useScene<T extends HTMLElement = HTMLDivElement>(
  build: SceneBuilder,
  { delay = 0, repeat = 0, repeatDelay = BEAT.rest }: SceneOptions = {},
) {
  const ref = useRef<T>(null)
  useGSAP(
    () => {
      const element = ref.current
      if (!element) return
      const timeline = gsap.timeline({ paused: true, repeat, repeatDelay })
      build(timeline, gsap.utils.selector(element), element)

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        timeline.seek(timeline.labels.poster ?? timeline.duration(), false)
        gsap.set(element.querySelectorAll('[data-cursor]'), { autoAlpha: 0 })
        return
      }

      let started = false
      ScrollTrigger.create({
        trigger: element,
        start: SCENE_START,
        end: 'bottom top',
        onToggle: ({ isActive }) => {
          if (!isActive) {
            timeline.pause()
          } else if (started) {
            timeline.resume()
          } else {
            started = true
            gsap.delayedCall(delay, () => timeline.play())
          }
        },
      })
    },
    { scope: ref },
  )
  return ref
}

type SceneOptions = {
  /** Seconds to wait after the scene comes into view, to follow a scene beside it. */
  delay?: number
  /** How many more times the whole timeline plays; -1 for ever. */
  repeat?: number
  /** Seconds between repeats. */
  repeatDelay?: number
}

/** The centre of `target`, in the coordinates of its positioned ancestor `container`. */
export function centreOf(target: Element | undefined, container: Element | undefined) {
  if (!(target instanceof HTMLElement) || !(container instanceof HTMLElement)) return { x: 0, y: 0 }
  let x = target.offsetWidth / 2
  let y = target.offsetHeight / 2
  let node: HTMLElement | null = target
  while (node && node !== container) {
    x += node.offsetLeft
    y += node.offsetTop
    node = node.offsetParent as HTMLElement | null
  }
  return { x, y }
}

/**
 * Adds a pointer gliding to the centre of `target` and pressing it, at `position`. The pointer is
 * a `SceneCursor` inside `container`.
 */
export function clickOn(
  timeline: gsap.core.Timeline,
  cursor: Element[],
  target: Element | undefined,
  container: Element | undefined,
  position?: gsap.Position,
) {
  const point = centreOf(target, container)
  timeline
    .to(cursor, { autoAlpha: 1, duration: BEAT.quick }, position)
    .to(cursor, { x: point.x, y: point.y, duration: BEAT.move, ease: EASE.move }, '<')
    .to(cursor, { scale: 0.8, duration: 0.1, ease: EASE.exit })
    .to(cursor, { scale: 1, duration: BEAT.quick, ease: EASE.enter })
  if (target) timeline.to(target, { scale: 0.94, duration: 0.1, yoyo: true, repeat: 1 }, '<-0.1')
  return timeline
}
