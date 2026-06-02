# Bytenut Dashboard

A pnpm monorepo with three artifacts: an Express API server that bypasses Cloudflare WAF on bytenut.com, a React/Vite dashboard, and a mockup sandbox. The API server uses `puppeteer-real-browser` + an Oxylabs datacenter proxy to extract `yl-tokens` and proxy Bytenut's game server APIs.

## Artifacts

| Artifact | Dir | Purpose |
|---|---|---|
| API Server | `artifacts/api-server` | Express 5 backend, browser auth, proxy layer |
| Bytenut Dashboard | `artifacts/dashboard` | React/Vite frontend |
| Canvas / Mockup Sandbox | `artifacts/mockup-sandbox` | Component preview server |

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — build + start API server (Xvfb + esbuild + node)
- `pnpm --filter @workspace/dashboard run dev` — start Vite dev server
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- **API**: Express 5, pino logger
- **Frontend**: React 19, Vite, Tailwind CSS, shadcn/ui, React Query, Wouter
- **Browser automation**: `puppeteer-real-browser` (rebrowser patches, Turnstile bypass)
- **Proxy**: Oxylabs datacenter proxy (`dc.oxylabs.io:8000`) — required because Cloudflare WAF blocks cloud IPs
- **Build**: esbuild (ESM bundle), Xvfb for headless Chromium on Linux

## Where things live

### API Server (`artifacts/api-server/src/`)

- `services/authService.ts` — puppeteer-real-browser login + `extendServerWithBrowser()` (opens browser, injects yl-token, clicks extend, intercepts network response)
- `services/tokenCache.ts` — in-memory `yl-token` cache (`Map`, 1hr TTL, invalidated on `401`)
- `services/autoExtendService.ts` — background poller (60s interval); auto-extends servers when time drops below threshold
- `routes/v1/auth.ts` — `POST /api/v1/auth/login`
- `routes/v1/user.ts` — all user endpoints (see below)
- `lib/httpClient.ts` — axios instance with Oxylabs proxy config (must use `protocol: "http"`, not `"https"`)

### Dashboard (`artifacts/dashboard/src/`)

- `pages/dashboard.tsx` — main dashboard: profile stats, balance, server grid
- `pages/login.tsx` — login page
- `components/server-card.tsx` — per-server card component
- `components/server-renew-panel.tsx` — countdown timer, manual extend button, auto-extend toggle + threshold selector
- `hooks/use-bytenut.ts` — all React Query hooks
- `lib/api.ts` — all `fetch` wrappers for the API server
- `context/AuthContext.tsx` — credentials stored in `localStorage`

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/healthz` | Health check |
| `POST` | `/api/v1/auth/login` | Returns `yl-token` (cached or fresh browser session) |
| `POST` | `/api/v1/user/profile` | Full Bytenut user profile |
| `POST` | `/api/v1/user/balance` | Balance summary: `money`, `inviteMoney`, `total`, `points`, `vipLevel`, `consumeAll` |
| `POST` | `/api/v1/user/servers` | List of game servers |
| `POST` | `/api/v1/user/extension-info/:serverId` | Extension eligibility, cooldown, minutes remaining |
| `POST` | `/api/v1/user/extend/:serverId` | Manually extend a server (+60 min, full browser flow) |
| `POST` | `/api/v1/user/auto-extend/:serverId` | Get or set auto-extend config for a server |

## Auto-Extend Feature

The API server runs a **background poller every 60 seconds**. For each enabled config (`username:serverId`), it:
1. Fetches `extension-info` via the cached token
2. If `minutesUntilExpiration ≤ thresholdMinutes` AND `canExtend === true`, calls `extendServerWithBrowser()`
3. Tracks `status` (`idle` / `extending` / `cooldown`), `lastExtendedAt`, and `lastError`
4. Uses a lock set to prevent concurrent extends for the same server

Config is stored in-memory (resets on server restart). The dashboard shows a toggle + threshold dropdown (5/10/15/20/30 min) per server card.

## Architecture Decisions

- `puppeteer-real-browser` is externalized from the esbuild bundle (loaded at runtime via `createRequire`).
- `headless: false` + `turnstile: true` is required for rebrowser patches to pass Cloudflare bot detection.
- All puppeteer/rebrowser packages are in esbuild `external[]` so they load from `node_modules` at runtime.
- Oxylabs proxy `protocol` must be `"http"` (not `"https"`) in the axios config — HTTP CONNECT tunneling.
- Countdown timer uses `minutesUntilExpiration + dataUpdatedAt` (timezone-safe) instead of parsing `expiredTime` string.
- The extend flow requires GET `/extension-challenge` (nonce) + Cloudflare Turnstile → POST `/game-panel/api/gp-free-server/extend-time/:serverId`. The browser handles all of this automatically.

## Gotchas

- Cloudflare WAF blocks Replit/cloud IPs — Oxylabs residential/DC proxy is required for all browser sessions.
- `Xvfb :99 -screen 0 1280x800x24 &` + `export DISPLAY=:99` must run before Chromium on headless Linux (handled in the `dev` script).
- If Bytenut updates their login page DOM, update username/password selectors in `authService.ts`.
- The extend endpoint is `POST /game-panel/api/gp-free-server/extend-time/:serverId` — NOT `extend/:serverId` (that 404s).
- `puppeteer-real-browser` and `rebrowser-*` packages must stay in `external[]` in `build.mjs`.

## User Preferences

_Populate as you build — explicit user instructions worth remembering across sessions._
