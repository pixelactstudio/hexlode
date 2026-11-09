/**
 * Registers the service worker that keeps Hexlode working offline (ADR 0015). Production builds
 * only: the dev server and the test runner have no `/sw.js`, so hot reloading and tests never
 * meet a cache.
 */
import { SERVICE_WORKER_PATH } from '#/features/offline/constants'

export function registerServiceWorker() {
  if (!import.meta.env.PROD || typeof navigator === 'undefined') return
  const container = navigator.serviceWorker
  if (!container) return
  const register = () => {
    // `updateViaCache: 'none'` checks the worker past the HTTP cache on every page load, so a new
    // deploy installs on the next online visit.
    container.register(SERVICE_WORKER_PATH, { scope: '/', updateViaCache: 'none' }).catch(() => {
      // Private windows and some browsers refuse workers. The app still works online.
    })
  }
  // After the page has loaded, so the worker's downloads never compete with the first paint.
  if (document.readyState === 'complete') register()
  else window.addEventListener('load', register, { once: true })
}
