# Bytenut API Wrapper

An Express.js server that wraps Bytenut.com's internal API. Because Bytenut uses Cloudflare Turnstile protection, the first login for each user is handled by a real Chromium browser (via `puppeteer-real-browser` with rebrowser patches). The extracted `yl-token` is then cached in memory and reused for subsequent lightweight `fetch` requests.

---

## Prerequisites

### System packages

Install Chromium and Xvfb (required for headless-like operation on Linux):

```bash
sudo apt-get update
sudo apt-get install -y \
  chromium-browser \
  xvfb \
  x11-utils \
  libgbm1 \
  libasound2 \
  libxss1 \
  libatk-bridge2.0-0 \
  libgtk-3-0
```

### Node.js packages

```bash
pnpm install
```

---

## Running on a Linux Server

### Step 1 — Start Xvfb

`puppeteer-real-browser` runs Chromium with `headless: false` to pass Cloudflare challenges. On a Linux server (no display), you must create a virtual framebuffer first:

```bash
Xvfb :99 -screen 0 1280x800x24 &
export DISPLAY=:99
```

To make this permanent (e.g. via systemd or a startup script):

```bash
# /etc/systemd/system/xvfb.service
[Unit]
Description=Virtual Framebuffer
After=network.target

[Service]
ExecStart=/usr/bin/Xvfb :99 -screen 0 1280x800x24
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable xvfb
sudo systemctl start xvfb
```

### Step 2 — Start the API server

```bash
export DISPLAY=:99
pnpm --filter @workspace/api-server run dev
```

The server starts on the port assigned by the Replit workflow (env `PORT`).

---

## API Endpoints

All routes are prefixed with `/api`.

### `POST /api/v1/auth/login`

Authenticate a Bytenut user. Returns the `yl-token`.

**Request body:**
```json
{
  "username": "your_username",
  "password": "your_password"
}
```

**Response:**
```json
{
  "ylToken": "<extracted_yl_token>",
  "cached": false
}
```

- `cached: true` means the token was served from in-memory cache (no browser was launched).
- `cached: false` means a fresh browser session was used to obtain the token.

**Errors:**
- `400` — Missing `username` or `password`
- `500` — Browser automation failed (timeout, selector not found, login rejected, etc.)

---

### `POST /api/v1/user/profile`

Fetch the current user's profile from Bytenut (`/common/user/current`). Uses the cached token if available, or triggers a fresh browser login. Automatically retries once on `401 Unauthorized` by invalidating the stale cache entry.

**Request body:**
```json
{
  "username": "your_username",
  "password": "your_password"
}
```

**Response:**
```json
{
  "profile": { ...bytenut_user_object... }
}
```

**Errors:**
- `400` — Missing `username` or `password`
- `401` / `4xx` — Upstream Bytenut API returned an error (forwarded)
- `500` — Browser automation or network failure

---

### `GET /api/healthz`

Health check.

```json
{ "status": "ok" }
```

---

## Token Cache Behaviour

| Event | Action |
|---|---|
| Fresh login (no cache) | Browser launches, Cloudflare is solved, `yl-token` extracted and stored |
| Subsequent requests | Token served directly from `Map` — no browser |
| Token age > 1 hour | Cache entry expired; browser re-launched on next request |
| Upstream `401` response | Cache entry deleted; browser re-launched immediately |

The cache is in-memory and **resets on server restart**. Each username has its own cache entry.

---

## Architecture

```
POST /api/v1/auth/login
       │
       ├─ cache hit? ──yes──► return cached yl-token
       │
       └─ no ──► authService.loginWithBrowser()
                      │
                      ├─ connect() via puppeteer-real-browser
                      ├─ navigate to /login
                      ├─ wait 5s for Turnstile auto-solve
                      ├─ fill username + password, submit
                      ├─ wait for navigation + 3s settle
                      ├─ evaluate localStorage / sessionStorage
                      └─ return yl-token ──► store in tokenCache ──► return to caller


POST /api/v1/user/profile
       │
       ├─ getOrFreshToken() (cache or browser)
       │
       ├─ fetch /common/user/current with yl-token header
       │
       └─ 401? ──► invalidate cache ──► re-auth ──► retry fetch
```

---

## Notes & Troubleshooting

- **Selector failures** — If Bytenut updates their login page DOM, the username/password/submit selectors in `src/services/authService.ts` may need updating. The service tries multiple common selector patterns and falls back to pressing `Enter`.
- **Chromium not found** — Set the `PUPPETEER_EXECUTABLE_PATH` env var to point to your Chromium binary: `export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser`
- **DISPLAY not set** — Ensure `export DISPLAY=:99` is set in the same shell session as the server.
- **Token extraction fails** — Bytenut may store the token under a different key. Open `authService.ts` and extend the `page.evaluate` block to log all `localStorage` keys for inspection.
