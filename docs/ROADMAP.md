# Phase Roadmap

Build order per the master prompt. Phases progress without pausing for approval (user-directed).

| Phase | Scope                                                                                                                                                                                                                                   | Status   |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1     | Architecture & tech decisions                                                                                                                                                                                                           | Approved |
| 2     | Monorepo setup, TS packages, Next.js apps, Express skeleton, Tailwind v4 + shadcn, ESLint/Prettier, env, git                                                                                                                            | Done     |
| 3     | Backend foundation (config, MongoDB, error handling, logging, security, CORS, rate limit, API versioning, health, envelope)                                                                                                             | Done     |
| 4     | Authentication (register, OTP verify, login, refresh rotation, logout, password flows, sessions, RBAC)                                                                                                                                  | Done     |
| 5     | Storefront UI (layout, home, auth UI, product listing/details, search/filter, cart, wishlist, checkout, account)                                                                                                                        | Done     |
| 6     | Admin dashboard (auth, dashboard, products, categories, inventory, orders, customers, coupons, reviews, reports, settings, roles)                                                                                                       | Done     |
| 7     | Advanced features (recommendations, order emails, media uploads; analytics/payments/shipping baseline; SEO sitemap/robots/metadata; indexes)                                                                                            | Done     |
| 8     | Testing (unit helpers, API integration, E2E-style commerce journeys; 78 vitest tests green; review-moderation default & rating-summary bugs fixed)                                                                                      | Done     |
| 9     | Production prep (Docker + compose, health metrics, backup + security-audit scripts, prod rewrites verified in next build + start). Only remaining validation: `docker build`/`docker compose up` — no container runtime in this sandbox | Done     |

## Working conventions

- Feature files must be complete; no TODOs/placeholders/fake implementations.
- Backend remains a modular monolith; modules live under `apps/api/src/modules/<name>`.
- All money math on the server; never trust client prices.
- Auth via HttpOnly cookies + rotating refresh tokens; nothing auth-related in localStorage.
- Domain separation: storefront, admin, api are independent Next.js/Express apps on one API.
