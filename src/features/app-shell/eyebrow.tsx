import type { ReactNode } from 'react'

/** A short uppercase line above a heading that says which part of the page this is. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="block font-semibold text-red-vivid text-xs uppercase tracking-[0.16em]">
      {children}
    </span>
  )
}
