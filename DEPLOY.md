# Deploying Hexlode on Dokploy

Hexlode runs as one Docker container. CI publishes the image to GitHub's container registry, and
Dokploy pulls it, sets its environment and serves it on your domain with HTTPS. The image never
needs rebuilding to change a setting ([ADR 0008](./docs/adr/0008-one-image-configured-at-runtime.md)).

## The image

`ghcr.io/pixelactstudio/hexlode`, for `linux/amd64` and `linux/arm64`.

| Tag | Updated |
| --- | --- |
| `latest` | On every push to `main`. |
| `1.2.3`, `1.2` | When a `v1.2.3` tag is pushed. |
| `sha-abc1234` | On every build. Use it to pin or roll back to one commit. |

The container listens on port `3000`, runs as an unprivileged user, and answers `GET /api/health`
with `{"status":"ok","version":"…"}`. Its built-in health check calls that route.

## First deployment

### 1. Let Dokploy pull the image

After the first run of the `Docker image` workflow, open the `hexlode` package on GitHub
(organisation → Packages → hexlode → Package settings) and set its visibility to **Public**. The
repository is public, so nothing private is exposed.

To keep the package private instead, create a GitHub token with the `read:packages` scope and add
it in Dokploy under **Settings → Registry** (registry `ghcr.io`, your GitHub username, the token
as password). Then choose that registry in the application's **Advanced** tab.

### 2. Create the application

In your Dokploy project: **Create Service → Application**. On the **General** tab choose the
**Docker** provider, enter `ghcr.io/pixelactstudio/hexlode:latest` as the image and save.

### 3. Set the environment

On the **Environment** tab, add what you use. Every variable is optional: without any, the app
runs with analytics and error reports off.

| Variable | What it does |
| --- | --- |
| `VITE_POSTHOG_KEY` | PostHog project key. Turns on cookieless analytics. |
| `VITE_POSTHOG_HOST` | PostHog API host, for example `https://eu.i.posthog.com`. Defaults to the US host. |
| `VITE_SENTRY_DSN` | Sentry DSN. Turns on error reports in the browser and on the server. |
| `PORT` | The port the server listens on. Defaults to `3000`; change the domain's port to match. |

The `VITE_*` values are public: they reach every visitor's browser. Never put a secret in a
variable that starts with `VITE_`. A change takes effect on the next deploy or restart.

### 4. Add the domain

On the **Domains** tab, add your host with path `/`, container port `3000`, and HTTPS on with a
Let's Encrypt certificate. HTTPS is required: browsers only allow the file storage Hexlode
processes images in (the Origin Private File System) on secure pages.

### 5. Deploy without downtime

On the **Advanced** tab, under **Swarm Settings**, set **Update Config** so the new container
starts, and passes its health check, before the old one stops:

```json
{
  "Parallelism": 1,
  "Delay": 10000000000,
  "FailureAction": "rollback",
  "Order": "start-first"
}
```

The image already has a health check. Only if you want to change its timing, set **Health
Check** (times are in nanoseconds). The image is distroless, with no shell or `curl`, so the check
runs Node directly:

```json
{
  "Test": [
    "CMD",
    "/nodejs/bin/node",
    "-e",
    "fetch('http://127.0.0.1:3000/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
  ],
  "Interval": 15000000000,
  "Timeout": 5000000000,
  "StartPeriod": 20000000000,
  "Retries": 3
}
```

Then click **Deploy**. Open `https://your-domain/api/health` to see the running version.

## Deploying on every push to `main`

The `Docker image` workflow asks Dokploy to redeploy once the new image is pushed. Give it three
secrets in GitHub (**Settings → Secrets and variables → Actions**, as repository secrets or in the
`production` environment):

| Secret | Value |
| --- | --- |
| `DOKPLOY_URL` | Your Dokploy address, for example `https://dokploy.example.com`. |
| `DOKPLOY_API_KEY` | A token from Dokploy's `/settings/profile` page, **API/CLI** section. |
| `DOKPLOY_APPLICATION_ID` | The application's ID: the last part of its address in Dokploy. |

Until they are set, the workflow publishes the image and skips the deploy.

## Rolling back

Change the image on the **General** tab to an earlier `sha-…` tag and deploy. Every published tag
is listed on the package's GitHub page. Switch back to `latest` to follow `main` again.

## Building on the server instead

Dokploy can also build the Dockerfile from the repository (the **GitHub** or **Git** provider with
the **Dockerfile** build type). It works the same, but builds on the VPS, which takes CPU and
memory from the other apps there.

## Later: database and workers

The database and accounts code is dormant for version 1
([ADR 0006](./docs/adr/0006-dormant-database-and-accounts.md)). When cloud features arrive, they use
the same image and the same kind of settings:

- **PostgreSQL:** create it in the same Dokploy project (**Create Service → Database →
  PostgreSQL**) and set `DATABASE_URL` on the Hexlode application to its **Internal Connection
  URL**, so traffic stays on the VPS.
- **Accounts:** `BETTER_AUTH_URL` (your public address), `BETTER_AUTH_SECRET` (at least 32 random
  characters) and, for Google sign-in, `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Google
  sign-in needs all four; with only some of them set, the server reports a configuration error.
- **Workers:** a background worker can be a second Dokploy application from the same image with a
  different start command, sharing the database settings.

## Running the image anywhere

```bash
docker run -p 3000:3000 -e VITE_POSTHOG_KEY=phc_… ghcr.io/pixelactstudio/hexlode:latest
```
