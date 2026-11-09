import type { Pipeline } from '#/features/engine/types'

/** Every built-in tool's slug, as in `/tools/<slug>`. */
export type BuiltInToolSlug =
  | 'heic-to-jpg'
  | 'webp-to-jpg'
  | 'jpg-to-pdf'
  | 'instagram-no-crop'
  | 'favicon-generator'
  | 'watermark-photos'
  | 'add-logo-to-photos'

/** Where a tool's numbers come from, for a tool that follows a platform's rules. */
export interface ToolGuidance {
  /** The name of the guidance, as its owner calls it. */
  label: string
  url: string
  /** When the numbers were last checked against it, as an ISO date. */
  checked: string
}

/** A pipeline tool that ships with Hexlode, on its own page. */
export interface BuiltInTool {
  slug: BuiltInToolSlug
  /** A few words for menus and the home page. */
  name: string
  /** The page's main heading, in the words people search for. */
  heading: string
  /** One sentence for the page, under the heading. */
  description: string
  /**
   * Why this job earns a page: who does it, how often, and what Hexlode does better than a single
   * quick tool. For maintainers; the page does not show it.
   */
  reason: string
  guidance?: ToolGuidance
  pipeline: Pipeline
  /** Ids of the nodes whose settings the page shows, in order. */
  adjustable?: readonly string[]
  /** What still has to be set before the tool can run, or null when it is ready. */
  check?: (pipeline: Pipeline) => string | null
}
