import { NumberInput } from '@astryxdesign/core/NumberInput'
import { RadioList, RadioListItem } from '@astryxdesign/core/RadioList'
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl'
import { Selector } from '@astryxdesign/core/Selector'
import { Slider } from '@astryxdesign/core/Slider'
import { VStack } from '@astryxdesign/core/Stack'
import { Switch } from '@astryxdesign/core/Switch'

import {
  type CompressToolSettings,
  type ConvertToolSettings,
  LOSSLESS_CAPABLE,
  QUALITY_FORMATS,
  type QuickTool,
  type QuickToolSettings,
  type ResizeToolSettings,
  type StripToolSettings,
  type TargetFormat,
} from '#/features/quick-tools/tools'

interface PanelProps<T> {
  value: T
  onChange: (value: T) => void
  isDisabled?: boolean
}

export const FORMAT_OPTIONS: { value: TargetFormat; label: string }[] = [
  { value: 'jpeg', label: 'JPEG' },
  { value: 'png', label: 'PNG' },
  { value: 'webp', label: 'WebP' },
  { value: 'avif', label: 'AVIF' },
  { value: 'jxl', label: 'JPEG XL' },
  { value: 'qoi', label: 'QOI' },
]

function ConvertPanel({ value, onChange, isDisabled }: PanelProps<ConvertToolSettings>) {
  const hasQuality = QUALITY_FORMATS.includes(value.format) && !value.lossless
  return (
    <VStack gap={4}>
      <SegmentedControl
        label="Format"
        value={value.format}
        onChange={(format) => onChange({ ...value, format: format as TargetFormat })}
        isDisabled={isDisabled}
      >
        {FORMAT_OPTIONS.map((option) => (
          <SegmentedControlItem key={option.value} value={option.value} label={option.label} />
        ))}
      </SegmentedControl>
      {LOSSLESS_CAPABLE.includes(value.format) ? (
        <Switch
          label="Lossless"
          description="Keeps every pixel exactly. Files are larger."
          value={value.lossless}
          onChange={(lossless) => onChange({ ...value, lossless })}
          isDisabled={isDisabled}
        />
      ) : null}
      {hasQuality ? (
        <Slider
          label="Quality"
          min={1}
          max={100}
          value={value.quality}
          valueDisplay="text"
          onChange={(quality: number) => onChange({ ...value, quality })}
          isDisabled={isDisabled}
        />
      ) : null}
    </VStack>
  )
}

function CompressPanel({ value, onChange, isDisabled }: PanelProps<CompressToolSettings>) {
  return (
    <VStack gap={4}>
      <SegmentedControl
        label="Compress by"
        value={value.mode}
        onChange={(mode) => onChange({ ...value, mode: mode as CompressToolSettings['mode'] })}
        isDisabled={isDisabled}
      >
        <SegmentedControlItem value="quality" label="Quality" />
        <SegmentedControlItem value="target" label="Target size" />
      </SegmentedControl>
      {value.mode === 'quality' ? (
        <Slider
          label="Quality"
          description="Each image keeps its format. PNG files are optimised without loss."
          min={1}
          max={100}
          value={value.quality}
          valueDisplay="text"
          onChange={(quality: number) => onChange({ ...value, quality })}
          isDisabled={isDisabled}
        />
      ) : (
        <>
          <NumberInput
            label="Target size"
            units="KB"
            min={1}
            value={value.targetKilobytes}
            onChange={(targetKilobytes) => onChange({ ...value, targetKilobytes })}
            isDisabled={isDisabled}
          />
          <Selector
            label="Format"
            description="Keeping the format works for JPEG, WebP, AVIF and JPEG XL files."
            value={value.format}
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
        </>
      )}
    </VStack>
  )
}

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
      isIntegerOnly={key !== 'percent'}
      value={value[key]}
      onChange={(next) => onChange({ ...value, [key]: next })}
      isDisabled={isDisabled}
    />
  )
  return (
    <VStack gap={4}>
      <SegmentedControl
        label="Resize by"
        value={value.mode}
        onChange={(mode) => onChange({ ...value, mode: mode as ResizeToolSettings['mode'] })}
        isDisabled={isDisabled}
      >
        <SegmentedControlItem value="longestEdge" label="Longest edge" />
        <SegmentedControlItem value="width" label="Width" />
        <SegmentedControlItem value="height" label="Height" />
        <SegmentedControlItem value="percent" label="Percent" />
        <SegmentedControlItem value="box" label="Width and height" />
      </SegmentedControl>
      {value.mode === 'longestEdge' ? number('longestEdge', 'Longest edge', 'px') : null}
      {value.mode === 'width' || value.mode === 'box' ? number('width', 'Width', 'px') : null}
      {value.mode === 'height' || value.mode === 'box' ? number('height', 'Height', 'px') : null}
      {value.mode === 'percent' ? number('percent', 'Scale', '%') : null}
      {value.mode === 'box' ? (
        <RadioList
          label="Fit"
          value={value.fit}
          onChange={(fit) => onChange({ ...value, fit: fit as ResizeToolSettings['fit'] })}
          isDisabled={isDisabled}
        >
          <RadioListItem
            value="fit"
            label="Fit"
            description="Fits inside the box and keeps the proportions."
          />
          <RadioListItem
            value="fill"
            label="Fill"
            description="Covers the box and crops what is outside it."
          />
          <RadioListItem
            value="exact"
            label="Exact"
            description="Stretches to exactly this size."
          />
        </RadioList>
      ) : null}
      <Selector
        label="Resampling"
        value={value.method}
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
      <Switch
        label="Allow enlarging"
        value={value.allowUpscale}
        onChange={(allowUpscale) => onChange({ ...value, allowUpscale })}
        isDisabled={isDisabled}
      />
    </VStack>
  )
}

export const STRIP_MODES = [
  {
    value: 'all',
    label: 'All metadata',
    description: 'Removes EXIF and XMP: camera, dates, location, names.',
  },
  {
    value: 'location',
    label: 'Only location',
    description: 'Removes GPS and place names. Keeps the rest.',
  },
  {
    value: 'copyright',
    label: 'Everything except copyright',
    description: 'Keeps only the copyright notice.',
  },
] as const

function StripPanel({ value, onChange, isDisabled }: PanelProps<StripToolSettings>) {
  return (
    <VStack gap={4}>
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
        description="The profile describes the colours; removing it can change how images look."
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
    default:
      return <StripPanel {...(props as unknown as PanelProps<StripToolSettings>)} />
  }
}
