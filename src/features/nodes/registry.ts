import type { AnyNodeDefinition, NodeRegistry } from '#/features/engine/types'
import { adjustNode } from '#/features/nodes/definitions/adjust'
import { autoTrimNode } from '#/features/nodes/definitions/auto-trim'
import { backgroundNode } from '#/features/nodes/definitions/background'
import { bestFormatNode } from '#/features/nodes/definitions/best-format'
import { borderNode } from '#/features/nodes/definitions/border'
import { compressToSizeNode } from '#/features/nodes/definitions/compress-to-size'
import { contactSheetNode } from '#/features/nodes/definitions/contact-sheet'
import { convertNode } from '#/features/nodes/definitions/convert'
import { cropNode } from '#/features/nodes/definitions/crop'
import { deduplicateNode } from '#/features/nodes/definitions/deduplicate'
import { faviconNode } from '#/features/nodes/definitions/favicon'
import { filesNode } from '#/features/nodes/definitions/files'
import { filterNode } from '#/features/nodes/definitions/filter'
import { filtersNode } from '#/features/nodes/definitions/filters'
import { imageWatermarkNode } from '#/features/nodes/definitions/image-watermark'
import { imagesToPdfNode } from '#/features/nodes/definitions/images-to-pdf'
import { optimizePngNode } from '#/features/nodes/definitions/optimize-png'
import { outputNode } from '#/features/nodes/definitions/output'
import { padNode } from '#/features/nodes/definitions/pad'
import { paletteNode } from '#/features/nodes/definitions/palette'
import { compareNode, inspectNode } from '#/features/nodes/definitions/passthrough'
import { pixelArtNode } from '#/features/nodes/definitions/pixel-art'
import { placeholderNode } from '#/features/nodes/definitions/placeholder'
import { removeBackgroundNode } from '#/features/nodes/definitions/remove-background'
import { renameNode } from '#/features/nodes/definitions/rename'
import { resizeNode } from '#/features/nodes/definitions/resize'
import { responsiveSetNode } from '#/features/nodes/definitions/responsive-set'
import { rotateNode } from '#/features/nodes/definitions/rotate'
import { setCopyrightNode } from '#/features/nodes/definitions/set-copyright'
import { sharpenBlurNode } from '#/features/nodes/definitions/sharpen-blur'
import { splitNode } from '#/features/nodes/definitions/split'
import { stripMetadataNode } from '#/features/nodes/definitions/strip-metadata'
import { textWatermarkNode } from '#/features/nodes/definitions/text-watermark'

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

/** Node batch 2, in catalogue order. */
export const BATCH_TWO = [
  deduplicateNode,
  autoTrimNode,
  padNode,
  pixelArtNode,
  splitNode,
  adjustNode,
  filtersNode,
  sharpenBlurNode,
  backgroundNode,
  textWatermarkNode,
  imageWatermarkNode,
  borderNode,
] as unknown as AnyNodeDefinition[]

/** Node batch 3, in catalogue order. */
export const BATCH_THREE = [
  setCopyrightNode,
  bestFormatNode,
  responsiveSetNode,
  faviconNode,
  placeholderNode,
  paletteNode,
  contactSheetNode,
  imagesToPdfNode,
] as unknown as AnyNodeDefinition[]

/** Nodes added in version 2, in catalogue order. */
export const VERSION_TWO = [removeBackgroundNode] as unknown as AnyNodeDefinition[]

/** Every product node. */
export const PRODUCT_NODES = [...BATCH_ONE, ...BATCH_TWO, ...BATCH_THREE, ...VERSION_TWO]

export function createRegistry(nodes: AnyNodeDefinition[]): NodeRegistry {
  const byType = new Map(nodes.map((node) => [node.type, node]))
  return { get: (type) => byType.get(type), list: () => [...byType.values()] }
}

export const productRegistry = createRegistry(PRODUCT_NODES)
