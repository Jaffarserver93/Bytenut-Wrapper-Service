---
name: Cloudflare datacenter IP block on Bytenut
description: Bytenut.com's Cloudflare WAF blocks Replit/cloud datacenter IPs; puppeteer-real-browser turnstile solver cannot help — needs residential proxy.
---

# Cloudflare WAF block on Bytenut.com

## The rule
puppeteer-real-browser with `turnstile: true` solves Cloudflare **Turnstile CAPTCHA** challenges ("Just a moment…" / checkbox), but does NOT bypass the **WAF/IP block** page ("Attention Required! | Cloudflare" with the `blocked_why_detail` paragraph).

**Why:** The "Attention Required!" WAF block is enforced at IP reputation level — Replit's server IPs are in datacenter ASN ranges that Cloudflare flags. No amount of browser fingerprint spoofing unblocks a firewall-level IP ban.

## How to apply
Any time the browser gets stuck on `pageTitle: "Attention Required! | Cloudflare"` indefinitely, the fix is a **residential proxy**, not more wait time.

**Env vars wired into authService.ts:**
- `PROXY_HOST` — proxy hostname
- `PROXY_PORT` — proxy port (numeric)
- `PROXY_USERNAME` — optional auth
- `PROXY_PASSWORD` — optional auth

The proxy is passed to `connect()` via `puppeteer-real-browser`'s `proxy: { host, port }` option and authenticated via `page.authenticate()`. It is used only for the browser session; cached-token fetch() calls go direct.
