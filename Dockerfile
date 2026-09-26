# Hexlode: one container serving the Nitro build.

FROM node:24.17.0-slim AS build
WORKDIR /app
ENV HUSKY=0 \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    SKIP_ENV_VALIDATION=1
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
# Public client settings are compiled into the bundle. All are optional.
ARG VITE_POSTHOG_KEY=""
ARG VITE_POSTHOG_HOST=""
ARG VITE_SENTRY_DSN=""
ENV VITE_POSTHOG_KEY=$VITE_POSTHOG_KEY \
    VITE_POSTHOG_HOST=$VITE_POSTHOG_HOST \
    VITE_SENTRY_DSN=$VITE_SENTRY_DSN
RUN pnpm build && chmod -R a+rX .output

FROM node:24.17.0-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000
# The server keeps Sentry outside its bundle, so it is installed next to it.
RUN npm install --omit=dev --no-save --no-audit --no-fund @sentry/tanstackstart-react@10.69.0 \
    && npm cache clean --force
COPY --from=build --chown=node:node /app/.output ./.output
USER node
EXPOSE 3000
CMD ["node", "--import", "./.output/server/instrument.server.mjs", ".output/server/index.mjs"]
