---
name: Proxy protocol default bug
description: PROXY_PROTOCOL env var defaulted to "https" causing Chrome to fail all proxy connections silently.
---

## The Rule
`PROXY_PROTOCOL` must default to `"http"` (never `"https"`) in both `authService.ts` and `httpClient.ts`.
Proxy credentials must be embedded directly in the `--proxy-server` Chrome arg URL.

**Why:**
Oxylabs (and most HTTP CONNECT proxies) listen over plain HTTP, not HTTPS.
When Chrome gets `--proxy-server=https://host:port`, it tries to TLS-handshake with the proxy
itself → immediate connection failure → `chrome-error://chromewebdata/`.

`page.authenticate()` handles HTTP 407 challenges on regular HTTP responses but does NOT
authenticate HTTPS CONNECT tunnels. For HTTPS sites through a proxy, credentials must be
in the proxy URL: `--proxy-server=http://user:pass@host:port`.

**How to apply:**
- `getProxyFromEnv()` default: `process.env["PROXY_PROTOCOL"] ?? "http"`
- `buildProxyArgs()`: embed `encodeURIComponent(user):encodeURIComponent(pass)@` in the URL
- `httpClient.ts` `buildClient()`: same `"http"` default
- Symptom of this bug: `chrome-error://chromewebdata/` on every navigation, even with proxy credentials set
