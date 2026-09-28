/*
 * The home page's motion primitives. Every scene is built from these timings and easings, so the
 * page moves at one pace. Times are in seconds; easings are GSAP names.
 */

export const BEAT = {
  /** A press, a lamp switching on, a badge swapping. */
  quick: 0.2,
  /** Something entering or leaving. */
  base: 0.45,
  /** A pointer travelling or a picture changing shape. */
  move: 0.7,
  /** Long enough to read a changed label. */
  read: 1.4,
  /** The pause on a scene's last frame before it starts again. */
  rest: 2.2,
} as const

export const EASE = {
  enter: 'power3.out',
  exit: 'power2.in',
  move: 'power2.inOut',
  steady: 'none',
} as const

/** Between items that enter one after another. */
export const STAGGER = 0.08

/**
 * How much later each column of a grid starts its scene, so cells that come into view together
 * play one after another instead of all at once.
 */
export const COLUMN_DELAY = 0.5

/** A scene starts when its top passes this point of the viewport, in ScrollTrigger terms. */
export const SCENE_START = 'top 80%'

/** The batch every Studio scene follows, from the graph to the saved tool. */
export const BATCH_SIZE = 240
