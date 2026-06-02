# Bytenut API Wrapper

An Express.js server that wraps Bytenut.com's internal API, bypassing Cloudflare Turnstile protection via `puppeteer-real-browser`. The extracted `yl-token` is cached in memory and reused for subsequent lightweight `fetch` requests.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port assigned by workflow)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- **Linux only**: `Xvfb :99 -screen 0 1280x800x24 & export DISPLAY=:99` — required before starting the server on headless Linux (Chromium needs a display)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- Browser automation: `puppeteer-real-browser` (rebrowser patches, Turnstile bypass)
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/api-server/src/services/authService.ts` — puppeteer-real-browser login flow
- `artifacts/api-server/src/services/tokenCache.ts` — in-memory `yl-token` cache (Map, 1hr TTL)
- `artifacts/api-server/src/routes/v1/auth.ts` — `POST /api/v1/auth/login`
- `artifacts/api-server/src/routes/v1/user.ts` — `POST /api/v1/user/profile`
- `artifacts/api-server/README.md` — full setup, Xvfb instructions, endpoint docs

## Architecture decisions

- `puppeteer-real-browser` is externalized from the esbuild bundle (CJS; loaded at runtime via `createRequire`).
- Token cache uses a simple `Map<username, { token, cachedAt }>` with 1-hour TTL and on-demand invalidation on upstream `401`.
- `headless: false` + `turnstile: true` is required so rebrowser patches can pass Cloudflare's bot detection.
- All puppeteer/rebrowser packages added to esbuild `external[]` so they load from `node_modules` at runtime.

## Product

- `POST /api/v1/auth/login` — returns `yl-token` for a Bytenut user (cached or fresh browser session)
- `POST /api/v1/user/profile` — returns the Bytenut user profile, auto-refreshing the token on 401
- `GET /api/healthz` — health check

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Must run `Xvfb :99 ...` and `export DISPLAY=:99` before starting on any headless Linux server.
- If Bytenut updates their login page DOM, update the username/password selectors in `authService.ts`.
- `puppeteer-real-browser` and `rebrowser-*` packages must stay in the esbuild `external[]` list in `build.mjs`.

## Pointers

- See `artifacts/api-server/README.md` for complete Xvfb setup and API docs
- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
