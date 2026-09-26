/**
 * Vitest browser commands. They run in Node, next to the browser the tests drive.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'

interface ProcessInfo {
  pid: number
  parent: number
  name: string
  rssBytes: number
}

function processes(): ProcessInfo[] {
  const pageSize = 4096
  const found: ProcessInfo[] = []
  for (const entry of readdirSync('/proc')) {
    if (!/^\d+$/.test(entry)) continue
    try {
      const stat = readFileSync(`/proc/${entry}/stat`, 'utf8')
      const name = stat.slice(stat.indexOf('(') + 1, stat.lastIndexOf(')'))
      const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ')
      found.push({
        pid: Number(entry),
        parent: Number(fields[1]),
        name,
        rssBytes: Number(fields[21]) * pageSize,
      })
    } catch {
      // The process ended while we read it.
    }
  }
  return found
}

/**
 * Resident memory of every browser process started by this test run (Linux only): the browser,
 * its renderer with the page and all workers, and helpers. Returns null elsewhere.
 */
export function browserMemory() {
  if (process.platform !== 'linux') return null
  const all = processes()
  const children = new Map<number, ProcessInfo[]>()
  for (const info of all) children.set(info.parent, [...(children.get(info.parent) ?? []), info])
  const pending = [process.pid]
  let total = 0
  let count = 0
  while (pending.length > 0) {
    const pid = pending.pop() as number
    for (const child of children.get(pid) ?? []) {
      pending.push(child.pid)
      if (/chrom/i.test(child.name)) {
        total += child.rssBytes
        count += 1
      }
    }
  }
  return { rssBytes: total, processes: count }
}

/**
 * Saves a JSON report under node_modules/.cache/hexlode-reports, outside the browser's file
 * sandbox, so long tests can leave their measurements. Vitest passes its context first.
 */
export function writeReport(_context: unknown, name: string, report: unknown) {
  const directory = `${process.cwd()}/node_modules/.cache/hexlode-reports`
  mkdirSync(directory, { recursive: true })
  const path = `${directory}/${name.replaceAll(/[^\w.-]/g, '')}.json`
  writeFileSync(path, JSON.stringify(report, null, 2))
  return path
}
