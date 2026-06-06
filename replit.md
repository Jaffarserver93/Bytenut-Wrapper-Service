# Bytenut Dashboard

A pnpm monorepo with an Express API server and a React/Vite dashboard for managing Bytenut game servers. The API server uses `puppeteer-real-browser` to bypass Cloudflare WAF, extract `yl-token` + session cookies, and proxy Bytenut's game server APIs.

**Primary deployment target: Termux on Android (ARM64).** Replit is used for development only — Cloudflare WAF blocks direct API calls from cloud/datacenter IPs. The API server must run on a residential IP (your Android device via Termux) for requests to pass through Cloudflare.

---

## Artifacts

| Artifact | Dir | Purpose |
|---|---|---|
| API Server | `artifacts/api-server` | Express 5 backend, browser auth, proxy layer |
| Bytenut Dashboard | `artifacts/dashboard` | React/Vite frontend |
| Canvas / Mockup Sandbox | `artifacts/mockup-sandbox` | Component preview (dev only) |

---

## Hosting on Termux (Android ARM64)

### Prerequisites

Inside proot-distro Debian on Termux:
```bash
apt-get update && apt-get install -y git curl wget xvfb chromium nodejs npm
npm install -g pnpm
```

### First-time setup

```bash
# Clone the repo
git clone <your-repo-url> ~/bit
cd ~/bit

# Create your .env with the database URL
cat > .env << 'EOF'
DATABASE_URL=postgresql://user:pass@host:5432/dbname
PORT_API=8080
PORT_DASHBOARD=5173
EOF

# Install dependencies (includes ARM64 native binaries)
pnpm install --no-frozen-lockfile

# Start everything in tmux
bash start.sh
```

### Shell scripts (project root)

| Script | Purpose |
|---|---|
| `start.sh` | Launches tmux session with both services |
| `run-api.sh` | Builds + starts API server; auto-installs Xvfb if missing |
| `run-dashboard.sh` | Starts Vite with ARM64-safe config; auto-installs ARM64 rollup if missing |
| `setup-db.sh` | Helper to write DATABASE_URL into `.env` |

### start.sh usage

```bash
bash start.sh           # start everything
tmux attach -t bytenut  # reattach to session
```

Window 0 = API server (port 8080), Window 1 = Dashboard (port 5173).

### Accessing the dashboard

Open in your phone browser or any device on the same network:
```
http://<your-termux-ip>:5173
```

Find your IP: `ip addr show | grep "inet "` or `hostname -I`

### API directly

```bash
# Login (runs browser, takes ~30s first time)
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"youruser","password":"yourpass"}'

# Profile (uses cached session)
curl -X POST http://localhost:8080/api/v1/user/profile \
  -H 'Content-Type: application/json' \
  -d '{"username":"youruser","password":"yourpass"}'

# Servers list
curl -X POST http://localhost:8080/api/v1/user/servers \
  -H 'Content-Type: application/json' \
  -d '{"username":"youruser","password":"yourpass"}'
```

### Updating

```bash
cd ~/bit
git pull
bash run-api.sh   # rebuilds + restarts API
# dashboard hot-reloads automatically via Vite
```

---

## Run on Replit (development only)

- `pnpm --filter @workspace/api-server run dev` — build + start API server (Xvfb + esbuild + node)
- `pnpm --filter @workspace/dashboard run dev` — start Vite dev server
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages

> **Note:** On Replit, login works (browser runs with Xvfb), but subsequent API calls to Bytenut are blocked by Cloudflare WAF because Replit has a datacenter IP. Use Termux for real usage.

---

## Stack

- pnpm workspaces, TypeScript 5.9
- Node.js 20 (Termux ARM64) / 24 (Replit x64)
- **API**: Express 5, pino logger
- **Frontend**: React 19, Vite 7, Tailwind CSS v4, shadcn/ui, React Query, Wouter
- **Browser automation**: `puppeteer-real-browser` (rebrowser patches, Turnstile bypass)
- **Build**: esbuild (ESM bundle), Xvfb for headless Chromium

---

## ARM64 Native Packages

All native Rust/C++ binaries are listed in root `package.json` `optionalDependencies` for both `x64` and `arm64`. The `.npmrc` `supportedArchitectures` setting ensures both are in the lockfile.

| Package | x64 | arm64 |
|---|---|---|
| `@rollup/rollup-linux-*-gnu/musl` | ✅ | ✅ |
| `@esbuild/linux-*` | ✅ | ✅ |
| `lightningcss-linux-*-gnu` | ✅ | ✅ |
| `@tailwindcss/oxide-linux-*-gnu` | ✅ | ✅ |

If a new native package fails on ARM64: add its `arm64` variant to root `package.json` `optionalDependencies`, run `pnpm install --force` on Replit, commit.

---

## Where things live

### API Server (`artifacts/api-server/src/`)

- `services/authService.ts` — browser login (puppeteer-real-browser), captures `yl-token` + `cf_clearance` cookies; `extendServerWithBrowser()` for server extension
- `services/tokenCache.ts` — in-memory session cache (`Map`): stores `{ token, cookies }` per username, 1hr TTL
- `services/autoExtendService.ts` — 60s background poller; auto-extends servers below threshold
- `lib/httpClient.ts` — axios instance; exports `BYTENUT_BROWSER_HEADERS` (Origin, Referer, User-Agent, Sec-Fetch-*)
- `routes/v1/auth.ts` — `POST /api/v1/auth/login`
- `routes/v1/user.ts` — all user/server endpoints; uses full session (token + cookies + browser headers)

### Dashboard (`artifacts/dashboard/src/`)

- `pages/dashboard.tsx` — profile stats, balance, server grid
- `pages/login.tsx` — login page
- `components/server-card.tsx` — per-server card
- `components/server-renew-panel.tsx` — countdown timer, manual extend, auto-extend toggle + threshold
- `hooks/use-bytenut.ts` — all React Query hooks
- `lib/api.ts` — all `fetch` wrappers (calls `localhost:8080` via Vite proxy)
- `context/AuthContext.tsx` — credentials stored in `localStorage`

### Vite configs

- `vite.config.ts` — Replit config (with Replit plugins)
- `vite.termux.config.ts` — Termux config: no Replit plugins, proxies `/api → localhost:8080`

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/healthz` | Health check |
| `POST` | `/api/v1/auth/login` | Browser login → returns `yl-token` (cached) |
| `POST` | `/api/v1/user/profile` | Bytenut user profile |
| `POST` | `/api/v1/user/balance` | Balance: money, inviteMoney, points, vipLevel |
| `POST` | `/api/v1/user/servers` | List of game servers |
| `POST` | `/api/v1/user/extension-info/:serverId` | Extension eligibility + minutes remaining |
| `POST` | `/api/v1/user/extend/:serverId` | Manual extend (+60 min, full browser flow) |
| `POST` | `/api/v1/user/auto-extend/:serverId` | Get/set auto-extend config |

All `POST` endpoints take `{ username, password }` in the JSON body.

---

## How Cloudflare bypass works

```
Browser (puppeteer-real-browser + Xvfb)
  → Visits bytenut.com (rebrowser patches bypass bot detection)
  → Solves Turnstile automatically (turnstile: true)
  → Completes login at /auth/login
  → Extracts yl-token from localStorage
  → Captures cf_clearance + session cookies from page

API server (same device, same IP)
  → Makes direct HTTPS requests to Bytenut APIs
  → Sends: yl-token header + Cookie (cf_clearance) + Origin/Referer/User-Agent
  → Cloudflare allows: same residential IP that obtained cf_clearance
```

**Critical:** `cf_clearance` is tied to the IP that solved the challenge. API requests must come from the same IP as the browser session — which is why Termux (residential IP) works and Replit (cloud IP) doesn't for API calls.

---

## Auto-Extend Feature

Background poller every 60 seconds. For each enabled config:
1. Fetches `extension-info` with cached session
2. If `minutesUntilExpiration ≤ thresholdMinutes` AND `canExtend === true` → runs browser extend
3. Tracks `status` (idle / extending / cooldown), `lastExtendedAt`, `lastError`

Config stored in-memory (resets on restart). Dashboard shows toggle + threshold (5/10/15/20/30 min) per server card.

---

## Architecture Decisions

- `puppeteer-real-browser` loaded at runtime via `createRequire` (not bundled by esbuild).
- `headless: false` + `turnstile: true` required — rebrowser patches only work with visible browser.
- Xvfb provides the virtual display needed for `headless: false` on headless Linux/Termux.
- `PROXY_PROTOCOL` defaults to `"http"` — Oxylabs and most CONNECT proxies speak HTTP not HTTPS.
- Proxy credentials embedded in `--proxy-server` Chrome arg URL (not `page.authenticate()`) for HTTPS CONNECT tunnel auth.
- Session cache stores `{ token, cookies }` — both required for Bytenut API calls to pass Cloudflare.
- Vite proxies `/api → localhost:8080` in `vite.termux.config.ts` so dashboard API calls route correctly.

---

## Gotchas

- **Cloudflare WAF**: blocks cloud/datacenter IPs. Termux = residential IP = allowed. Replit = cloud IP = blocked for API calls.
- **`cf_clearance` is IP-locked**: the cookie only works from the same IP that solved the Cloudflare challenge.
- **`headless: false` needs a display**: Xvfb auto-installed by `run-api.sh` via `apt-get install xvfb`.
- **`chrome-error://chromewebdata/`**: Chrome network error. Causes: no display (Xvfb not running), wrong proxy protocol (`https` instead of `http`), or proxy unreachable.
- **`ERR_ABORTED` on `/auth/login`**: normal SPA behaviour — Vue router handles the route client-side. Caught and ignored.
- **`PROXY_PROTOCOL` default**: must be `"http"` not `"https"`. If not set in `.env`, defaults to `"http"` correctly.
- **ARM64 native packages**: if a new package breaks on ARM64, add its `arm64` variant to root `package.json` and run `pnpm install --force` on Replit.
- The extend endpoint is `POST /game-panel/api/gp-free-server/extend-time/:serverId`.

---

## User Preferences

_Populate as you build — explicit user instructions worth remembering across sessions._
