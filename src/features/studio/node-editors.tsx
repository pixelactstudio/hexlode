/** Settings forms for node batches 2 and 3. */
import { Button } from '@astryxdesign/core/Button'
import { FileInput } from '@astryxdesign/core/FileInput'
import { Grid } from '@astryxdesign/core/Grid'
import { NumberInput } from '@astryxdesign/core/NumberInput'
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl'
import { Selector } from '@astryxdesign/core/Selector'
import { Slider } from '@astryxdesign/core/Slider'
import { HStack, VStack } from '@astryxdesign/core/Stack'
import { Switch } from '@astryxdesign/core/Switch'
import { Text } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import { type ReactNode, useEffect, useState } from 'react'

import { MAX_LOGO_BYTES, MAX_RESIZE_DIMENSION } from '#/features/nodes/constants'
import { CANDIDATE_FORMATS } from '#/features/nodes/definitions/best-format'
import type { Logo } from '#/features/nodes/definitions/image-watermark'
import { AspectFields, Field, FORMAT_OPTIONS } from '#/features/quick-tools/settings-panels'
import type { CropToolSettings } from '#/features/quick-tools/tools'
import { LOGO_ACCEPT, readLogo } from '#/features/studio/logo'
import {
  ColourField,
  type EditorProps,
  MoreOptions,
  PositionField,
} from '#/features/studio/settings-fields'

type Editor = (props: EditorProps) => ReactNode

const formatLabel = (format: string) =>
  FORMAT_OPTIONS.find((option) => option.value === format)?.label ?? format

/** A segmented choice with a visible label. */
function Choice({
  label,
  value,
  options,
  onChange,
  isDisabled,
  disabledMessage,
  hint,
}: {
  label: string
  value: unknown
  options: { value: string; label: string }[]
  onChange: (value: string) => void
  isDisabled?: boolean
  disabledMessage?: string
  hint?: string
}) {
  return (
    <Field label={label} hint={hint}>
      <SegmentedControl
        label={label}
        value={String(value)}
        onChange={onChange}
        isDisabled={isDisabled}
        disabledMessage={disabledMessage}
      >
        {options.map((option) => (
          <SegmentedControlItem key={option.value} value={option.value} label={option.label} />
        ))}
      </SegmentedControl>
    </Field>
  )
}

/** A percentage slider that shows its value. */
function Percent({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  isDisabled,
  disabledMessage,
  description,
}: {
  label: string
  value: unknown
  onChange: (value: number) => void
  min?: number
  max?: number
  isDisabled?: boolean
  disabledMessage?: string
  description?: string
}) {
  return (
    <Slider
      label={label}
      description={description}
      min={min}
      max={max}
      value={Number(value)}
      valueDisplay="text"
      formatValue={(level) => `${level}%`}
      onChange={(level: number) => onChange(level)}
      isDisabled={isDisabled}
      disabledMessage={disabledMessage}
    />
  )
}

const DeduplicateEditor: Editor = ({ settings, onChange, isDisabled }) => (
  <VStack gap={4}>
    <Choice
      label="Find"
      value={settings.mode}
      options={[
        { value: 'near', label: 'Near duplicates' },
        { value: 'exact', label: 'Exact duplicates' },
      ]}
      onChange={(mode) => onChange({ mode })}
      isDisabled={isDisabled}
      hint={
        settings.mode === 'near'
          ? 'Finds copies that were resized, re-saved or lightly edited.'
          : 'Finds images with identical pixels, whatever their format or metadata.'
      }
    />
    <Percent
      label="Allowed difference"
      description="Resaved and resized copies differ by under 5%; different photos by over 12%."
      max={30}
      value={settings.difference}
      onChange={(difference) => onChange({ difference })}
      isDisabled={isDisabled || settings.mode !== 'near'}
      disabledMessage="Exact duplicates must match every pixel."
    />
    <Choice
      label="Keep"
      value={settings.keep}
      options={[
        { value: 'first', label: 'The first' },
        { value: 'largest', label: 'The largest' },
      ]}
      onChange={(keep) => onChange({ keep })}
      isDisabled={isDisabled}
    />
    <Text type="supporting">
      Waits for every image. Duplicates leave by the Duplicates output, so connect it to keep them.
    </Text>
  </VStack>
)

const AutoTrimEditor: Editor = ({ settings, onChange, isDisabled }) => (
  <VStack gap={4}>
    <Percent
      label="Tolerance"
      description="How far a colour may be from the corner's and still count as border."
      value={settings.tolerance}
      onChange={(tolerance) => onChange({ tolerance })}
      isDisabled={isDisabled}
    />
    <NumberInput
      label="Keep around the image"
      units="px"
      min={0}
      max={1000}
      isIntegerOnly
      width={160}
      value={Number(settings.padding)}
      onChange={(padding) => onChange({ padding })}
      isDisabled={isDisabled}
    />
  </VStack>
)

const PadEditor: Editor = ({ settings, onChange, isDisabled }) => {
  const isBlur = settings.fill === 'blur'
  return (
    <VStack gap={4}>
      <AspectFields
        value={settings as unknown as CropToolSettings}
        onChange={(value) => onChange(value as unknown as Record<string, unknown>)}
        isDisabled={isDisabled}
      />
      <Choice
        label="Fill"
        value={settings.fill}
        options={[
          { value: 'colour', label: 'Colour' },
          { value: 'blur', label: 'Blurred image' },
        ]}
        onChange={(fill) => onChange({ fill })}
        isDisabled={isDisabled}
      />
      <ColourField
        label="Colour"
        value={String(settings.colour)}
        onChange={(colour) => onChange({ colour })}
        isDisabled={isDisabled || isBlur}
        disabledMessage="The blurred image fills the space."
      />
      <PositionField
        label="Place the image"
        value={String(settings.position)}
        onChange={(position) => onChange({ position })}
        isDisabled={isDisabled}
        hint="Photos are turned upright first."
      />
    </VStack>
  )
}

const PixelArtEditor: Editor = ({ settings, onChange, isDisabled }) => (
  <VStack gap={4}>
    <Choice
      label="Scale"
      value={settings.scale}
      options={[
        { value: '2', label: '2x' },
        { value: '3', label: '3x' },
        { value: '4', label: '4x' },
      ]}
      onChange={(scale) => onChange({ scale: Number(scale) })}
      isDisabled={isDisabled}
    />
    <Choice
      label="Edges"
      value={settings.method}
      options={[
        { value: 'nearest', label: 'Hard pixels' },
        { value: 'smooth', label: 'Smooth diagonals' },
      ]}
      onChange={(method) => onChange({ method })}
      isDisabled={isDisabled}
      hint="Smooth diagonals round off stair steps but never blend colours."
    />
  </VStack>
)

const SplitEditor: Editor = ({ settings, onChange, isDisabled }) => (
  <VStack gap={4}>
    <HStack gap={2}>
      {(['columns', 'rows'] as const).map((key) => (
        <NumberInput
          key={key}
          label={key === 'columns' ? 'Columns' : 'Rows'}
          min={1}
          max={20}
          isIntegerOnly
          width={120}
          value={Number(settings[key])}
          onChange={(value) => onChange({ [key]: value })}
          isDisabled={isDisabled}
        />
      ))}
    </HStack>
    <Text type="supporting">
      Tiles are numbered left to right, top to bottom. Photos are turned upright first.
    </Text>
  </VStack>
)

const ADJUSTMENTS = [
  { key: 'brightness', label: 'Brightness' },
  { key: 'contrast', label: 'Contrast' },
  { key: 'saturation', label: 'Saturation' },
] as const

const AdjustEditor: Editor = ({ settings, onChange, isDisabled }) => (
  <VStack gap={4}>
    {ADJUSTMENTS.map(({ key, label }) => (
      <Slider
        key={key}
        label={label}
        min={-100}
        max={100}
        value={Number(settings[key])}
        valueDisplay="text"
        onChange={(value: number) => onChange({ [key]: value })}
        isDisabled={isDisabled}
      />
    ))}
    <Slider
      label="Exposure"
      description="In stops: each stop doubles or halves the light."
      min={-3}
      max={3}
      step={0.1}
      value={Number(settings.exposure)}
      valueDisplay="text"
      formatValue={(value) => value.toFixed(1)}
      onChange={(exposure: number) => onChange({ exposure: Math.round(exposure * 10) / 10 })}
      isDisabled={isDisabled}
    />
  </VStack>
)

const FiltersEditor: Editor = ({ settings, onChange, isDisabled }) => {
  const isDuotone = settings.filter === 'duotone'
  return (
    <VStack gap={4}>
      <Selector
        label="Filter"
        value={String(settings.filter)}
        onChange={(filter) => onChange({ filter })}
        options={[
          { value: 'grayscale', label: 'Grayscale' },
          { value: 'sepia', label: 'Sepia' },
          { value: 'duotone', label: 'Duotone' },
          { value: 'invert', label: 'Invert' },
        ]}
        isDisabled={isDisabled}
      />
      <Percent
        label="Strength"
        value={settings.strength}
        onChange={(strength) => onChange({ strength })}
        isDisabled={isDisabled}
      />
      {(['shadows', 'highlights'] as const).map((key) => (
        <ColourField
          key={key}
          label={key === 'shadows' ? 'Shadows' : 'Highlights'}
          value={String(settings[key])}
          onChange={(value) => onChange({ [key]: value })}
          isDisabled={isDisabled || !isDuotone}
          disabledMessage="Only duotone uses these colours."
        />
      ))}
    </VStack>
  )
}

const AREA_FIELDS = [
  { key: 'x', label: 'From left' },
  { key: 'y', label: 'From top' },
  { key: 'width', label: 'Width' },
  { key: 'height', label: 'Height' },
] as const

const SharpenBlurEditor: Editor = ({ settings, onChange, isDisabled }) => {
  const isBlur = settings.effect === 'blur'
  const area = settings.area as Record<string, number>
  const isWhole = settings.region === 'whole'
  return (
    <VStack gap={4}>
      <Choice
        label="Effect"
        value={settings.effect}
        options={[
          { value: 'sharpen', label: 'Sharpen' },
          { value: 'blur', label: 'Blur' },
        ]}
        onChange={(effect) => onChange({ effect })}
        isDisabled={isDisabled}
      />
      <NumberInput
        label="Radius"
        description={isBlur ? 'How far the blur spreads.' : 'The size of the detail to sharpen.'}
        units="px"
        min={0.5}
        max={100}
        step={0.5}
        width={160}
        value={Number(settings.radius)}
        onChange={(radius) => onChange({ radius })}
        isDisabled={isDisabled}
      />
      <Percent
        label="Amount"
        max={500}
        value={settings.amount}
        onChange={(amount) => onChange({ amount })}
        isDisabled={isDisabled || isBlur}
        disabledMessage="Blur has no amount; change the radius."
      />
      <Choice
        label="Apply to"
        value={settings.region}
        options={[
          { value: 'whole', label: 'Whole image' },
          { value: 'area', label: 'An area' },
        ]}
        onChange={(region) => onChange({ region })}
        isDisabled={isDisabled}
        hint="The area is in percent of the upright image."
      />
      <Grid columns={2} gap={2}>
        {AREA_FIELDS.map(({ key, label }) => (
          <NumberInput
            key={key}
            label={label}
            units="%"
            min={0}
            max={100}
            value={area[key]}
            onChange={(value) => onChange({ area: { ...area, [key]: value } })}
            isDisabled={isDisabled || isWhole}
            disabledMessage="Choose An area to set it."
          />
        ))}
      </Grid>
    </VStack>
  )
}

const BackgroundEditor: Editor = ({ settings, onChange, isDisabled }) => (
  <VStack gap={4}>
    <ColourField
      label="Colour"
      value={String(settings.colour)}
      onChange={(colour) => onChange({ colour })}
      isDisabled={isDisabled}
    />
    <Text type="supporting">JPEG images have no transparency, so they pass through unchanged.</Text>
  </VStack>
)

const TextWatermarkEditor: Editor = ({ settings, onChange, isDisabled }) => {
  const isTile = settings.tile === true
  return (
    <VStack gap={4}>
      <TextInput
        label="Text"
        value={String(settings.text)}
        onChange={(text) => onChange({ text })}
        isDisabled={isDisabled}
      />
      <Percent
        label="Size"
        description="Font size in percent of the image's shorter edge."
        min={1}
        max={50}
        value={settings.size}
        onChange={(size) => onChange({ size })}
        isDisabled={isDisabled}
      />
      <Percent
        label="Opacity"
        value={settings.opacity}
        onChange={(opacity) => onChange({ opacity })}
        isDisabled={isDisabled}
      />
      <ColourField
        label="Colour"
        value={String(settings.colour)}
        onChange={(colour) => onChange({ colour })}
        isDisabled={isDisabled}
      />
      <Switch
        label="Repeat across the image"
        value={isTile}
        onChange={(tile) => onChange({ tile })}
        isDisabled={isDisabled}
      />
      <PositionField
        label="Position"
        value={String(settings.position)}
        onChange={(position) => onChange({ position })}
        isDisabled={isDisabled || isTile}
        hint={isTile ? 'Repeated text covers the whole image.' : undefined}
      />
      <MoreOptions>
        <Selector
          label="Font"
          value={String(settings.font)}
          onChange={(font) => onChange({ font })}
          options={[
            { value: 'sans-serif', label: 'Sans serif' },
            { value: 'serif', label: 'Serif' },
            { value: 'monospace', label: 'Monospace' },
          ]}
          isDisabled={isDisabled}
        />
        <Switch
          label="Bold"
          value={settings.bold === true}
          onChange={(bold) => onChange({ bold })}
          isDisabled={isDisabled}
        />
        <Percent
          label="Margin"
          description="Space from the edge, in percent of the shorter edge."
          max={50}
          value={settings.margin}
          onChange={(margin) => onChange({ margin })}
          isDisabled={isDisabled || isTile}
          disabledMessage="Repeated text has no margin."
        />
        <Slider
          label="Angle"
          min={-90}
          max={90}
          value={Number(settings.angle)}
          valueDisplay="text"
          formatValue={(angle) => `${angle}°`}
          onChange={(angle: number) => onChange({ angle })}
          isDisabled={isDisabled || !isTile}
          disabledMessage="Only repeated text is turned."
        />
      </MoreOptions>
    </VStack>
  )
}

function LogoField({ settings, onChange, isDisabled }: EditorProps) {
  const logo = settings.logo as Logo | null
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setLoading] = useState(false)
  if (logo) {
    return (
      <Field label="Logo">
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Text type="body" maxLines={1}>
            {`${logo.name} · ${logo.width} × ${logo.height}`}
          </Text>
          <Button
            label="Remove"
            size="sm"
            variant="ghost"
            onClick={() => onChange({ logo: null })}
            isDisabled={isDisabled}
          />
        </HStack>
      </Field>
    )
  }
  return (
    <FileInput
      label="Logo"
      description="PNG, WebP or SVG. It is kept in the pipeline, so it travels with saved and exported pipelines."
      mode="dropzone"
      accept={LOGO_ACCEPT}
      maxSize={MAX_LOGO_BYTES}
      value={null}
      isLoading={isLoading}
      onChange={async (file) => {
        if (!file || Array.isArray(file)) return
        setError(null)
        setLoading(true)
        try {
          onChange({ logo: await readLogo(file) })
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : 'This logo could not be read.')
        } finally {
          setLoading(false)
        }
      }}
      status={error ? { type: 'error', message: error } : undefined}
      isDisabled={isDisabled}
    />
  )
}

const ImageWatermarkEditor: Editor = (props) => {
  const { settings, onChange, isDisabled } = props
  return (
    <VStack gap={4}>
      <LogoField {...props} />
      <Percent
        label="Size"
        description="Logo width in percent of the image width."
        min={1}
        value={settings.scale}
        onChange={(scale) => onChange({ scale })}
        isDisabled={isDisabled}
      />
      <Percent
        label="Opacity"
        value={settings.opacity}
        onChange={(opacity) => onChange({ opacity })}
        isDisabled={isDisabled}
      />
      <PositionField
        label="Position"
        value={String(settings.position)}
        onChange={(position) => onChange({ position })}
        isDisabled={isDisabled}
      />
      <MoreOptions>
        <Percent
          label="Margin"
          description="Space from the edge, in percent of the shorter edge."
          max={50}
          value={settings.margin}
          onChange={(margin) => onChange({ margin })}
          isDisabled={isDisabled}
        />
      </MoreOptions>
    </VStack>
  )
}

const BorderEditor: Editor = ({ settings, onChange, isDisabled }) => {
  const units = settings.unit === 'pixels' ? 'px' : '%'
  return (
    <VStack gap={4}>
      <Choice
        label="Measure in"
        value={settings.unit}
        options={[
          { value: 'percent', label: 'Percent' },
          { value: 'pixels', label: 'Pixels' },
        ]}
        onChange={(unit) => onChange({ unit })}
        isDisabled={isDisabled}
        hint={
          settings.unit === 'pixels'
            ? 'The same size on every image.'
            : 'Percent of each image’s shorter edge, so mixed sizes look alike.'
        }
      />
      <NumberInput
        label="Border"
        units={units}
        min={0}
        max={1000}
        width={160}
        value={Number(settings.border)}
        onChange={(border) => onChange({ border })}
        isDisabled={isDisabled}
      />
      <ColourField
        label="Border colour"
        value={String(settings.borderColour)}
        onChange={(borderColour) => onChange({ borderColour })}
        isDisabled={isDisabled || Number(settings.border) === 0}
        disabledMessage="Set a border width first."
      />
      <NumberInput
        label="Corner radius"
        units={units}
        min={0}
        max={1000}
        width={160}
        value={Number(settings.radius)}
        onChange={(radius) => onChange({ radius })}
        isDisabled={isDisabled}
      />
      <Choice
        label="Outside the corners"
        value={settings.corners}
        options={[
          { value: 'transparent', label: 'Transparent' },
          { value: 'colour', label: 'Colour' },
        ]}
        onChange={(corners) => onChange({ corners })}
        isDisabled={isDisabled || Number(settings.radius) === 0}
        disabledMessage="Set a corner radius first."
        hint="Transparency needs PNG, WebP, AVIF or JPEG XL; JPEG shows the colour underneath."
      />
      <ColourField
        label="Corner colour"
        value={String(settings.cornerColour)}
        onChange={(cornerColour) => onChange({ cornerColour })}
        isDisabled={isDisabled || settings.corners !== 'colour' || Number(settings.radius) === 0}
        disabledMessage="Choose Colour outside the corners."
      />
    </VStack>
  )
}

const SetCopyrightEditor: Editor = ({ settings, onChange, isDisabled }) => (
  <VStack gap={4}>
    <TextInput
      label="Author"
      value={String(settings.artist)}
      onChange={(artist) => onChange({ artist })}
      isDisabled={isDisabled}
    />
    <TextInput
      label="Copyright"
      placeholder="© 2026 Your name"
      value={String(settings.copyright)}
      onChange={(copyright) => onChange({ copyright })}
      isDisabled={isDisabled}
    />
    <Text type="supporting">
      Written into the EXIF fields without re-encoding. Empty fields leave what the file has. AVIF
      and QOI cannot take new fields.
    </Text>
  </VStack>
)

const BestFormatEditor: Editor = ({ settings, onChange, isDisabled }) => {
  const formats = settings.formats as string[]
  return (
    <VStack gap={4}>
      <Field label="Try" hint="Each format is encoded once; the smallest file is kept.">
        <HStack gap={2} wrap="wrap">
          {CANDIDATE_FORMATS.map((format) => (
            <Switch
              key={format}
              size="sm"
              label={formatLabel(format)}
              value={formats.includes(format)}
              onChange={(on) => {
                const next = on ? [...formats, format] : formats.filter((entry) => entry !== format)
                if (next.length > 0) onChange({ formats: next })
              }}
              isDisabled={isDisabled}
            />
          ))}
        </HStack>
      </Field>
      <Slider
        label="Quality"
        description="For the lossy formats. PNG is always lossless."
        min={1}
        max={100}
        value={Number(settings.quality)}
        valueDisplay="text"
        onChange={(quality: number) => onChange({ quality })}
        isDisabled={isDisabled}
      />
      <Switch
        label="Keep the original when nothing is smaller"
        value={settings.keepOriginal === true}
        onChange={(keepOriginal) => onChange({ keepOriginal })}
        isDisabled={isDisabled}
      />
    </VStack>
  )
}

/** Widths as a comma-separated list, kept as typed until it reads as valid widths. */
function WidthsField({ settings, onChange, isDisabled }: EditorProps) {
  const widths = settings.widths as number[]
  const [text, setText] = useState(widths.join(', '))
  useEffect(() => setText(widths.join(', ')), [widths])
  const parse = (value: string) => {
    const parts = value.split(/[\s,]+/).filter(Boolean)
    const numbers = parts.map(Number)
    const valid =
      parts.length > 0 &&
      parts.length <= 12 &&
      numbers.every((n) => Number.isInteger(n) && n >= 16 && n <= MAX_RESIZE_DIMENSION)
    return valid ? numbers : null
  }
  return (
    <TextInput
      label="Widths"
      description="In pixels, separated by commas. Widths larger than an image become its own width."
      value={text}
      onChange={(value) => {
        setText(value)
        const parsed = parse(value)
        if (parsed) onChange({ widths: parsed })
      }}
      status={
        parse(text)
          ? undefined
          : { type: 'error', message: `Use 1 to 12 widths from 16 to ${MAX_RESIZE_DIMENSION}.` }
      }
      isDisabled={isDisabled}
    />
  )
}

const ResponsiveSetEditor: Editor = (props) => {
  const { settings, onChange, isDisabled } = props
  return (
    <VStack gap={4}>
      <WidthsField {...props} />
      <Selector
        label="Format"
        value={String(settings.format)}
        onChange={(format) => onChange({ format })}
        options={[
          { value: 'original', label: 'Same as input' },
          ...['webp', 'avif', 'jpeg', 'png'].map((format) => ({
            value: format,
            label: formatLabel(format),
          })),
        ]}
        isDisabled={isDisabled}
      />
      <Slider
        label="Quality"
        min={1}
        max={100}
        value={Number(settings.quality)}
        valueDisplay="text"
        onChange={(quality: number) => onChange({ quality })}
        isDisabled={isDisabled || settings.format === 'png'}
        disabledMessage="PNG is lossless."
      />
      <TextInput
        label="Sizes"
        description="How wide the image shows, for the sizes attribute."
        value={String(settings.sizes)}
        onChange={(sizes) => onChange({ sizes })}
        isDisabled={isDisabled}
      />
      <TextInput
        label="Path"
        description="Put before each file name in the snippet, such as /images/."
        value={String(settings.path)}
        onChange={(path) => onChange({ path })}
        isDisabled={isDisabled}
      />
    </VStack>
  )
}

const FaviconEditor: Editor = ({ settings, onChange, isDisabled }) => (
  <VStack gap={4}>
    <Choice
      label="Non-square images"
      value={settings.fit}
      options={[
        { value: 'contain', label: 'Fit inside' },
        { value: 'cover', label: 'Fill and crop' },
      ]}
      onChange={(fit) => onChange({ fit })}
      isDisabled={isDisabled}
    />
    <Percent
      label="Padding"
      max={30}
      value={settings.padding}
      onChange={(padding) => onChange({ padding })}
      isDisabled={isDisabled}
    />
    <ColourField
      label="Background"
      value={String(settings.background)}
      onChange={(background) => onChange({ background })}
      isDisabled={isDisabled}
    />
    <Text type="supporting">
      The background fills the Apple and maskable icons, which cannot be transparent.
    </Text>
    <MoreOptions>
      <TextInput
        label="App name"
        description="For the web app manifest. The image's name when empty."
        value={String(settings.name)}
        onChange={(name) => onChange({ name })}
        isDisabled={isDisabled}
      />
      <ColourField
        label="Theme colour"
        value={String(settings.themeColour)}
        onChange={(themeColour) => onChange({ themeColour })}
        isDisabled={isDisabled}
      />
      <TextInput
        label="Path"
        description="Where the icons live on the site, such as /icons/."
        value={String(settings.path)}
        onChange={(path) => onChange({ path })}
        isDisabled={isDisabled}
      />
    </MoreOptions>
  </VStack>
)

const PlaceholderEditor: Editor = ({ settings, onChange, isDisabled }) => {
  const isBlurhash = settings.method === 'blurhash'
  return (
    <VStack gap={4}>
      <Choice
        label="Code"
        value={settings.method}
        options={[
          { value: 'data-uri', label: 'Data URI' },
          { value: 'blurhash', label: 'BlurHash' },
        ]}
        onChange={(method) => onChange({ method })}
        isDisabled={isDisabled}
        hint={
          isBlurhash
            ? 'A short string; the site needs a BlurHash decoder to show it.'
            : 'A tiny WebP that works in any img tag or CSS background.'
        }
      />
      <Slider
        label="Size"
        min={4}
        max={64}
        value={Number(settings.size)}
        valueDisplay="text"
        formatValue={(size) => `${size} px`}
        onChange={(size: number) => onChange({ size })}
        isDisabled={isDisabled || isBlurhash}
        disabledMessage="BlurHash sets its detail with components."
      />
      <HStack gap={2}>
        {(['componentsX', 'componentsY'] as const).map((key) => (
          <NumberInput
            key={key}
            label={key === 'componentsX' ? 'Across' : 'Down'}
            min={1}
            max={9}
            isIntegerOnly
            width={120}
            value={Number(settings[key])}
            onChange={(value) => onChange({ [key]: value })}
            isDisabled={isDisabled || !isBlurhash}
            disabledMessage="Only BlurHash has components."
          />
        ))}
      </HStack>
    </VStack>
  )
}

const PaletteEditor: Editor = ({ settings, onChange, isDisabled }) => (
  <VStack gap={4}>
    <Slider
      label="Colours"
      min={1}
      max={16}
      value={Number(settings.count)}
      valueDisplay="text"
      onChange={(count: number) => onChange({ count })}
      isDisabled={isDisabled}
    />
    <Choice
      label="Save as"
      value={settings.format}
      options={[
        { value: 'json', label: 'JSON' },
        { value: 'css', label: 'CSS variables' },
      ]}
      onChange={(format) => onChange({ format })}
      isDisabled={isDisabled}
    />
  </VStack>
)

const ContactSheetEditor: Editor = ({ settings, onChange, isDisabled }) => (
  <VStack gap={4}>
    <HStack gap={2} wrap="wrap">
      <NumberInput
        label="Columns"
        min={1}
        max={20}
        isIntegerOnly
        width={120}
        value={Number(settings.columns)}
        onChange={(columns) => onChange({ columns })}
        isDisabled={isDisabled}
      />
      <NumberInput
        label="Cell size"
        units="px"
        min={16}
        max={1024}
        isIntegerOnly
        width={140}
        value={Number(settings.cell)}
        onChange={(cell) => onChange({ cell })}
        isDisabled={isDisabled}
      />
    </HStack>
    <Choice
      label="Images"
      value={settings.fit}
      options={[
        { value: 'contain', label: 'Fit inside' },
        { value: 'cover', label: 'Fill and crop' },
      ]}
      onChange={(fit) => onChange({ fit })}
      isDisabled={isDisabled}
    />
    <Switch
      label="File names under the images"
      value={settings.labels === true}
      onChange={(labels) => onChange({ labels })}
      isDisabled={isDisabled}
    />
    <Selector
      label="Format"
      value={String(settings.format)}
      onChange={(format) => onChange({ format })}
      options={['jpeg', 'png', 'webp'].map((format) => ({
        value: format,
        label: formatLabel(format),
      }))}
      isDisabled={isDisabled}
    />
    <TextInput
      label="Name"
      value={String(settings.name)}
      onChange={(name) => onChange({ name })}
      isDisabled={isDisabled}
    />
    <MoreOptions>
      <NumberInput
        label="Gap"
        units="px"
        min={0}
        max={200}
        isIntegerOnly
        width={140}
        value={Number(settings.gap)}
        onChange={(gap) => onChange({ gap })}
        isDisabled={isDisabled}
      />
      <ColourField
        label="Background"
        value={String(settings.background)}
        onChange={(background) => onChange({ background })}
        isDisabled={isDisabled}
      />
      <NumberInput
        label="Rows per sheet"
        description="0 fills each sheet as far as its size limit allows."
        min={0}
        max={1000}
        isIntegerOnly
        width={140}
        value={Number(settings.rows)}
        onChange={(rows) => onChange({ rows })}
        isDisabled={isDisabled}
      />
    </MoreOptions>
    <Text type="supporting">Waits for every image, then makes one sheet or more.</Text>
  </VStack>
)

const ImagesToPdfEditor: Editor = ({ settings, onChange, isDisabled }) => {
  const isImageSize = settings.pageSize === 'image'
  return (
    <VStack gap={4}>
      <Selector
        label="Page size"
        value={String(settings.pageSize)}
        onChange={(pageSize) => onChange({ pageSize })}
        options={[
          { value: 'a4', label: 'A4' },
          { value: 'letter', label: 'Letter' },
          { value: 'image', label: 'The size of each image' },
        ]}
        isDisabled={isDisabled}
      />
      <Choice
        label="Orientation"
        value={settings.orientation}
        options={[
          { value: 'auto', label: 'Auto' },
          { value: 'portrait', label: 'Portrait' },
          { value: 'landscape', label: 'Landscape' },
        ]}
        onChange={(orientation) => onChange({ orientation })}
        isDisabled={isDisabled || isImageSize}
        disabledMessage="Pages take each image's shape."
        hint="Auto turns pages sideways for wide images."
      />
      <NumberInput
        label="Margin"
        units="mm"
        min={0}
        max={50}
        width={140}
        value={Number(settings.margin)}
        onChange={(margin) => onChange({ margin })}
        isDisabled={isDisabled}
      />
      <Choice
        label="Images"
        value={settings.compression}
        options={[
          { value: 'jpeg', label: 'JPEG' },
          { value: 'lossless', label: 'Lossless' },
        ]}
        onChange={(compression) => onChange({ compression })}
        isDisabled={isDisabled}
        hint="JPEG files always go in as they are. Lossless keeps other images exact but larger."
      />
      <Slider
        label="Quality"
        min={1}
        max={100}
        value={Number(settings.quality)}
        valueDisplay="text"
        onChange={(quality: number) => onChange({ quality })}
        isDisabled={isDisabled || settings.compression === 'lossless'}
        disabledMessage="Lossless images have no quality setting."
      />
      <TextInput
        label="Name"
        value={String(settings.name)}
        onChange={(name) => onChange({ name })}
        isDisabled={isDisabled}
      />
    </VStack>
  )
}

/** Settings forms for node batches 2 and 3, by node type. */
export const LATER_EDITORS: Record<string, Editor> = {
  deduplicate: DeduplicateEditor,
  'auto-trim': AutoTrimEditor,
  pad: PadEditor,
  'pixel-art': PixelArtEditor,
  split: SplitEditor,
  adjust: AdjustEditor,
  filters: FiltersEditor,
  'sharpen-blur': SharpenBlurEditor,
  background: BackgroundEditor,
  'text-watermark': TextWatermarkEditor,
  'image-watermark': ImageWatermarkEditor,
  border: BorderEditor,
  'set-copyright': SetCopyrightEditor,
  'best-format': BestFormatEditor,
  'responsive-set': ResponsiveSetEditor,
  favicon: FaviconEditor,
  placeholder: PlaceholderEditor,
  palette: PaletteEditor,
  'contact-sheet': ContactSheetEditor,
  'images-to-pdf': ImagesToPdfEditor,
}
