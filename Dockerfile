# syntax=docker/dockerfile:1

FROM --platform=$BUILDPLATFORM node:24.17.0-slim AS build
WORKDIR /app
ENV HUSKY=0 PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 SKIP_ENV_VALIDATION=1
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
# With a Sentry auth token (a build secret), the build uploads source maps and removes them from the
# output. Without one it skips the upload.
ARG HEXLODE_VERSION=dev
ARG SENTRY_ORG
ARG SENTRY_PROJECT
RUN --mount=type=secret,id=SENTRY_AUTH_TOKEN,env=SENTRY_AUTH_TOKEN \
    SENTRY_RELEASE="$HEXLODE_VERSION" pnpm build && chmod -R a+rX .output
# Nitro leaves Sentry out of the server bundle, so install it on its own at the locked version.
RUN SENTRY=$(node -p "require('@sentry/tanstackstart-react/package.json').version") \
    && npm install --prefix /runtime --omit=dev --omit=optional --ignore-scripts \
      --no-package-lock --no-audit --no-fund "@sentry/tanstackstart-react@$SENTRY"

FROM gcr.io/distroless/nodejs24-debian13:nonroot
WORKDIR /app
ARG HEXLODE_VERSION=dev
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 HEXLODE_VERSION=$HEXLODE_VERSION
COPY --from=build /runtime/node_modules ./node_modules
COPY --from=build /app/.output ./.output
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD ["/nodejs/bin/node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["--import", "./.output/server/instrument.server.mjs", ".output/server/index.mjs"]
