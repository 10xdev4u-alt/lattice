# syntax=docker/dockerfile:1.7
# Lattice — multi-stage build, image size budget: < 200MB.
#
# Stage 1: build the static site + functions
# Stage 2: serve with Node, install prod deps only, drop the build chain.

ARG NODE_VERSION=20
ARG IMAGE_SIZE_BUDGET_MB=200

FROM node:${NODE_VERSION}-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.json vite.config.ts netlify.toml ./
COPY public ./public
COPY netlify ./netlify
RUN npm run build

FROM node:${NODE_VERSION}-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8888
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --no-audit --no-fund \
  && npm cache clean --force \
  && rm -rf /root/.npm
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/netlify ./netlify
COPY netlify.toml ./

# Run as a non-root user for safety
RUN addgroup -S lattice && adduser -S lattice -G lattice
USER lattice

EXPOSE 8888

# A tiny static + functions server. Netlify CLI does the heavy lifting
# in dev; in prod we serve the dist via @netlify/cli's serve.
CMD ["npx", "--yes", "netlify", "cli", "serve", "--port", "8888"]

# Image size sanity check
RUN echo "Image size budget: ${IMAGE_SIZE_BUDGET_MB}MB" && \
    du -sh /app | awk '{ if ($1+0 > '${IMAGE_SIZE_BUDGET_MB}') { print "WARN: image exceeds budget: "$1; exit 1 } else { print "OK: image size "$1" under budget" } }'
