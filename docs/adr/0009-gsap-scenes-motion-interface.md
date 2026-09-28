# GSAP for home page scenes, Motion for the interface

The home page's Studio pictures are directed scenes: one GSAP timeline each, with beats that
follow one another, a pointer that acts them out, and a rest on the last frame before they repeat.
Motion stays for interface motion such as presses, menus, swapping labels, the top bar and the
footer glow. Before this, every picture was a set of Motion loops with their own periods, so
several things moved at different speeds at once and nothing showed cause and effect.

A scene is built with `useScene` in `src/features/home/scene.ts`. It creates a paused timeline,
lets the scene add its tweens, starts it with ScrollTrigger when the scene scrolls into view after
a delay for its column, and pauses it off screen. With reduced motion it jumps to the scene's
`poster` label and stays there. Timings and easings come from `src/features/home/constants.ts`.
GSAP moves elements; React state that a scene changes, such as a label or a count, is set from
timeline callbacks, and Motion animates the swap.

## Considered options

- **Motion only.** It handles interface motion well, but sequencing beats across elements means
  chains of timers and state, and it has no timeline to pause, seek or jump to a still frame.
- **Rive.** Its animations are drawn in the Rive editor and need its runtime. Our pictures are
  built from the Studio's own node icons and colour tokens, so they stay sharp and follow the
  colour mode without extra artwork. Worth another look for illustration or a mascot.

## Consequences

- GSAP ships under its own no-charge licence, not an open-source one. It allows use in any
  project, Hexlode's Apache 2.0 code included, and all of its plugins are free.
- GSAP and ScrollTrigger load with the home page only. Tool pages and the Studio do not pay for
  them.
- A tween that sets its start values when the timeline is built (`fromTo`, `from`) shows them at
  once. Use `immediateRender: false` when the start should only appear when the tween plays.
- GSAP rounds pixel values, so a fraction of an SVG path length, as used for drawing edges and
  beams, is tweened as an attribute: `attr: { 'stroke-dashoffset': 0.2 }`.
