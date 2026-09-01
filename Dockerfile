# syntax=docker/dockerfile:1.7
# Lattice — multi-stage Docker build. Image size budget: < 200MB.
#
# targets:
#   builder  — full toolchain, builds dist/ (client) + dist-api/ (server)
#   test     — builder + vitest run (CI uses this to verify in-docker)
#   runtime  — bare node + the built artifacts (~3MB of app)
#
# The whole app (client + API + store) is one self-contained
# process: `node server.mjs`. No platform lock-in. The app layer
# is ~3MB; the node:alpine base accounts for the rest of the
# image. For a compact shippable artifact use
#   docker save lattice:runtime | gzip > lattice.tar.gz
# (see scripts/docker-artifact.sh).

ARG NODE_VERSION=22
ARG APP_SIZE_BUDGET_MB=200

# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS builder
WORKDIR /app

# Build-time env (no prod deps needed for the build itself)
RUN apk add --no-cache git

COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

COPY tsconfig.json eslint.config.js vite.config.json* vite.config.ts vitest.config.ts ./
COPY public ./public
COPY api ./api
COPY server.mjs ./
COPY scripts ./scripts
COPY tests ./tests

RUN npm run build && node scripts/build-api.mjs

# ---------------------------------------------------------------------------
# Optional target: run the test suite inside the built image.
#   docker build --target test .
#   docker run --rm <id>   (exits non-zero on failure)
FROM builder AS test
RUN npm test

# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS runtime
WORKDIR /app
ARG APP_SIZE_BUDGET_MB=200
ENV NODE_ENV=production
ENV PORT=8888
ENV LATTICE_STORE_DIR=/data

# The server runtime is pure Node builtins (fs, http, path, zlib,
# dns, crypto) — every client dep is already bundled into dist/.
# No npm install, no node_modules: the image is just node + the
# built artifacts.
COPY server.mjs ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-api ./dist-api

# Persistent store (papers, sessions) — mount a volume here.
RUN mkdir -p /data \
  && addgroup -S lattice \
  && adduser -S lattice -G lattice \
  && chown -R lattice:lattice /app /data
USER lattice

EXPOSE 8888
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://127.0.0.1:8888/api/healthz || exit 1

CMD ["node", "server.mjs"]

# Size sanity check: the app layer (dist + dist-api) must stay tiny —
# the node base (~230MB) is fixed overhead, ours is the part we control.
RUN SIZE_MB=$(du -sm /app | cut -f1) && echo "app layer: ${SIZE_MB}MB (budget ${APP_SIZE_BUDGET_MB}MB)" \
    && if [ "$SIZE_MB" -gt "$APP_SIZE_BUDGET_MB" ]; then echo "FATAL: over budget"; exit 1; fi
