import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

import type { RunController } from '#/features/runs/run-controller'

/** Subscribes to a run controller, rendering at most once per animation frame. */
export function useRunState(controller: RunController) {
  const frame = useRef<number | null>(null)
  const subscribe = (notify: () => void) =>
    controller.subscribe(() => {
      if (frame.current !== null) return
      frame.current = requestAnimationFrame(() => {
        frame.current = null
        notify()
      })
    })
  return useSyncExternalStore(subscribe, controller.getState, controller.getState)
}

/** A controller that lives as long as the component. */
export function useController<T extends { dispose(): void }>(create: () => T) {
  const [value] = useState(create)
  useEffect(() => () => value.dispose(), [value])
  return value
}
