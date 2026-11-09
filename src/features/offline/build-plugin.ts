/**
 * The Vite plugin that writes `/sw.js` (ADR 0015). Once the client build is complete it lists
 * every output and public file, versions the list by their contents, and bundles the service
 * worker into one classic script with the list written in. It runs only in production builds, so
 * the dev server and the test runner never get a worker.
 */
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { build, type Plugin, type Rolldown } from 'vite'

import { SERVICE_WORKER_PATH } from '#/features/offline/constants'
import { precacheUrls } from '#/features/offline/precache'
import type { PrecacheManifest } from '#/features/offline/worker'

export interface ServiceWorkerPluginOptions {
  /** The worker's entry module. */
  entry: string
  /** Pages the worker downloads on install. */
  pages: string[]
}

function publicFiles(directory: string | false): [string, Uint8Array][] {
  if (!directory) return []
  try {
    return readdirSync(directory, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => {
        const path = join(entry.parentPath, entry.name)
        return [relative(directory, path), readFileSync(path)]
      })
  } catch {
    return []
  }
}

/** A short hash of every listed file's path and contents. */
function versionOf(urls: string[], contents: Map<string, string | Uint8Array>) {
  const hash = createHash('sha256')
  for (const url of urls) {
    hash.update(url)
    const content = contents.get(url)
    if (content !== undefined) hash.update(content)
  }
  return hash.digest('hex').slice(0, 12)
}

async function bundleWorker(entry: string, manifest: PrecacheManifest) {
  const result = (await build({
    configFile: false,
    envFile: false,
    logLevel: 'warn',
    publicDir: false,
    resolve: { tsconfigPaths: true },
    define: { __HEXLODE_PRECACHE__: JSON.stringify(manifest) },
    build: {
      write: false,
      minify: true,
      sourcemap: false,
      copyPublicDir: false,
      reportCompressedSize: false,
      lib: { entry, formats: ['iife'], name: 'hexlodeServiceWorker', fileName: () => 'sw.js' },
    },
  })) as Rolldown.RolldownOutput | Rolldown.RolldownOutput[]
  const [output] = Array.isArray(result) ? result : [result]
  const chunk = output.output.find((file) => file.type === 'chunk')
  if (!chunk || chunk.type !== 'chunk') throw new Error('The service worker did not bundle.')
  return chunk.code
}

export function serviceWorker(options: ServiceWorkerPluginOptions): Plugin {
  return {
    name: 'hexlode:service-worker',
    apply: 'build',
    generateBundle: {
      // After every other plugin has added its files, such as the codec licences.
      order: 'post',
      async handler(_options, bundle) {
        if (this.environment?.name !== 'client') return
        const contents = new Map<string, string | Uint8Array>()
        for (const [path, content] of publicFiles(this.environment.config.publicDir)) {
          contents.set(precacheUrls([path])[0] ?? path, content)
        }
        for (const output of Object.values(bundle)) {
          const url = precacheUrls([output.fileName])[0]
          if (url) contents.set(url, output.type === 'chunk' ? output.code : output.source)
        }
        const urls = precacheUrls(contents.keys())
        const manifest: PrecacheManifest = {
          version: versionOf(urls, contents),
          urls,
          pages: options.pages,
        }
        this.emitFile({
          type: 'asset',
          fileName: SERVICE_WORKER_PATH.slice(1),
          source: await bundleWorker(options.entry, manifest),
        })
      },
    },
  }
}
