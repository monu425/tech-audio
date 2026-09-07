# Voltify Commerce Platform

A production-oriented, scalable e-commerce platform for consumer electronics
(phone accessories, earbuds, projectors, keyboards, mice and more).

| App             | Path              | Tech                                                   | URL (dev)             |
| --------------- | ----------------- | ------------------------------------------------------ | --------------------- |
| Storefront      | `apps/storefront` | Next.js 16 (App Router) + TS + Tailwind v4 + shadcn/ui | http://localhost:3000 |
| Admin           | `apps/admin`      | Next.js 16 + TS + Tailwind v4 + shadcn/ui              | http://localhost:3001 |
| API             | `apps/api`        | Express 5 + MongoDB/Mongoose (clean architecture)      | http://localhost:4000 |
| Shared packages | `packages/*`      | `@shop/types`, `@shop/validation`, `@shop/utils`       | —                     |

## Architecture

Modular monolith + clean architecture + stateless API + strong domain separation.
See `docs/` for the full architecture decision record (added in later phases).

```
Controller → Service → Repository → Mongoose model → MongoDB
```

## Requirements

- Node.js >= 22
- MongoDB >= 7 (local, or set `MONGODB_URI`)

## Getting started

```bash
# 1. Install all workspace dependencies (from repo root)
npm install

# 2. Build the shared TypeScript packages (needed by all apps)
npm run build:packages

# 3. Configure environment files
cp .env.example apps/api/.env
cp apps/storefront/.env.local.example apps/storefront/.env.local
cp apps/admin/.env.local.example apps/admin/.env.local
# then edit the secrets/URIs inside

# 4. Run everything (api :4000, storefront :3000, admin :3001)
npm run dev
```

Alternatively run apps individually: `npm run dev:api`, `npm run dev:storefront`,
`npm run dev:admin`.

## Scripts

| Script                   | Description                                   |
| ------------------------ | --------------------------------------------- |
| `npm run build:packages` | Compile shared TS packages to `dist/`         |
| `npm run dev`            | Run API + storefront + admin concurrently     |
| `npm run build`          | Build packages, API check, and both Next apps |
| `npm run lint`           | ESLint across the monorepo                    |
| `npm run format`         | Prettier write                                |
| `npm run typecheck`      | Type-check every workspace that supports it   |

## Reverse proxy (development)

Both frontends proxy `/api/*` to the API via Next rewrites
(`next.config.ts` → `API_PROXY_TARGET`, default `http://localhost:4000`) so the
browser uses a single origin and cookies work without CORS.

## Project layout

```
apps/
  storefront/   customer-facing storefront
  admin/        admin dashboard (separate app, domain admin.example.com in prod)
  api/          Express REST API
packages/
  types/        shared TS domain types (@shop/types)
  validation/   shared zod schemas (@shop/validation)
  utils/        shared utilities, cn() (@shop/utils)
docs/           architecture & decisions
scripts/        tooling
```

## Environment

Every secret lives in per-app `.env` files (git-ignored). Reference:
`.env.example` (root) documents every variable. Never commit real secrets.

## Status

Current phase: **Phase 2 — project setup/scaffolding**. See `docs/ROADMAP.md`.
