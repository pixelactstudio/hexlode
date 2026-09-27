/**
 * Every analytics event and the properties it may carry. Properties are limited to counts,
 * timings, node types, settings and error codes. The privacy page lists this catalogue.
 */
import { z } from 'zod'

const count = z.number().int().nonnegative()
const code = z.string().regex(/^[a-z0-9_]{1,40}$/)
const nodeType = z.string().regex(/^[a-z0-9.-]{1,40}$/)
const surface = z.enum(['quick-tool', 'pipeline-tool', 'studio'])
export const QUICK_TOOLS = ['convert', 'compress', 'resize', 'strip-metadata'] as const
const tool = z.enum(QUICK_TOOLS)
const settingValue: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.number(),
    z.boolean(),
    z.string().regex(/^[a-z0-9.:-]{0,24}$/i),
    z.array(settingValue),
    z.record(z.string(), settingValue),
  ]),
)
const shape = z
  .object({
    nodeCount: count,
    connectionCount: count,
    nodeTypes: z.array(nodeType),
    nodes: z.array(
      z.object({ type: nodeType, settings: z.record(z.string(), settingValue) }).strict(),
    ),
  })
  .strict()

export const EVENTS = {
  page_viewed: {
    description: 'A page was opened.',
    properties: z
      .object({
        page: z.enum(['home', 'quick-tool', 'pipeline-tool', 'studio', 'privacy']),
        tool: tool.optional(),
      })
      .strict(),
  },
  quick_tool_opened: {
    description: 'A quick tool page was opened.',
    properties: z.object({ tool }).strict(),
  },
  files_added: {
    description: 'Files were added: how many were accepted and refused, and why.',
    properties: z
      .object({ surface, accepted: count, refused: count, refusalCodes: z.array(code) })
      .strict(),
  },
  run_started: {
    description: 'A run started: the pipeline shape and settings, the item count and the estimate.',
    properties: z
      .object({
        surface,
        tool: tool.optional(),
        itemCount: count,
        workers: count,
        estimatedEncodes: count,
        estimatedSeconds: z.number().nonnegative(),
        pipeline: shape,
      })
      .strict(),
  },
  run_finished: {
    description:
      'A run finished: its status, counts of processed, skipped, cached and failed items, failure and warning codes, bytes and duration.',
    properties: z
      .object({
        surface,
        tool: tool.optional(),
        status: z.enum(['complete', 'cancelled', 'failed']),
        itemCount: count,
        processed: count,
        skipped: count,
        failed: count,
        cached: count,
        durationMs: z.number().nonnegative(),
        inputBytes: count,
        outputBytes: count,
        failureCodes: z.array(code),
        warningCodes: z.array(code),
      })
      .strict(),
  },
  delivery_downloaded: {
    description: 'A delivery was downloaded or saved to a folder: file count and bytes.',
    properties: z
      .object({
        surface,
        destination: z.enum(['zip', 'folder', 'file']),
        automatic: z.boolean(),
        fileCount: count,
        bytes: count,
      })
      .strict(),
  },
  template_chosen: {
    description: 'A template was chosen in the Studio.',
    properties: z.object({ template: z.string().regex(/^[a-z0-9-]{1,40}$/) }).strict(),
  },
  node_added: {
    description: 'A node was added to the canvas, and how.',
    properties: z.object({ nodeType, method: z.enum(['drag', 'click', 'search']) }).strict(),
  },
  connection_checked: {
    description: 'A connection was made or refused: the two node types and the decision.',
    properties: z
      .object({
        sourceType: nodeType,
        targetType: nodeType,
        decision: z.enum(['ok', 'narrows', 'refused']),
      })
      .strict(),
  },
  pipeline_saved: {
    description: 'A pipeline was saved in the browser: its shape and settings.',
    properties: z.object({ pipeline: shape }).strict(),
  },
  pipeline_file: {
    description: 'A .hexlode file was exported or imported, with an error code when import failed.',
    properties: z
      .object({
        action: z.enum(['export', 'import']),
        result: z.enum(['ok', 'error']),
        nodeCount: count,
        errorCode: code.optional(),
      })
      .strict(),
  },
  sample_chosen: {
    description: 'A sample image was chosen for live previews.',
    properties: z.object({ source: z.enum(['first-file', 'picked']) }).strict(),
  },
  step_cache_changed: {
    description: 'The step cache budget was changed or the cache was cleared.',
    properties: z
      .object({ action: z.enum(['budget', 'clear']), budgetGigabytes: z.number().optional() })
      .strict(),
  },
} as const

export type AnalyticsEventName = keyof typeof EVENTS
export type EventProperties<E extends AnalyticsEventName> = z.input<
  (typeof EVENTS)[E]['properties']
>
export type PipelineShape = z.infer<typeof shape>
