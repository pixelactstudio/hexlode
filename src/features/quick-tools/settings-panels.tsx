import { Grid } from '@astryxdesign/core/Grid'
import { NumberInput } from '@astryxdesign/core/NumberInput'
import { RadioList, RadioListItem } from '@astryxdesign/core/RadioList'
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl'
import { Selector, SelectorOption } from '@astryxdesign/core/Selector'
import { Slider } from '@astryxdesign/core/Slider'
import { HStack, VStack } from '@astryxdesign/core/Stack'
import { Switch } from '@astryxdesign/core/Switch'
import { Text } from '@astryxdesign/core/Text'
import { ToggleButton } from '@astryxdesign/core/ToggleButton'
import {
  ArrowDown,
  ArrowDownLeft,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  Dot,
} from 'lucide-react'
import type { ReactNode } from 'react'

import { ASPECT_PRESETS } from '#/features/nodes/definitions/crop'
import { AspectShape, CropDiagram } from '#/features/quick-tools/crop-diagram'
import {
  type CompressToolSettings,
  type ConvertToolSettings,
  type CropToolSettings,
  LOSSLESS_CAPABLE,
  QUALITY_FORMATS,
  type QuickTool,
  type QuickToolSettings,
  type ResizeToolSettings,
  type RotateToolSettings,
  type StripToolSettings,
  type TargetFormat,
} from '#/features/quick-tools/tools'

interface PanelProps<T> {
  value: T
  onChange: (value: T) => void
  isDisabled?: boolean
}

export const FORMAT_OPTIONS: {
  value: TargetFormat
  label: string
  /** Fits the format switch on narrow panels. */
  short: string
  hint: string
}[] = [
  { value: 'webp', label: 'WebP', short: 'WebP', hint: 'Small files that open in every browser.' },
  { value: 'jpeg', label: 'JPEG', short: 'JPEG', hint: 'Photos that open everywhere.' },
  { value: 'avif', label: 'AVIF', short: 'AVIF', hint: 'The smallest files. Slower to save.' },
  { value: 'png', label: 'PNG', short: 'PNG', hint: 'Lossless and keeps transparency.' },
  {
    value: 'jxl',
    label: 'JPEG XL',
    short: 'JXL',
    hint: 'JPEG XL: small files, but few apps open them yet.',
  },
  { value: 'qoi', label: 'QOI', short: 'QOI', hint: 'Fast and lossless, but rarely supported.' },
]

const QUALITY_HINT = '75 to 85 suits most photos.'

/** A visible label over a control whose own label is only for screen readers. */
export function Field({
  label,
  hint,
  isFullWidth = false,
  children,
}: {
  label: string
  hint?: ReactNode
  /** The control fills the row instead of hugging its content. */
  isFullWidth?: boolean
  children: ReactNode
}) {
  return (
    <VStack gap={2}>
      <Text type="label">{label}</Text>
      {isFullWidth ? children : <HStack>{children}</HStack>}
      {typeof hint === 'string' ? <Text type="supporting">{hint}</Text> : hint}
    </VStack>
  )
}

/**
 * Shows the block for `active` while keeping room for the tallest of `blocks`, so a panel keeps
 * its height when a setting changes what it shows. Hidden blocks cannot be focused or read.
 */
function Swap<K extends string>({ active, blocks }: { active: K; blocks: Record<K, ReactNode> }) {
  return (
    <span className="grid">
      {(Object.keys(blocks) as K[]).map((key) => (
        <span
          key={key}
          className={`min-w-0 [grid-area:1/1] ${key === active ? '' : 'invisible'}`}
          inert={key !== active}
        >
          {blocks[key]}
        </span>
      ))}
    </span>
  )
}

/** One of several hints, in the room of the longest. */
function SwapHint<K extends string>({ active, hints }: { active: K; hints: Record<K, string> }) {
  const blocks = Object.fromEntries(
    Object.entries(hints).map(([key, hint]) => [
      key,
      <Text key={key} type="supporting">
        {hint as string}
      </Text>,
    ]),
  ) as Record<K, ReactNode>
  return <Swap active={active} blocks={blocks} />
}

function ConvertPanel({ value, onChange, isDisabled }: PanelProps<ConvertToolSettings>) {
  const format = FORMAT_OPTIONS.find((option) => option.value === value.format)
  const canBeLossless = LOSSLESS_CAPABLE.includes(value.format)
  const hasQuality = QUALITY_FORMATS.includes(value.format)
  const lossless = value.lossless && canBeLossless
  return (
    <VStack gap={5}>
      <Field
        label="Format"
        hint={
          <SwapHint
            active={value.format}
            hints={
              Object.fromEntries(
                FORMAT_OPTIONS.map((option) => [option.value, option.hint]),
              ) as Record<TargetFormat, string>
            }
          />
        }
        isFullWidth
      >
        <SegmentedControl
          label="Format"
          value={value.format}
          layout="fill"
          onChange={(next) => onChange({ ...value, format: next as TargetFormat })}
          isDisabled={isDisabled}
        >
          {FORMAT_OPTIONS.map((option) => (
            <SegmentedControlItem key={option.value} value={option.value} label={option.short} />
          ))}
        </SegmentedControl>
      </Field>
      <Slider
        label="Quality"
        description={QUALITY_HINT}
        min={1}
        max={100}
        value={value.quality}
        valueDisplay="text"
        onChange={(quality: number) => onChange({ ...value, quality })}
        isDisabled={isDisabled || !hasQuality || lossless}
        disabledMessage={
          !hasQuality
            ? `${format?.label} is lossless, so it has no quality setting.`
            : lossless
              ? 'Lossless keeps every pixel, so quality does not apply.'
              : undefined
        }
      />
      <Switch
        label="Lossless"
        description="Keeps every pixel exactly. Files are larger."
        value={canBeLossless ? value.lossless : !hasQuality}
        onChange={(next) => onChange({ ...value, lossless: next })}
        isDisabled={isDisabled || !canBeLossless}
        disabledMessage={
          canBeLossless
            ? undefined
            : hasQuality
              ? `${format?.label} has no lossless mode.`
              : `${format?.label} is always lossless.`
        }
      />
    </VStack>
  )
}

function CompressPanel({ value, onChange, isDisabled }: PanelProps<CompressToolSettings>) {
  return (
    <VStack gap={5}>
      <Field
        label="Compress by"
        hint={
          <SwapHint
            active={value.mode}
            hints={{
              quality:
                'Saves each image again at a lower quality, in its own format. Images that would grow are kept as they are.',
              target: 'Finds the highest quality that fits under the size you choose.',
            }}
          />
        }
      >
        <SegmentedControl
          label="Compress by"
          value={value.mode}
          onChange={(mode) => onChange({ ...value, mode: mode as CompressToolSettings['mode'] })}
          isDisabled={isDisabled}
        >
          <SegmentedControlItem value="quality" label="Quality" />
          <SegmentedControlItem value="target" label="File size" />
        </SegmentedControl>
      </Field>
      <Swap
        active={value.mode}
        blocks={{
          quality: (
            <Slider
              label="Quality"
              description={`PNG files are optimised without loss. ${QUALITY_HINT}`}
              min={1}
              max={100}
              value={value.quality}
              valueDisplay="text"
              onChange={(quality: number) => onChange({ ...value, quality })}
              isDisabled={isDisabled}
            />
          ),
          target: (
            <HStack gap={3} vAlign="start" wrap="wrap">
              <NumberInput
                label="Largest file size"
                units="KB"
                min={1}
                width={180}
                value={value.targetKilobytes}
                onChange={(targetKilobytes) => onChange({ ...value, targetKilobytes })}
                isDisabled={isDisabled}
              />
              <Selector
                label="Format"
                value={value.format}
                width={180}
                onChange={(format) =>
                  onChange({ ...value, format: format as CompressToolSettings['format'] })
                }
                options={[
                  { value: 'original', label: 'Keep format' },
                  { value: 'jpeg', label: 'JPEG' },
                  { value: 'webp', label: 'WebP' },
                  { value: 'avif', label: 'AVIF' },
                  { value: 'jxl', label: 'JPEG XL' },
                ]}
                isDisabled={isDisabled}
              />
            </HStack>
          ),
        }}
      />
    </VStack>
  )
}

const RESIZE_MODES: { value: ResizeToolSettings['mode']; label: string; hint: string }[] = [
  {
    value: 'longestEdge',
    label: 'Longest edge',
    hint: 'The longer side gets this size, for portrait and landscape alike.',
  },
  { value: 'width', label: 'Width', hint: 'Sets the width. The height follows.' },
  { value: 'height', label: 'Height', hint: 'Sets the height. The width follows.' },
  { value: 'percent', label: 'Percentage', hint: 'Scales both sides by the same amount.' },
  { value: 'box', label: 'Width and height', hint: 'Fits, fills or stretches to a box.' },
]

function ResizePanel({ value, onChange, isDisabled }: PanelProps<ResizeToolSettings>) {
  const number = (
    key: 'longestEdge' | 'width' | 'height' | 'percent',
    label: string,
    units: string,
  ) => (
    <NumberInput
      label={label}
      units={units}
      min={1}
      width={140}
      isIntegerOnly={key !== 'percent'}
      value={value[key]}
      onChange={(next) => onChange({ ...value, [key]: next })}
      isDisabled={isDisabled}
    />
  )
  return (
    <VStack gap={5}>
      <HStack gap={3} vAlign="start" wrap="wrap">
        <Selector
          label="Resize by"
          value={value.mode}
          width={200}
          onChange={(mode) => onChange({ ...value, mode: mode as ResizeToolSettings['mode'] })}
          options={RESIZE_MODES.map(({ value: mode, label }) => ({ value: mode, label }))}
          renderOption={(option) => (
            <SelectorOption
              label={option.label}
              description={RESIZE_MODES.find((mode) => mode.value === option.value)?.hint}
            />
          )}
          isDisabled={isDisabled}
        />
        <Swap
          active={value.mode}
          blocks={{
            longestEdge: number('longestEdge', 'Longest edge', 'px'),
            width: number('width', 'Width', 'px'),
            height: number('height', 'Height', 'px'),
            percent: number('percent', 'Scale', '%'),
            box: (
              <HStack gap={3} vAlign="start">
                {number('width', 'Width', 'px')}
                {number('height', 'Height', 'px')}
              </HStack>
            ),
          }}
        />
      </HStack>
      <Field
        label="Fit"
        hint={
          <SwapHint
            active={value.mode === 'box' ? value.fit : 'unused'}
            hints={{
              fit: 'Fits inside the box and keeps the proportions.',
              fill: 'Covers the box and crops what is outside it.',
              exact: 'Stretches to exactly this size.',
              unused: 'Only for resizing by width and height.',
            }}
          />
        }
      >
        <SegmentedControl
          label="Fit"
          value={value.fit}
          onChange={(fit) => onChange({ ...value, fit: fit as ResizeToolSettings['fit'] })}
          isDisabled={isDisabled || value.mode !== 'box'}
        >
          <SegmentedControlItem value="fit" label="Fit" />
          <SegmentedControlItem value="fill" label="Fill" />
          <SegmentedControlItem value="exact" label="Stretch" />
        </SegmentedControl>
      </Field>
      <Switch
        label="Allow enlarging"
        description="When off, images smaller than the size are left as they are."
        value={value.allowUpscale}
        onChange={(allowUpscale) => onChange({ ...value, allowUpscale })}
        isDisabled={isDisabled}
      />
      <Selector
        label="Resampling"
        value={value.method}
        width={260}
        onChange={(method) =>
          onChange({ ...value, method: method as ResizeToolSettings['method'] })
        }
        options={[
          { value: 'lanczos3', label: 'Lanczos (sharpest)' },
          { value: 'mitchell', label: 'Mitchell' },
          { value: 'catrom', label: 'Catmull-Rom' },
          { value: 'triangle', label: 'Bilinear (softest)' },
        ]}
        isDisabled={isDisabled}
      />
    </VStack>
  )
}

const POSITIONS: {
  value: CropToolSettings['position']
  label: string
  icon: typeof ArrowUp
}[] = [
  { value: 'top-left', label: 'Top left', icon: ArrowUpLeft },
  { value: 'top', label: 'Top', icon: ArrowUp },
  { value: 'top-right', label: 'Top right', icon: ArrowUpRight },
  { value: 'left', label: 'Left', icon: ArrowLeft },
  { value: 'center', label: 'Centre', icon: Dot },
  { value: 'right', label: 'Right', icon: ArrowRight },
  { value: 'bottom-left', label: 'Bottom left', icon: ArrowDownLeft },
  { value: 'bottom', label: 'Bottom', icon: ArrowDown },
  { value: 'bottom-right', label: 'Bottom right', icon: ArrowDownRight },
]

const ASPECTS = [...ASPECT_PRESETS, 'custom'] as const

function sidesOf(aspect: (typeof ASPECT_PRESETS)[number]) {
  const [width, height] = aspect.split(':').map(Number)
  return { width, height }
}

function ratioOf(aspect: (typeof ASPECT_PRESETS)[number]) {
  const { width, height } = sidesOf(aspect)
  return width / height
}

function CropPanel({ value, onChange, isDisabled }: PanelProps<CropToolSettings>) {
  const position = POSITIONS.find((option) => option.value === value.position)
  const isCustom = value.aspect === 'custom'
  const preset = isCustom ? null : sidesOf(value.aspect as (typeof ASPECT_PRESETS)[number])
  const choose = (aspect: (typeof ASPECTS)[number]) => {
    if (aspect !== 'custom' || !preset) return onChange({ ...value, aspect })
    // Custom starts from the shape that was chosen, so the fields do not jump.
    onChange({ ...value, aspect, customWidth: preset.width, customHeight: preset.height })
  }
  return (
    <VStack gap={5}>
      <Field label="Shape" isFullWidth>
        <Grid columns={{ minWidth: 76 }} gap={1}>
          {ASPECTS.map((aspect) => (
            <ToggleButton
              key={aspect}
              label={aspect === 'custom' ? 'Custom shape' : `Shape ${aspect}`}
              size="sm"
              icon={aspect === 'custom' ? undefined : <AspectShape ratio={ratioOf(aspect)} />}
              isPressed={value.aspect === aspect}
              onPressedChange={() => choose(aspect)}
              isDisabled={isDisabled}
            >
              {aspect === 'custom' ? 'Custom' : aspect}
            </ToggleButton>
          ))}
        </Grid>
      </Field>
      <HStack gap={2} vAlign="end">
        <NumberInput
          label="Width"
          min={0.01}
          width={96}
          value={preset ? preset.width : value.customWidth}
          onChange={(customWidth) => onChange({ ...value, customWidth })}
          isDisabled={isDisabled || !isCustom}
        />
        <span className="pb-2">
          <Text type="supporting">by</Text>
        </span>
        <NumberInput
          label="Height"
          min={0.01}
          width={96}
          value={preset ? preset.height : value.customHeight}
          onChange={(customHeight) => onChange({ ...value, customHeight })}
          isDisabled={isDisabled || !isCustom}
        />
      </HStack>
      <Field
        label="Keep"
        hint={`${position?.label ?? ''}. Photos are turned upright before cropping.`}
      >
        <HStack gap={5} vAlign="center" wrap="wrap">
          <Grid columns={3} gap={1} width={104}>
            {POSITIONS.map((option) => (
              <ToggleButton
                key={option.value}
                label={option.label}
                icon={<option.icon size={16} />}
                isIconOnly
                size="sm"
                isPressed={value.position === option.value}
                onPressedChange={() => onChange({ ...value, position: option.value })}
                isDisabled={isDisabled}
              />
            ))}
          </Grid>
          <CropDiagram settings={value} />
        </HStack>
      </Field>
    </VStack>
  )
}

function RotatePanel({ value, onChange, isDisabled }: PanelProps<RotateToolSettings>) {
  return (
    <VStack gap={5}>
      <Switch
        label="Turn upright"
        description="Uses the orientation the camera saved with the photo."
        value={value.auto}
        onChange={(auto) => onChange({ ...value, auto })}
        isDisabled={isDisabled}
      />
      <Field label="Then rotate clockwise">
        <SegmentedControl
          label="Rotate clockwise"
          value={String(value.rotate)}
          onChange={(rotate) =>
            onChange({ ...value, rotate: Number(rotate) as RotateToolSettings['rotate'] })
          }
          isDisabled={isDisabled}
        >
          <SegmentedControlItem value="0" label="0°" />
          <SegmentedControlItem value="90" label="90°" />
          <SegmentedControlItem value="180" label="180°" />
          <SegmentedControlItem value="270" label="270°" />
        </SegmentedControl>
      </Field>
      <HStack gap={6} wrap="wrap">
        <Switch
          label="Flip horizontally"
          value={value.flipHorizontal}
          onChange={(flipHorizontal) => onChange({ ...value, flipHorizontal })}
          isDisabled={isDisabled}
        />
        <Switch
          label="Flip vertically"
          value={value.flipVertical}
          onChange={(flipVertical) => onChange({ ...value, flipVertical })}
          isDisabled={isDisabled}
        />
      </HStack>
    </VStack>
  )
}

export const STRIP_MODES = [
  {
    value: 'all',
    label: 'All metadata',
    description: 'Camera, dates, location and names.',
  },
  {
    value: 'location',
    label: 'Only location',
    description: 'GPS and place names. Keeps the rest.',
  },
  {
    value: 'copyright',
    label: 'All but copyright',
    description: 'Keeps only the copyright notice.',
  },
] as const

function StripPanel({ value, onChange, isDisabled }: PanelProps<StripToolSettings>) {
  return (
    <VStack gap={5}>
      <RadioList
        label="Remove"
        value={value.mode}
        onChange={(mode) => onChange({ ...value, mode: mode as StripToolSettings['mode'] })}
        isDisabled={isDisabled}
      >
        {STRIP_MODES.map((mode) => (
          <RadioListItem
            key={mode.value}
            value={mode.value}
            label={mode.label}
            description={mode.description}
          />
        ))}
      </RadioList>
      <Switch
        label="Keep the colour profile"
        description="Removing it can change how colours look."
        value={value.keepColourProfile}
        onChange={(keepColourProfile) => onChange({ ...value, keepColourProfile })}
        isDisabled={isDisabled}
      />
    </VStack>
  )
}

export function SettingsPanel<T extends QuickTool>({
  tool,
  ...props
}: { tool: T } & PanelProps<QuickToolSettings[T]>) {
  switch (tool) {
    case 'convert':
      return <ConvertPanel {...(props as unknown as PanelProps<ConvertToolSettings>)} />
    case 'compress':
      return <CompressPanel {...(props as unknown as PanelProps<CompressToolSettings>)} />
    case 'resize':
      return <ResizePanel {...(props as unknown as PanelProps<ResizeToolSettings>)} />
    case 'crop':
      return <CropPanel {...(props as unknown as PanelProps<CropToolSettings>)} />
    case 'rotate':
      return <RotatePanel {...(props as unknown as PanelProps<RotateToolSettings>)} />
    default:
      return <StripPanel {...(props as unknown as PanelProps<StripToolSettings>)} />
  }
}
