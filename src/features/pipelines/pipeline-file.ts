/**
 * The .hexlode pipeline file: versioned JSON. Every published version stays readable; import
 * migrates older versions one step at a time.
 */
import { topologicalOrder } from '#/features/engine/compatibility'
import type { NodeRegistry, Pipeline } from '#/features/engine/types'
import { PIPELINE_FILE_FORMAT, PIPELINE_FILE_VERSION } from '#/features/pipelines/constants'
import type { NamedPipeline } from '#/features/pipelines/types'
import { pipelineFileSchema } from '#/features/pipelines/validators'

export class PipelineFileError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PipelineFileError'
  }
}

type Migration = (file: Record<string, unknown>) => Record<string, unknown>

/** Upgrades a file from the version it is keyed by to the next version. */
export const MIGRATIONS: Record<number, Migration> = {}

export function exportPipelineFile({ name, pipeline }: NamedPipeline) {
  const file = {
    format: PIPELINE_FILE_FORMAT,
    version: PIPELINE_FILE_VERSION,
    name,
    pipeline: {
      nodes: pipeline.nodes.map(({ id, type, settings, position }) => ({
        id,
        type,
        settings,
        position,
      })),
      connections: pipeline.connections.map(({ id, source, sourcePort, target }) => ({
        id,
        source,
        sourcePort,
        target,
      })),
    },
  }
  return `${JSON.stringify(file, null, 2)}\n`
}

/** Checks a pipeline against the registry: node types, their settings and the connections. */
export function validatePipeline(pipeline: Pipeline, registry: NodeRegistry) {
  const missing = [...new Set(pipeline.nodes.map((node) => node.type))].filter(
    (type) => !registry.get(type),
  )
  if (missing.length > 0) {
    throw new PipelineFileError(
      `This pipeline uses nodes this version of Hexlode does not have: ${missing.join(', ')}.`,
    )
  }
  for (const node of pipeline.nodes) {
    const definition = registry.get(node.type)
    try {
      definition?.parseSettings(node.settings)
    } catch {
      throw new PipelineFileError(`The settings of ${definition?.label} are not valid.`)
    }
  }
  const ids = new Set(pipeline.nodes.map((node) => node.id))
  if (ids.size !== pipeline.nodes.length) {
    throw new PipelineFileError('Two nodes share the same id.')
  }
  for (const connection of pipeline.connections) {
    if (!ids.has(connection.source) || !ids.has(connection.target)) {
      throw new PipelineFileError('A connection points to a node that does not exist.')
    }
  }
  try {
    topologicalOrder(pipeline)
  } catch {
    throw new PipelineFileError('The pipeline contains a loop.')
  }
}

export function importPipelineFile(
  text: string,
  registry: NodeRegistry,
  migrations: Record<number, Migration> = MIGRATIONS,
): NamedPipeline {
  let raw: Record<string, unknown>
  try {
    raw = JSON.parse(text)
  } catch {
    throw new PipelineFileError('This is not a .hexlode file.')
  }
  if (!raw || typeof raw !== 'object' || raw.format !== PIPELINE_FILE_FORMAT) {
    throw new PipelineFileError('This is not a .hexlode file.')
  }
  let version = Number(raw.version)
  if (!Number.isInteger(version)) throw new PipelineFileError('This is not a .hexlode file.')
  if (version > PIPELINE_FILE_VERSION) {
    throw new PipelineFileError('This file was made by a newer version of Hexlode.')
  }
  while (version < PIPELINE_FILE_VERSION) {
    const migrate = migrations[version]
    if (!migrate) throw new PipelineFileError('This .hexlode file is too old to open.')
    raw = migrate(raw)
    version = Number(raw.version)
  }
  const parsed = pipelineFileSchema.safeParse(raw)
  if (!parsed.success) throw new PipelineFileError('This .hexlode file is damaged.')
  const { name, pipeline } = parsed.data
  validatePipeline(pipeline, registry)
  return { name, pipeline }
}

export function pipelineFileName(name: string) {
  const safe = name
    .replaceAll(/[^\p{L}\p{N}_ -]/gu, '')
    .trim()
    .replaceAll(/\s+/g, '-')
  return `${safe || 'pipeline'}.hexlode`
}
