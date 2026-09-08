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
Build phases and decisions are tracked in `docs/ROADMAP.md`.

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

## Reverse proxy

Both frontends proxy `/api/*` and `/uploads/*` to the API via Next rewrites
(`next.config.ts` → `API_PROXY_TARGET`, default `http://localhost:4000`), so the
browser uses a single origin and cookies work without CORS. The rewrites are NOT
dev-gated — they also run under `next start`, which is what makes the Docker
storefront/admin containers work.

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
docs/           roadmap & phase status
scripts/        tooling
```

## Environment

Every secret lives in per-app `.env` files (git-ignored). Reference:
`.env.example` (root) documents every variable. Never commit real secrets.

Canonical variables for the API-backend wiring:

| Variable                                       | App(s)                                                                          | Read at                            | Purpose                                                                                                                                                                     |
| ---------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_BASE`                         | storefront + admin                                                              | build (inlined into client bundle) | Browser API base. Keep `/api/v1` so requests stay same-origin and are proxied by rewrites.                                                                                  |
| `API_PROXY_TARGET`                             | storefront + admin                                                              | server boot (`next.config.ts`)     | Upstream for `/api/*` + `/uploads/*` rewrites. Local: `http://localhost:4000`. Docker: `http://api:4000`.                                                                   |
| `API_INTERNAL_URL`                             | storefront Server Components (`app/sitemap.ts`, `app/products/[slug]/page.tsx`) | server runtime                     | Server-side API base. Local: `http://localhost:4000/api/v1`. Docker: `http://api:4000/api/v1`.                                                                              |
| `API_BASE_URL`                                 | storefront Server Components (`app/page.tsx`, `app/categories/page.tsx`)        | server runtime                     | Server-side API base (same value as `API_INTERNAL_URL`).                                                                                                                    |
| `NEXT_PUBLIC_SITE_URL`                         | storefront + admin (SEO metadata, canonical URLs)                               | build                              | `http://localhost:3000` (storefront) / `http://localhost:3001` (admin).                                                                                                     |
| `MONGODB_URI`                                  | api                                                                             | server runtime                     | MongoDB connection string.                                                                                                                                                  |
| `ACCESS_TOKEN_SECRET` / `REFRESH_TOKEN_SECRET` | api                                                                             | server runtime                     | JWT signing secrets (long random values in production).                                                                                                                     |
| `COOKIE_SECURE`                                | api                                                                             | server runtime                     | `true` behind HTTPS.                                                                                                                                                        |
| `CORS_ORIGINS`                                 | api                                                                             | server runtime                     | Comma-separated allow-list; includes `http(s)://*.monkeycode-ai.live` preview origins.                                                                                      |
| `MEDIA_UPLOAD_DIR`                             | api                                                                             | server runtime                     | Upload directory; `./uploads` locally, `/data/uploads` in Docker.                                                                                                           |
| `STORE_URL` / `ADMIN_URL`                      | api                                                                             | server runtime                     | Public frontend origins used for cookies/email links.                                                                                                                       |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD`               | api seed                                                                        | seed time                          | Super-admin bootstrap account created by `seed:admin` (`admin@example.com` / `Admin1234!` by default; the `seed:products` demo login is `demo@example.com` / `Demo12345!`). |

`NEXT_PUBLIC_*` values are inlined at build time, so for Docker images they must be
supplied as build args, never as runtime `environment:`. See the Docker section.

## Docker deployment

One multi-target `Dockerfile` builds `api`, `storefront` and `admin` images;
`docker-compose.yml` also runs MongoDB, healthchecks and a one-shot seed service.

```bash
# 1. Root .env feeds compose ${VAR} interpolation (JWT secrets, COOKIE_SECURE)
cp .env.example .env
# then edit the secrets inside .env

# 2. Build and start mongo, api, storefront (:3000) and admin (:3001)
docker compose up --build -d

# 3. Seed once (super admin + demo catalogue). Idempotent; re-run any time.
docker compose --profile seed run --rm seed
```

Container wiring notes:

- The compose file uses inline `environment:` only — no `env_file`. Variables set in
  a root `.env` are interpolated into `environment:` values (e.g. the JWT secrets).
- The api container depends on a healthy mongo
  (`depends_on: condition: service_healthy`) before it starts; the seed service
  waits the same way.
- The storefront service sets `API_BASE_URL` and `API_INTERNAL_URL` to
  `http://api:4000/api/v1` so Server Components SSR-fetch the API container instead
  of falling back to `http://localhost:4000` (itself). `API_PROXY_TARGET` is set to
  `http://api:4000` for the `/api` + `/uploads` rewrites on both frontends.
- All containers run as the unprivileged `node` user. The api writes uploaded media
  to the named volume `media-data` mounted at `/data/uploads` (owned by `node`).
- Healthchecks: mongo (`mongosh ping`), api (`/api/v1/health` via node fetch), and
  storefront/admin (`/api/v1/health` through their own rewrite to the api).
- `NEXT_PUBLIC_API_BASE` / `NEXT_PUBLIC_SITE_URL` are passed as fixed per-service
  `build.args` (Dockerfile `ARG` → `ENV` during `next build`). Because the
  `NEXT_PUBLIC_*` values are shared by name across apps but differ per app
  (storefront origin `:3000`, admin origin `:3001`), they are NOT read from the
  root `.env`. Edit the Dockerfile `ARG` defaults or the compose `build.args` to
  change the baked-in public origin.

Local runs outside Docker keep using the `.env.local` fallbacks
(`http://localhost:4000/api/v1`), so no extra config is needed for `npm run dev`.

## Status

Current phase: **Phase 9 — production prep**. Only remaining validation is a real
`docker build` / `docker compose up` run (no container runtime in this sandbox).
See `docs/ROADMAP.md`.
