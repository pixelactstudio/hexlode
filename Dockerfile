# Hexlode: one container serving the Nitro build. See DEPLOY.md for running it on Dokploy.

# The build output is plain JavaScript and WebAssembly, so it is built once on the build machine's
# own platform and shared by every image platform.
FROM --platform=$BUILDPLATFORM node:24.17.0-slim AS build
WORKDIR /app
ENV HUSKY=0 \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    SKIP_ENV_VALIDATION=1
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
# Optional fallbacks. The server reads these from its environment at runtime, which wins.
ARG VITE_POSTHOG_KEY=""
ARG VITE_POSTHOG_HOST=""
ARG VITE_SENTRY_DSN=""
ENV VITE_POSTHOG_KEY=$VITE_POSTHOG_KEY \
    VITE_POSTHOG_HOST=$VITE_POSTHOG_HOST \
    VITE_SENTRY_DSN=$VITE_SENTRY_DSN
RUN pnpm build && chmod -R a+rX .output \
    && node -p "require('@sentry/tanstackstart-react/package.json').version" > .output/sentry-version

FROM node:24.17.0-slim AS runtime
WORKDIR /app
ARG HEXLODE_VERSION=dev
LABEL org.opencontainers.image.title="Hexlode" \
      org.opencontainers.image.description="Image pipelines that run in your browser" \
      org.opencontainers.image.source="https://github.com/pixelactstudio/hexlode" \
      org.opencontainers.image.licenses="Apache-2.0"
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    HEXLODE_VERSION=$HEXLODE_VERSION
# The server keeps Sentry outside its bundle, so it is installed next to it, at the version the
# lockfile pins. npm, corepack and yarn are removed afterwards: the server never uses them, and
# their bundled dependencies would otherwise ship, and be scanned, as part of the image.
COPY --from=build /app/.output/sentry-version /tmp/sentry-version
RUN npm install --omit=dev --no-save --no-audit --no-fund \
      "@sentry/tanstackstart-react@$(cat /tmp/sentry-version)" \
    && npm cache clean --force \
    && rm -rf /tmp/sentry-version /root/.npm \
      /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
      /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
      /opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg
COPY --from=build --chown=1000:1000 /app/.output ./.output
# The node image's unprivileged user.
USER 1000:1000
EXPOSE 3000
# Dokploy's zero-downtime updates wait for this before moving traffic to a new container.
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "--import", "./.output/server/instrument.server.mjs", ".output/server/index.mjs"]
