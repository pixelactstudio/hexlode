/**
 * Gives every delivered file a unique, safe path. Duplicate names get a number: `photo.jpg`,
 * `photo-2.jpg`. Comparison ignores case because common file systems do.
 */
export function createNameResolver() {
  const used = new Set<string>()
  return (name: string) => {
    const segments = name
      .replaceAll('\\', '/')
      .split('/')
      .map((segment) => segment.replaceAll(/[?%*:|"<>]/g, '-').trim())
      .filter((segment) => segment && segment !== '.' && segment !== '..')
    const leaf = segments.pop() || 'hexlode-output'
    const directory = segments.length > 0 ? `${segments.join('/')}/` : ''
    const dot = leaf.lastIndexOf('.')
    const stem = dot > 0 ? leaf.slice(0, dot) : leaf
    const extension = dot > 0 ? leaf.slice(dot) : ''
    let candidate = `${directory}${stem}${extension}`
    let counter = 2
    while (used.has(candidate.toLocaleLowerCase())) {
      candidate = `${directory}${stem}-${counter}${extension}`
      counter += 1
    }
    used.add(candidate.toLocaleLowerCase())
    return candidate
  }
}
