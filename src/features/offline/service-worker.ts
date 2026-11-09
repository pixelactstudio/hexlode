/// <reference lib="webworker" />
/**
 * The service worker, served at `/sw.js` in production builds (ADR 0015). The build step bundles
 * this file into one classic script and writes the build's precache list into it.
 */
import type { PrecacheManifest } from '#/features/offline/worker'
import { createOfflineWorker } from '#/features/offline/worker'

declare const __HEXLODE_PRECACHE__: PrecacheManifest

const scope = self as unknown as ServiceWorkerGlobalScope

const offline = createOfflineWorker(__HEXLODE_PRECACHE__, {
  caches: scope.caches,
  fetch: (input, init) => scope.fetch(input, init),
  origin: scope.location.origin,
})

// A new build takes over as soon as it has its files, so no page keeps running an old one.
scope.addEventListener('install', (event) => {
  event.waitUntil(offline.install().then(() => scope.skipWaiting()))
})

scope.addEventListener('activate', (event) => {
  event.waitUntil(offline.activate().then(() => scope.clients.claim()))
})

scope.addEventListener('fetch', (event) => {
  const response = offline.respond(event.request, (promise) => event.waitUntil(promise))
  if (response) event.respondWith(response)
})
