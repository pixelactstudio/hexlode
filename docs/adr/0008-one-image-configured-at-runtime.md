# One published image, configured by its environment

Hexlode ships as one Docker image on GHCR that Dokploy pulls, instead of Dokploy building the
Dockerfile on the VPS. The server reads every setting from its environment when it runs, including
the public PostHog and Sentry keys the browser needs: the root route loads them through a server
function and hands them to the page. The same image therefore runs in any deployment, a key changes
with a restart instead of a rebuild, and the VPS spends no CPU on builds next to the other apps it
hosts.

## Considered options

- **Vite build arguments** (`VITE_*` compiled into the bundle), the earlier setup. Every key change
  needed a new image, and one image could not serve two environments. Build arguments still work as
  a fallback when the environment leaves a key unset.
- **Dokploy builds from Git.** Simple, but it builds on the production server and needs the whole
  toolchain there. The Dockerfile still supports it.

## Consequences

- The keys are named `VITE_*` for compatibility with `.env.local`, although the server now reads
  them at runtime. Only public values may use these names, because they reach the browser.
- Later services, such as the database or a worker, get their settings the same way: environment
  variables on the container. A worker can run from the same image with a different command.
