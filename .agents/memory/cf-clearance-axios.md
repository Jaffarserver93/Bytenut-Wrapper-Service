---
name: cf_clearance cannot be replayed via axios
description: Bytenut API calls through axios always get 403 Cloudflare challenge — all API calls must be made from inside the puppeteer browser session.
---

## The Rule
Never use axios to call Bytenut API endpoints after browser login. Make all API calls (profile, servers, balance, extension-info) via `page.evaluate(() => fetch(...))` while the puppeteer browser session is still open.

**Why:**
Cloudflare's `cf_clearance` cookie is bound to the browser's TLS fingerprint (JA3/JA4 hash). When the same cookie is replayed through Node.js/axios, Cloudflare sees a different TLS fingerprint and issues a new managed challenge (HTTP 403 with "Just a moment..." HTML). The old `isCloudflareBlock()` check missed this because it looked for "blocked"/"cf-error" — not "Just a moment...".

**How to apply:**
- In `loginWithBrowser()` (authService.ts): before closing the browser, call `page.evaluate(async (token) => fetch('/path', { headers: { 'yl-token': token } }), ylToken)` for each API endpoint needed.
- Store results in `CachedSession` (`profile`, `servers` fields) alongside the token.
- User routes (user.ts) read directly from the cached session — no axios calls to Bytenut.
- When cached data is null/missing, call `reacquireSession()` which re-opens a browser and re-fetches everything.
- The `autoExtendService` (which needs extension-info) still uses a browser session for that call too.
- Symptom of this bug: all API calls return 403 with a Cloudflare challenge HTML body immediately after a successful browser login.
