# syntax=docker/dockerfile:1
# Multi-target production image for the Voltify monorepo.
# Builds:  docker build --target api .
#          docker build --target storefront .
#          docker build --target admin .

FROM node:22-alpine AS base
ENV CI=1 NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
# Install workspace dependencies (workspace manifests + lockfile only).
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/storefront/package.json apps/storefront/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/utils/package.json packages/utils/package.json
COPY packages/validation/package.json packages/validation/package.json
RUN npm ci

# Shared source for every stage.
FROM base AS deps
WORKDIR /app
COPY . .

# Compile shared TypeScript packages used at runtime by the API and apps.
FROM deps AS builder
WORKDIR /app
RUN npm run build:packages

# ---------------------------------------------------------------------------
# API (Express)
# ---------------------------------------------------------------------------
FROM node:22-alpine AS api
ENV NODE_ENV=production
ENV MEDIA_UPLOAD_DIR=/data/uploads
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api ./apps/api
RUN mkdir -p /data/uploads
EXPOSE 4000
WORKDIR /app/apps/api
CMD ["node", "src/server.js"]

# ---------------------------------------------------------------------------
# Storefront (Next.js)
# ---------------------------------------------------------------------------
FROM builder AS storefront-builder
WORKDIR /app
RUN npm run build -w @shop/storefront

FROM node:22-alpine AS storefront
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/packages ./packages
COPY --from=storefront-builder /app/apps/storefront/package.json ./apps/storefront/package.json
COPY --from=storefront-builder /app/apps/storefront/.next ./apps/storefront/.next
COPY --from=storefront-builder /app/apps/storefront/next.config.ts ./apps/storefront/next.config.ts
COPY --from=storefront-builder /app/apps/storefront/tsconfig.json ./apps/storefront/tsconfig.json
EXPOSE 3000
WORKDIR /app/apps/storefront
CMD ["npx", "next", "start", "-H", "0.0.0.0", "-p", "3000"]

# ---------------------------------------------------------------------------
# Admin (Next.js)
# ---------------------------------------------------------------------------
FROM builder AS admin-builder
WORKDIR /app
RUN npm run build -w @shop/admin

FROM node:22-alpine AS admin
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/packages ./packages
COPY --from=admin-builder /app/apps/admin/package.json ./apps/admin/package.json
COPY --from=admin-builder /app/apps/admin/.next ./apps/admin/.next
COPY --from=admin-builder /app/apps/admin/next.config.ts ./apps/admin/next.config.ts
COPY --from=admin-builder /app/apps/admin/tsconfig.json ./apps/admin/tsconfig.json
EXPOSE 3001
WORKDIR /app/apps/admin
CMD ["npx", "next", "start", "-H", "0.0.0.0", "-p", "3001"]
