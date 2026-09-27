import type { AnyNodeDefinition, NodeRegistry } from '#/features/engine/types'
import { compressToSizeNode } from '#/features/nodes/definitions/compress-to-size'
import { convertNode } from '#/features/nodes/definitions/convert'
import { cropNode } from '#/features/nodes/definitions/crop'
import { filesNode } from '#/features/nodes/definitions/files'
import { filterNode } from '#/features/nodes/definitions/filter'
import { optimizePngNode } from '#/features/nodes/definitions/optimize-png'
import { outputNode } from '#/features/nodes/definitions/output'
import { compareNode, inspectNode } from '#/features/nodes/definitions/passthrough'
import { renameNode } from '#/features/nodes/definitions/rename'
import { resizeNode } from '#/features/nodes/definitions/resize'
import { rotateNode } from '#/features/nodes/definitions/rotate'
import { stripMetadataNode } from '#/features/nodes/definitions/strip-metadata'

/** Node batch 1, in catalogue order. */
export const BATCH_ONE = [
  filesNode,
  filterNode,
  inspectNode,
  resizeNode,
  cropNode,
  rotateNode,
  stripMetadataNode,
  convertNode,
  compressToSizeNode,
  optimizePngNode,
  renameNode,
  outputNode,
  compareNode,
] as unknown as AnyNodeDefinition[]

export function createRegistry(nodes: AnyNodeDefinition[]): NodeRegistry {
  const byType = new Map(nodes.map((node) => [node.type, node]))
  return { get: (type) => byType.get(type), list: () => [...byType.values()] }
}

export const productRegistry = createRegistry(BATCH_ONE)
