import { z } from 'zod'

import { asImage, codecsOf, pixelsOf, withPixels } from '#/features/images/image-item'
import { setExifOrientation } from '#/features/images/metadata/exif'
import { applyOrientation, crop, displaySize } from '#/features/images/pixel-ops'
import { ALL_IMAGE_TYPES, OUTPUT_PORT } from '#/features/nodes/constants'
import { PIXEL_OP_MS_PER_MEGAPIXEL, pixelCost } from '#/features/nodes/cost'
import { defineNode } from '#/features/nodes/define-node'

export const ASPECT_PRESETS = [
  '1:1',
  '4:5',
  '5:4',
  '3:4',
  '4:3',
  '2:3',
  '3:2',
  '9:16',
  '16:9',
] as const
export const CROP_POSITIONS = [
  'center',
  'top',
  'bottom',
  'left',
  'right',
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
] as const

/** The aspect and position settings Crop shares with Pad / Extend. */
export const aspectFields = {
  aspect: z.enum([...ASPECT_PRESETS, 'custom']).default('1:1'),
  customWidth: z.number().positive().max(1000).default(1),
  customHeight: z.number().positive().max(1000).default(1),
  position: z.enum(CROP_POSITIONS).default('center'),
}

const schema = z.object(aspectFields)

type CropSettings = z.infer<typeof schema>

/** The width to height ratio of an aspect setting, preset or custom. */
export function ratioOf(settings: Pick<CropSettings, 'aspect' | 'customWidth' | 'customHeight'>) {
  if (settings.aspect === 'custom') return settings.customWidth / settings.customHeight
  const [width, height] = settings.aspect.split(':').map(Number)
  return width / height
}

/** The largest area with the chosen aspect ratio, placed at the chosen position. */
export function planCrop(settings: CropSettings, width: number, height: number) {
  const ratio = ratioOf(settings)
  const cropWidth = Math.max(1, Math.min(width, Math.round(height * ratio)))
  const cropHeight = Math.max(1, Math.min(height, Math.round(cropWidth / ratio)))
  const { x, y } = placeAt(settings.position, width - cropWidth, height - cropHeight)
  return { x, y, width: cropWidth, height: cropHeight }
}

/** Where something sits when `spareX` by `spareY` pixels are left over around it. */
export function placeAt(position: (typeof CROP_POSITIONS)[number], spareX: number, spareY: number) {
  const x = position.includes('left')
    ? 0
    : position.includes('right')
      ? spareX
      : Math.floor(spareX / 2)
  const y = position.includes('top')
    ? 0
    : position.includes('bottom')
      ? spareY
      : Math.floor(spareY / 2)
  return { x, y }
}

export const cropNode = defineNode({
  type: 'crop',
  label: 'Crop',
  category: 'size',
  description:
    'Crops to an aspect preset (1:1, 4:5, 16:9 and others), from the centre or a chosen position. Turns images upright first.',
  schema,
  ports: () => OUTPUT_PORT,
  accepts: () => ALL_IMAGE_TYPES,
  produces: (_settings, input) => input,
  simulate: (settings, meta) => {
    const upright = displaySize(meta)
    const area = planCrop(settings, upright.width, upright.height)
    return [
      {
        port: 'out',
        meta: { ...meta, width: area.width, height: area.height, orientation: 1, size: undefined },
      },
    ]
  },
  cost: (_settings, meta) => pixelCost(meta, PIXEL_OP_MS_PER_MEGAPIXEL),
  async run(input, settings, context) {
    if (input.mode !== 'each') throw new Error('Crop runs per item.')
    const item = asImage(input.item)
    const orientation = item.meta.orientation ?? 1
    const upright = applyOrientation(await pixelsOf(item, codecsOf(context)), orientation)
    const area = planCrop(settings, upright.width, upright.height)
    const unchanged =
      orientation === 1 && area.width === upright.width && area.height === upright.height
    if (unchanged) return [{ port: 'out', item }]
    const cropped = withPixels(item, crop(upright, area.x, area.y, area.width, area.height), {
      orientation: 1,
    })
    const { exif } = cropped.payload.metadata
    if (exif && orientation !== 1) {
      cropped.payload.metadata = { ...cropped.payload.metadata, exif: setExifOrientation(exif, 1) }
    }
    return [{ port: 'out', item: cropped }]
  },
})
