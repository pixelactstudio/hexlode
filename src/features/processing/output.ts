import type { OutputFormat } from '#/features/processing/types'

const OUTPUT_DETAILS = {
  jpeg: { extension: 'jpg', label: 'JPEG', mimeType: 'image/jpeg' },
  png: { extension: 'png', label: 'PNG', mimeType: 'image/png' },
  webp: { extension: 'webp', label: 'WebP', mimeType: 'image/webp' },
} as const

export function getOutputDetails(format: OutputFormat) {
  return OUTPUT_DETAILS[format]
}

export function createOutputNames(
  sourceNames: string[],
  format: OutputFormat,
  template = '{name}',
) {
  const used = new Set<string>()

  return sourceNames.map((sourceName, index) => {
    const path = sourceName.replaceAll('\\', '/').split('/')
    const leafName = path.pop() ?? sourceName
    const directory = path
      .map((segment) => segment.replaceAll(/[?%*:|"<>]/g, '-').trim())
      .filter(Boolean)
      .join('/')
    const baseName = leafName.replace(/\.[^.]+$/, '') || 'hexlode-output'
    const rendered = template
      .replaceAll('{name}', baseName)
      .replaceAll('{index}', String(index + 1).padStart(2, '0'))
      .replaceAll(/[/\\?%*:|"<>]/g, '-')
      .trim()
    const stem = rendered || 'hexlode-output'
    const extension = getOutputDetails(format).extension
    const prefix = directory ? `${directory}/` : ''
    let outputName = `${prefix}${stem}.${extension}`
    let collision = 2

    while (used.has(outputName.toLocaleLowerCase())) {
      outputName = `${prefix}${stem}-${collision}.${extension}`
      collision += 1
    }
    used.add(outputName.toLocaleLowerCase())
    return outputName
  })
}
