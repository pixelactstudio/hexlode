# Deploying Hexlode on Dokploy

Hexlode runs as one Docker container. CI publishes the image to GitHub's container registry, and
Dokploy pulls it, sets its environment and serves it on your domain with HTTPS. The image never
needs rebuilding to change a setting ([ADR 0008](./docs/adr/0008-one-image-configured-at-runtime.md)).

## The image

`ghcr.io/pixelactstudio/hexlode`, for `linux/amd64` and `linux/arm64`.

| Tag | Updated |
| --- | --- |
| `latest` | On every release. Production runs this tag. |
| `1.2.3`, `1.2` | On every release: merging the Release Please pull request tags `v1.2.3`. |
| `main` | On every merge to `main`, released or not. Use it to try unreleased changes. |
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
| `VITE_SENTRY_DSN` | Sentry DSN. Turns on error reports, logs and tracing in the browser and on the server. |
| `PORT` | The port the server listens on. Defaults to `3000`; change the domain's port to match. |

The `VITE_*` values are public: they reach every visitor's browser. Never put a secret in a
variable that starts with `VITE_`. A change takes effect on the next deploy or restart. The image
sets `HEXLODE_VERSION` itself; Sentry and PostHog label reports and events with it.

The Sentry organisation, project and auth token are not runtime settings. They are only needed
where the image is built, to upload source maps; see [Readable Sentry stack traces](#readable-sentry-stack-traces).

Hexlode sends PostHog cookieless events, so in the PostHog project turn on **cookieless server
hash mode** (**Project settings → Web analytics**) and **Discard client IP data**. Without the
first, PostHog answers `200 OK` and then drops the events. PostHog also answers `200 OK` for a
wrong project key, or for a key sent to the other region's host, so check that `VITE_POSTHOG_KEY`
is the project's key and `VITE_POSTHOG_HOST` matches its region (`us` or `eu`).

PostHog records `$pageview`, `$pageleave`, clicks, heatmaps and web vitals by itself, so the Web
analytics dashboard fills in. The app's own events, such as `run_started` and `node_added`, are
under **Activity → Events**. PostHog's onboarding snippet `posthog.capture(…)` does not work in
the console, because the app does not put PostHog on `window`; open a page with
`?__posthog_debug=true` to see what PostHog sends.

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

## Deploying on every release

Merging a pull request into `main` publishes the `main` image but deploys nothing. Merging the
Release Please pull request makes a release: the `Docker image` workflow publishes `latest` and the
version tags, then calls the application's Dokploy deploy webhook, and Dokploy pulls `latest` and
redeploys. Copy the webhook from the application's
**Deployments** tab in Dokploy and save it in GitHub (**Settings → Secrets and variables →
Actions**) as the repository secret `DOKPLOY_WEBHOOK_URL`. Until it is set, the workflow publishes
the image and skips the deploy.

## Readable Sentry stack traces

The build uploads source maps to Sentry, then removes them from the image, when it has these
values. Add them in GitHub under **Settings → Secrets and variables → Actions**:

| Name | Kind | Value |
| --- | --- | --- |
| `SENTRY_AUTH_TOKEN` | Secret | An organisation token from Sentry: **Settings → Developer Settings → Organization Tokens**. |
| `SENTRY_ORG` | Variable | The organisation slug, from the Sentry address: `https://<org>.sentry.io`. |
| `SENTRY_PROJECT` | Variable | The project slug, from **Settings → Projects**. |

Without them the image builds the same and Sentry shows minified stack traces.

## Monitoring with Sentry

With `VITE_SENTRY_DSN` set, Sentry receives:

- **Errors** from the browser, server requests and server functions, with file names removed.
- **Logs**: warnings and errors the app writes to the console, with file names removed.
- **Traces** of a fifth of page loads, navigations and server requests, under **Explore → Traces**
  and **Insights**.

Browser reports go to a same-origin route the build generates, which forwards them to Sentry, so
content blockers do not drop them. Session replay stays off.

Set these up in Sentry itself:

- **Uptime monitor** (**Insights → Uptime**): check `https://your-domain/api/health` so Sentry
  alerts you when the site is down.
- **Alerts** (**Alerts → Create alert**): for example, email on every new issue, or when errors in
  an hour pass a number.

## Rolling back

Change the image on the **General** tab to an earlier `sha-…` tag and deploy. Every published tag
is listed on the package's GitHub page. Switch back to `latest` to follow releases again.

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
docker run -p 3000:3000 -e VITE_POSTHOG_KEY=phc_… -e VITE_SENTRY_DSN=https://… \
  ghcr.io/pixelactstudio/hexlode:latest
```
