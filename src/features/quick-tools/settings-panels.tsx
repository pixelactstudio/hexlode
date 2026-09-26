import { Grid } from '@astryxdesign/core/Grid'
import { NumberInput } from '@astryxdesign/core/NumberInput'
import { RadioList, RadioListItem } from '@astryxdesign/core/RadioList'
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl'
import { SelectableCard } from '@astryxdesign/core/SelectableCard'
import { Selector, SelectorOption } from '@astryxdesign/core/Selector'
import { Slider } from '@astryxdesign/core/Slider'
import { VStack } from '@astryxdesign/core/Stack'
import { Switch } from '@astryxdesign/core/Switch'
import { Text } from '@astryxdesign/core/Text'

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

export const FORMAT_OPTIONS: { value: TargetFormat; label: string; hint: string }[] = [
  { value: 'webp', label: 'WebP', hint: 'Small files. Opens in every browser.' },
  { value: 'jpeg', label: 'JPEG', hint: 'Photos. Opens everywhere.' },
  { value: 'avif', label: 'AVIF', hint: 'Smallest files. Slower to save.' },
  { value: 'png', label: 'PNG', hint: 'Lossless, keeps transparency.' },
  { value: 'jxl', label: 'JPEG XL', hint: 'Small files. Few apps open it yet.' },
  { value: 'qoi', label: 'QOI', hint: 'Fast lossless. Rarely supported.' },
]

export const QUALITY_HINT =
  'Higher keeps more detail, lower makes smaller files. 75 to 85 suits most photos.'

/** A small grid of cards for picking one of a few options, each with a one-line hint. */
export function ChoiceCards<T extends string>({
  label,
  value,
  options,
  onChange,
  isDisabled,
  columns = 3,
}: {
  label: string
  value: T
  options: { value: T; label: string; hint: string }[]
  onChange: (value: T) => void
  isDisabled?: boolean
  columns?: number
}) {
  return (
    <VStack gap={2} role="radiogroup" aria-label={label}>
      <Text type="label">{label}</Text>
      <Grid columns={columns} gap={2}>
        {options.map((option) => (
          <SelectableCard
            key={option.value}
            label={option.label}
            isSelected={value === option.value}
            onChange={() => onChange(option.value)}
            isDisabled={isDisabled}
            padding={3}
          >
            <VStack gap={0.5}>
              <Text type="label" weight="semibold">
                {option.label}
              </Text>
              <Text type="supporting">{option.hint}</Text>
            </VStack>
          </SelectableCard>
        ))}
      </Grid>
    </VStack>
  )
}

function ConvertPanel({ value, onChange, isDisabled }: PanelProps<ConvertToolSettings>) {
  const hasQuality = QUALITY_FORMATS.includes(value.format) && !value.lossless
  return (
    <VStack gap={4}>
      <ChoiceCards
        label="Save as"
        value={value.format}
        options={FORMAT_OPTIONS}
        onChange={(format) => onChange({ ...value, format })}
        isDisabled={isDisabled}
      />
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
          description={QUALITY_HINT}
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
        <SegmentedControlItem value="quality" label="By quality" />
        <SegmentedControlItem value="target" label="To a file size" />
      </SegmentedControl>
      <Text type="supporting">
        {value.mode === 'quality'
          ? 'Re-saves each image at the quality you choose. Images that would get bigger are kept as they are.'
          : 'Finds the highest quality that fits under the size you choose.'}
      </Text>
      {value.mode === 'quality' ? (
        <Slider
          label="Quality"
          description={`Each image keeps its format; PNG files are optimised without loss. ${QUALITY_HINT}`}
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
            label="Maximum file size"
            description="Every image is made to fit under this size."
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

const RESIZE_MODES: { value: ResizeToolSettings['mode']; label: string; hint: string }[] = [
  {
    value: 'longestEdge',
    label: 'Longest edge',
    hint: 'The longer side gets this size. Works for portrait and landscape alike.',
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
      isIntegerOnly={key !== 'percent'}
      value={value[key]}
      onChange={(next) => onChange({ ...value, [key]: next })}
      isDisabled={isDisabled}
    />
  )
  return (
    <VStack gap={4}>
      <Selector
        label="Resize by"
        value={value.mode}
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
          { value: 'lanczos3', label: 'Lanczos (sharpest, recommended)' },
          { value: 'mitchell', label: 'Mitchell' },
          { value: 'catrom', label: 'Catmull-Rom' },
          { value: 'triangle', label: 'Bilinear (softest)' },
        ]}
        isDisabled={isDisabled}
      />
      <Switch
        label="Allow enlarging"
        description="Off: images smaller than the size are left as they are."
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
