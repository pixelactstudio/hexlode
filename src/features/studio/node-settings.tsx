import { Button } from '@astryxdesign/core/Button'
import { Collapsible } from '@astryxdesign/core/Collapsible'
import { IconButton } from '@astryxdesign/core/IconButton'
import { NumberInput } from '@astryxdesign/core/NumberInput'
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl'
import { Selector } from '@astryxdesign/core/Selector'
import { Slider } from '@astryxdesign/core/Slider'
import { HStack, VStack } from '@astryxdesign/core/Stack'
import { Switch } from '@astryxdesign/core/Switch'
import { Text } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import { Trash2 } from 'lucide-react'

import type { AnyNodeDefinition } from '#/features/engine/types'
import { canPickFolder } from '#/features/image-input/folder'
import type { FilterRule } from '#/features/nodes/definitions/filter'
import { RENAME_TOKENS } from '#/features/nodes/definitions/rename'
import { Field, FORMAT_OPTIONS, SettingsPanel } from '#/features/quick-tools/settings-panels'

type Settings = Record<string, unknown>

interface EditorProps {
  settings: Settings
  onChange: (changes: Settings) => void
  isDisabled?: boolean
}

/** Options most people never change, closed until opened. */
function MoreOptions({ children }: { children: React.ReactNode }) {
  return (
    <Collapsible
      defaultIsOpen={false}
      trigger={
        <Text type="label" color="secondary">
          More options
        </Text>
      }
    >
      <VStack gap={4} paddingBlock={2}>
        {children}
      </VStack>
    </Collapsible>
  )
}

function ConvertEditor({ settings, onChange, isDisabled }: EditorProps) {
  const format = settings.format as string
  const options = (settings[format] ?? {}) as Settings
  const setOption = (key: string, value: unknown) =>
    onChange({ [format]: { ...options, [key]: value } })
  const quality = (
    <Slider
      label="Quality"
      min={1}
      max={100}
      value={Number(options.quality)}
      valueDisplay="text"
      onChange={(value: number) => setOption('quality', value)}
      isDisabled={isDisabled || options.lossless === true}
    />
  )
  const lossless = (
    <Switch
      label="Lossless"
      value={options.lossless === true}
      onChange={(value) => setOption('lossless', value)}
      isDisabled={isDisabled}
    />
  )
  const effort = (max: number, min = 0) => (
    <Slider
      label="Effort"
      description="Higher effort makes smaller files and takes longer."
      min={min}
      max={max}
      value={Number(options.effort)}
      valueDisplay="text"
      onChange={(value: number) => setOption('effort', value)}
      isDisabled={isDisabled}
    />
  )
  const subsampling = (
    <Field label="Colour detail">
      <SegmentedControl
        label="Colour detail"
        value={String(options.chromaSubsampling)}
        onChange={(value) => setOption('chromaSubsampling', value)}
        isDisabled={isDisabled}
      >
        <SegmentedControlItem value="420" label="Smaller files" />
        <SegmentedControlItem value="444" label="Full colour" />
      </SegmentedControl>
    </Field>
  )
  return (
    <VStack gap={4}>
      <Selector
        label="Format"
        value={format}
        onChange={(value) => onChange({ format: value })}
        options={[{ value: 'original', label: 'Same as input' }, ...FORMAT_OPTIONS]}
        isDisabled={isDisabled}
      />
      {format === 'original' ? (
        <Switch
          label="Keep the original when encoding does not make it smaller"
          value={settings.keepSmaller === true}
          onChange={(value) => onChange({ keepSmaller: value })}
          isDisabled={isDisabled}
        />
      ) : null}
      {format === 'jpeg' ? (
        <>
          {quality}
          <MoreOptions>
            <Switch
              label="Progressive"
              value={options.progressive === true}
              onChange={(value) => setOption('progressive', value)}
              isDisabled={isDisabled}
            />
            {subsampling}
          </MoreOptions>
        </>
      ) : null}
      {format === 'webp' ? (
        <>
          {quality}
          {lossless}
          <MoreOptions>
            {effort(6)}
            <Switch
              label="Sharp colour conversion"
              value={options.sharpYuv === true}
              onChange={(value) => setOption('sharpYuv', value)}
              isDisabled={isDisabled}
            />
          </MoreOptions>
        </>
      ) : null}
      {format === 'avif' ? (
        <>
          {quality}
          {lossless}
          <MoreOptions>
            {effort(10)}
            {subsampling}
          </MoreOptions>
        </>
      ) : null}
      {format === 'jxl' ? (
        <>
          {quality}
          {lossless}
          <MoreOptions>
            {effort(9, 1)}
            <Switch
              label="Progressive"
              value={options.progressive === true}
              onChange={(value) => setOption('progressive', value)}
              isDisabled={isDisabled}
            />
          </MoreOptions>
        </>
      ) : null}
      {format === 'png' ? (
        <Slider
          label="Optimisation level"
          min={0}
          max={6}
          value={Number(options.optimisationLevel)}
          valueDisplay="text"
          onChange={(value: number) => setOption('optimisationLevel', value)}
          isDisabled={isDisabled}
        />
      ) : null}
      {format === 'qoi' ? <Text type="supporting">QOI has no settings.</Text> : null}
    </VStack>
  )
}

const RULE_FIELDS = [
  { value: 'format', label: 'Format' },
  { value: 'fileSize', label: 'File size' },
  { value: 'width', label: 'Width' },
  { value: 'height', label: 'Height' },
  { value: 'longestEdge', label: 'Longest edge' },
  { value: 'orientation', label: 'Orientation' },
  { value: 'transparency', label: 'Transparency' },
]

function newRule(field: string, id: string): FilterRule {
  switch (field) {
    case 'format':
      return { id, field, operator: 'is', formats: ['png'] }
    case 'fileSize':
      return { id, field, operator: 'more', kilobytes: 500 }
    case 'orientation':
      return { id, field, operator: 'is', orientation: 'landscape' }
    case 'transparency':
      return { id, field, operator: 'has' }
    default:
      return { id, field: field as 'width', operator: 'more', pixels: 2000 }
  }
}

function RuleEditor({
  rule,
  onChange,
  onRemove,
  isDisabled,
}: {
  rule: FilterRule
  onChange: (rule: FilterRule) => void
  onRemove: () => void
  isDisabled?: boolean
}) {
  const compare = (
    <Selector
      label="Comparison"
      isLabelHidden
      value={rule.operator}
      onChange={(operator) => onChange({ ...rule, operator } as FilterRule)}
      options={[
        { value: 'less', label: 'is less than' },
        { value: 'more', label: 'is more than' },
      ]}
      isDisabled={isDisabled}
    />
  )
  return (
    <VStack gap={2}>
      <HStack gap={2} vAlign="end">
        <Selector
          label="Rule"
          value={rule.field}
          onChange={(field) => onChange(newRule(field, rule.id))}
          options={RULE_FIELDS}
          isDisabled={isDisabled}
          width="100%"
        />
        <IconButton
          label="Remove rule"
          icon={<Trash2 size={16} />}
          variant="ghost"
          onClick={onRemove}
          isDisabled={isDisabled}
        />
      </HStack>
      {rule.field === 'format' ? (
        <>
          <Selector
            label="Match"
            isLabelHidden
            value={rule.operator}
            onChange={(operator) => onChange({ ...rule, operator: operator as 'is' })}
            options={[
              { value: 'is', label: 'is one of' },
              { value: 'isNot', label: 'is none of' },
            ]}
            isDisabled={isDisabled}
          />
          <HStack gap={2} wrap="wrap">
            {FORMAT_OPTIONS.map((option) => (
              <Switch
                key={option.value}
                size="sm"
                label={option.label}
                value={rule.formats.includes(option.value)}
                onChange={(on) => {
                  const formats = on
                    ? [...rule.formats, option.value]
                    : rule.formats.filter((format) => format !== option.value)
                  if (formats.length > 0) onChange({ ...rule, formats })
                }}
                isDisabled={isDisabled}
              />
            ))}
          </HStack>
        </>
      ) : null}
      {rule.field === 'fileSize' ? (
        <HStack gap={2}>
          {compare}
          <NumberInput
            label="Size"
            isLabelHidden
            units="KB"
            min={0}
            value={rule.kilobytes}
            onChange={(kilobytes) => onChange({ ...rule, kilobytes })}
            isDisabled={isDisabled}
          />
        </HStack>
      ) : null}
      {rule.field === 'width' || rule.field === 'height' || rule.field === 'longestEdge' ? (
        <HStack gap={2}>
          {compare}
          <NumberInput
            label="Pixels"
            isLabelHidden
            units="px"
            min={0}
            isIntegerOnly
            value={rule.pixels}
            onChange={(pixels) => onChange({ ...rule, pixels })}
            isDisabled={isDisabled}
          />
        </HStack>
      ) : null}
      {rule.field === 'orientation' ? (
        <SegmentedControl
          label="Orientation"
          value={rule.orientation}
          onChange={(orientation) => onChange({ ...rule, orientation: orientation as 'landscape' })}
          isDisabled={isDisabled}
        >
          <SegmentedControlItem value="landscape" label="Landscape" />
          <SegmentedControlItem value="portrait" label="Portrait" />
          <SegmentedControlItem value="square" label="Square" />
        </SegmentedControl>
      ) : null}
      {rule.field === 'transparency' ? (
        <SegmentedControl
          label="Transparency"
          value={rule.operator}
          onChange={(operator) => onChange({ ...rule, operator: operator as 'has' })}
          isDisabled={isDisabled}
        >
          <SegmentedControlItem value="has" label="Has transparency" />
          <SegmentedControlItem value="hasNot" label="Fully opaque" />
        </SegmentedControl>
      ) : null}
    </VStack>
  )
}

function FilterEditor({ settings, onChange, isDisabled }: EditorProps) {
  const rules = settings.rules as FilterRule[]
  const nextId = () => {
    let index = rules.length + 1
    while (rules.some((rule) => rule.id === `rule-${index}`)) index += 1
    return `rule-${index}`
  }
  return (
    <VStack gap={4}>
      <Text type="supporting">
        Each item leaves by the first rule it matches. Items that match none leave by Everything
        else.
      </Text>
      {rules.map((rule, index) => (
        <RuleEditor
          key={rule.id}
          rule={rule}
          isDisabled={isDisabled}
          onChange={(next) =>
            onChange({ rules: rules.map((candidate, i) => (i === index ? next : candidate)) })
          }
          onRemove={() => onChange({ rules: rules.filter((_, i) => i !== index) })}
        />
      ))}
      <HStack>
        <Button
          label="Add rule"
          size="sm"
          onClick={() => onChange({ rules: [...rules, newRule('format', nextId())] })}
          isDisabled={isDisabled || rules.length >= 12}
        />
      </HStack>
    </VStack>
  )
}

function CompressEditor({ settings, onChange, isDisabled }: EditorProps) {
  return (
    <VStack gap={4}>
      <NumberInput
        label="Target size"
        units="KB"
        min={1}
        width={160}
        value={Number(settings.targetKilobytes)}
        onChange={(targetKilobytes) => onChange({ targetKilobytes })}
        isDisabled={isDisabled}
      />
      <Selector
        label="Format"
        description="Same as input works for JPEG, WebP, AVIF and JPEG XL. Other formats skip this node."
        value={String(settings.format)}
        onChange={(format) => onChange({ format })}
        options={[
          { value: 'original', label: 'Same as input' },
          { value: 'jpeg', label: 'JPEG' },
          { value: 'webp', label: 'WebP' },
          { value: 'avif', label: 'AVIF' },
          { value: 'jxl', label: 'JPEG XL' },
        ]}
        isDisabled={isDisabled}
      />
    </VStack>
  )
}

function OptimizeEditor({ settings, onChange, isDisabled }: EditorProps) {
  return (
    <VStack gap={4}>
      <Slider
        label="Level"
        description="Higher levels try harder and take longer."
        min={0}
        max={6}
        value={Number(settings.level)}
        valueDisplay="text"
        onChange={(level: number) => onChange({ level })}
        isDisabled={isDisabled}
      />
      <Switch
        label="Interlace"
        description="Loads progressively on the web. Usually larger."
        value={settings.interlace === true}
        onChange={(interlace) => onChange({ interlace })}
        isDisabled={isDisabled}
      />
    </VStack>
  )
}

function RenameEditor({ settings, onChange, isDisabled }: EditorProps) {
  return (
    <VStack gap={4}>
      <TextInput
        label="Name template"
        description={`Use ${RENAME_TOKENS.join(', ')}. The extension follows the format. Output numbers duplicate names.`}
        value={String(settings.template)}
        onChange={(template) => onChange({ template })}
        isDisabled={isDisabled}
      />
      <Switch
        label="Lowercase"
        value={settings.lowercase === true}
        onChange={(lowercase) => onChange({ lowercase })}
        isDisabled={isDisabled}
      />
      <Switch
        label="Replace spaces with dashes"
        value={settings.replaceSpaces === true}
        onChange={(replaceSpaces) => onChange({ replaceSpaces })}
        isDisabled={isDisabled}
      />
    </VStack>
  )
}

function OutputEditor({ settings, onChange, isDisabled }: EditorProps) {
  const folders = canPickFolder()
  const isFolder = settings.destination === 'folder'
  return (
    <VStack gap={4}>
      <Field
        label="Deliver as"
        hint={
          isFolder
            ? 'You choose the folder when the run starts.'
            : folders
              ? undefined
              : 'This browser cannot save to a folder, so results come as a ZIP.'
        }
      >
        <SegmentedControl
          label="Deliver as"
          value={String(settings.destination)}
          onChange={(destination) => onChange({ destination })}
          isDisabled={isDisabled}
        >
          <SegmentedControlItem value="zip" label="ZIP" />
          <SegmentedControlItem value="folder" label="Folder" isDisabled={!folders} />
        </SegmentedControl>
      </Field>
      {isFolder ? null : (
        <>
          <TextInput
            label="ZIP name"
            value={String(settings.archiveName)}
            onChange={(archiveName) => onChange({ archiveName })}
            isDisabled={isDisabled}
          />
          <Switch
            label="Auto-download"
            description="Downloads the ZIP as soon as it is ready."
            value={settings.autoDownload === true}
            onChange={(autoDownload) => onChange({ autoDownload })}
            isDisabled={isDisabled}
          />
        </>
      )}
    </VStack>
  )
}

/** Node types whose inspector shows a settings form. */
export const NODE_TYPES_WITH_SETTINGS = new Set([
  'convert',
  'filter',
  'resize',
  'strip-metadata',
  'crop',
  'rotate',
  'compress-to-size',
  'optimize-png',
  'rename',
  'output',
])

/** The settings form for a node, or null when it has none. */
export function NodeSettings({
  definition,
  settings,
  onChange,
  isDisabled,
}: EditorProps & { definition: AnyNodeDefinition }) {
  const props = { settings, onChange, isDisabled }
  switch (definition.type) {
    case 'convert':
      return <ConvertEditor {...props} />
    case 'filter':
      return <FilterEditor {...props} />
    case 'resize':
      return (
        <SettingsPanel
          tool="resize"
          value={settings as never}
          onChange={(value) => onChange(value as unknown as Settings)}
          isDisabled={isDisabled}
        />
      )
    case 'strip-metadata':
      return (
        <SettingsPanel
          tool="strip-metadata"
          value={settings as never}
          onChange={(value) => onChange(value as unknown as Settings)}
          isDisabled={isDisabled}
        />
      )
    case 'crop':
    case 'rotate':
      return (
        <SettingsPanel
          tool={definition.type}
          value={settings as never}
          onChange={(value) => onChange(value as unknown as Settings)}
          isDisabled={isDisabled}
        />
      )
    case 'compress-to-size':
      return <CompressEditor {...props} />
    case 'optimize-png':
      return <OptimizeEditor {...props} />
    case 'rename':
      return <RenameEditor {...props} />
    case 'output':
      return <OutputEditor {...props} />
    default:
      return null
  }
}
