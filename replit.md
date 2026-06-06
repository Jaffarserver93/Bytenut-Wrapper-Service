# Bytenut Dashboard

A pnpm monorepo with three artifacts: an Express API server that bypasses Cloudflare WAF on bytenut.com, a React/Vite dashboard, and a mockup sandbox. The API server uses `puppeteer-real-browser` + an optional Oxylabs datacenter proxy to extract `yl-tokens` and proxy Bytenut's game server APIs.

## Artifacts

| Artifact | Dir | Purpose |
|---|---|---|
| API Server | `artifacts/api-server` | Express 5 backend, browser auth, proxy layer |
| Bytenut Dashboard | `artifacts/dashboard` | React/Vite frontend |
| Canvas / Mockup Sandbox | `artifacts/mockup-sandbox` | Component preview server |

## Run & Operate

### On Replit
- `pnpm --filter @workspace/api-server run dev` — build + start API server (Xvfb + esbuild + node)
- `pnpm --filter @workspace/dashboard run dev` — start Vite dev server
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages

### On Termux (ARM64 / proot-distro Debian)
- `bash start.sh` — starts both services in tmux (window 0 = api, window 1 = dashboard)
- `bash run-api.sh` — builds and starts API server; auto-installs Xvfb if missing
- `bash run-dashboard.sh` — starts Vite with ARM64-safe config; auto-installs ARM64 rollup if missing
- `.env` file must be at the project root with at least `DATABASE_URL=...`

#### First-time Termux setup
```bash
git clone <repo> ~/bit
cd ~/bit
cp .env.example .env       # edit and add DATABASE_URL
pnpm install --no-frozen-lockfile
bash start.sh
```

#### On Termux login fails
Check these in order:
1. Is Xvfb installed? `run-api.sh` auto-installs it via `apt-get`
2. Is `DISPLAY=:99` exported? Check tmux window 0 output
3. Are proxy env vars set in `.env`? If `PROXY_HOST` is set but the proxy is unreachable, **remove those lines** — Termux is a residential IP and doesn't need a proxy
4. The error log will now say `Navigation failed at "homepage warmup"` with the exact cause

## Stack

- pnpm workspaces, Node.js 20 (Termux) / 24 (Replit), TypeScript 5.9
- **API**: Express 5, pino logger
- **Frontend**: React 19, Vite 7, Tailwind CSS v4, shadcn/ui, React Query, Wouter
- **Browser automation**: `puppeteer-real-browser` (rebrowser patches, Turnstile bypass)
- **Proxy**: Oxylabs datacenter proxy (`dc.oxylabs.io:8000`) — only needed for cloud/datacenter IPs; Termux (residential) can skip it
- **Build**: esbuild (ESM bundle), Xvfb for headless Chromium on Linux

## ARM64 / Termux Native Packages

All native Rust/C++ binaries are explicitly listed in root `package.json` `optionalDependencies` for both `x64` and `arm64`. The `.npmrc` has `supportedArchitectures` set so the lockfile includes both. After any `pnpm install --force` on Replit, the lockfile will contain ARM64 binaries that Termux can download.

| Package | x64 | arm64 |
|---|---|---|
| `@rollup/rollup-linux-*-gnu/musl` | ✅ | ✅ |
| `@esbuild/linux-*` | ✅ | ✅ |
| `lightningcss-linux-*-gnu` | ✅ | ✅ |
| `@tailwindcss/oxide-linux-*-gnu` | ✅ | ✅ |

If a new native package breaks on ARM64, add its `arm64` variant to root `package.json` `optionalDependencies` and run `pnpm install --force` on Replit.

## Where things live

### API Server (`artifacts/api-server/src/`)

- `services/authService.ts` — puppeteer-real-browser login + `extendServerWithBrowser()`; `assertNotErrorPage()` detects proxy/display failures early
- `services/tokenCache.ts` — in-memory `yl-token` cache (`Map`, 1hr TTL, invalidated on `401`)
- `services/autoExtendService.ts` — background poller (60s interval); auto-extends servers when time drops below threshold
- `routes/v1/auth.ts` — `POST /api/v1/auth/login`
- `routes/v1/user.ts` — all user endpoints
- `lib/httpClient.ts` — axios instance with optional Oxylabs proxy config (must use `protocol: "http"`, not `"https"`)

### Dashboard (`artifacts/dashboard/src/`)

- `pages/dashboard.tsx` — main dashboard: profile stats, balance, server grid
- `pages/login.tsx` — login page
- `components/server-card.tsx` — per-server card component
- `components/server-renew-panel.tsx` — countdown timer, manual extend button, auto-extend toggle + threshold selector
- `hooks/use-bytenut.ts` — all React Query hooks
- `lib/api.ts` — all `fetch` wrappers for the API server
- `context/AuthContext.tsx` — credentials stored in `localStorage`

### Termux scripts (project root)

- `start.sh` — launches tmux with both services
- `run-api.sh` — auto-installs Xvfb if missing, sets DISPLAY=:99, builds + starts API
- `run-dashboard.sh` — auto-installs ARM64 rollup if missing, starts Vite with `vite.termux.config.ts`
- `setup-db.sh` — helper to write DATABASE_URL into `.env`
- `artifacts/dashboard/vite.termux.config.ts` — Vite config without Replit-specific plugins (no runtimeErrorOverlay, no cartographer, no devBanner, no top-level await)

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/healthz` | Health check |
| `POST` | `/api/v1/auth/login` | Returns `yl-token` (cached or fresh browser session) |
| `POST` | `/api/v1/user/profile` | Full Bytenut user profile |
| `POST` | `/api/v1/user/balance` | Balance summary |
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

- **Cloudflare WAF** blocks cloud/datacenter IPs — proxy needed on Replit; NOT needed on Termux (residential IP).
- **`headless: false` requires a display** — Xvfb must run before starting the API. `run-api.sh` auto-installs and starts it.
- **`chrome-error://chromewebdata/`** means Chromium failed to connect (no display, or proxy unreachable). `assertNotErrorPage()` now throws a clear diagnostic instead of "username input not found".
- **Xvfb on Termux** — installed via `apt-get install -y xvfb` inside proot-distro Debian. `run-api.sh` does this automatically.
- If Bytenut updates their login page DOM, update username/password selectors in `authService.ts`.
- The extend endpoint is `POST /game-panel/api/gp-free-server/extend-time/:serverId` — NOT `extend/:serverId` (that 404s).
- `puppeteer-real-browser` and `rebrowser-*` packages must stay in `external[]` in `build.mjs`.

## User Preferences

_Populate as you build — explicit user instructions worth remembering across sessions._
