# A service worker keeps the app working offline

After one online visit, Hexlode opens and runs without a connection. One service worker at
`/sw.js` does this, registered in production builds only. A Vite plugin
(`src/features/offline/build-plugin.ts`) lists every file of the client build and of `public/` once
the bundle is complete, leaves out source maps and share cards, and bundles the worker
(`src/features/offline/service-worker.ts`) into one classic script with that list and a version
written in. The version is a hash of every listed file's path and contents, so any changed file
changes the worker's bytes and the browser installs the new worker on the next online visit.

On install the worker downloads every listed file into `hexlode-app-<version>`, codecs the visitor
has not used included, and the main pages into `hexlode-pages-<version>`: the home page, the quick
tools, the Studio, the privacy page and the app shell. It then takes over at once and deletes the
two caches of earlier versions. It never deletes another cache, such as the on-device model's.

Page loads go to the network first, and the worker keeps a copy of each page that loads only this
build's scripts. Offline it returns that copy, the same page with another query, or the app shell:
`/app-shell`, a route with server rendering turned off, so the server renders the root route alone
and the router renders the requested page in the browser. Build files come from the cache. The
worker answers nothing else, so `/api/` (health and auth), `/models/`, server functions, the Sentry
tunnel, PostHog and every other origin reach the network untouched.

## Considered options

- **Workbox or vite-plugin-pwa.** Mature, but a new dependency for a worker of a hundred lines,
  and both expect a static `index.html` to fall back to. Hexlode renders every page on the server
  with its deployment's settings (ADR 0008).
- **TanStack Start's SPA mode for the shell**, which prerenders `/_shell.html` during the build.
  Nitro lists its static files before the prerender runs, so the server answered 404 for the shell;
  in the dev server the option renders every page as the shell; and the shell carried the build's
  settings instead of the deployment's. A route without server rendering gives the same page,
  rendered on each request.
- **Cache first for pages.** Faster, but a deploy would show only on the second load. Network first
  shows a new deploy on the next online load.
- **Waiting for every tab to close before a new worker takes over**, the default. An installed app
  left open for days would keep its old worker. Pages load from the network first either way, so
  taking over at once strands no page on an old build.

## Consequences

- The first visit downloads about 20 MB in the background, 16 MB of it codec WebAssembly, including
  multi-threaded and SIMD variants a browser may never use.
- `pnpm dev` and the Vitest suites never register a worker. `pnpm test:e2e` checks the production
  build offline.
- A page served by a newer deploy than the active worker is not kept, because its scripts are not
  in the worker's cache. Offline, the earlier copy opens instead.
- A tab left open across a deploy can fail to load a part of the app it has not loaded yet, as it
  could without a worker, because the new worker deletes the old build's files.
- The privacy page says what the copy holds and how to remove it.
