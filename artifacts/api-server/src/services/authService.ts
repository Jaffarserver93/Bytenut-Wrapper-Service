/// <reference lib="dom" />
import { createRequire } from "node:module";
import { logger } from "../lib/logger.js";

const _require = createRequire(import.meta.url);

const BYTENUT_BASE_URL = "https://www.bytenut.com";
const SELECTOR_TIMEOUT_MS = 20000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface ProxyConfig {
  protocol: string;
  host: string;
  port: number;
  username?: string;
  password?: string;
}

export function getProxyFromEnv(): ProxyConfig | null {
  const host = process.env["PROXY_HOST"];
  const port = Number(process.env["PROXY_PORT"]);
  if (!host || !port) return null;
  return {
    protocol: process.env["PROXY_PROTOCOL"] ?? "https",
    host,
    port,
    username: process.env["PROXY_USERNAME"],
    password: process.env["PROXY_PASSWORD"],
  };
}

/**
 * Build the --proxy-server Chrome arg and the proxy object for puppeteer-real-browser.
 * Credentials are embedded in the URL so Chrome uses them for CONNECT tunnel auth.
 */
function buildProxyArgs(proxy: ProxyConfig | null): string[] {
  if (!proxy) return [];
  const { protocol, host, port, username, password } = proxy;
  let proxyUrl: string;
  if (username && password) {
    const encodedUser = encodeURIComponent(username);
    const encodedPass = encodeURIComponent(password);
    proxyUrl = `${protocol}://${encodedUser}:${encodedPass}@${host}:${port}`;
  } else {
    proxyUrl = `${protocol}://${host}:${port}`;
  }
  return [
    `--proxy-server=${proxyUrl}`,
    "--ignore-certificate-errors",
  ];
}

async function waitForCloudflare(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any,
  maxWaitMs = 30000,
): Promise<void> {
  const pollInterval = 2000;
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    const title: string = await page.title().catch(() => "");
    if (
      title.includes("Attention Required") ||
      title.includes("Just a moment") ||
      title.includes("Checking your browser") ||
      title.includes("Please Wait") ||
      title.includes("DDoS protection") ||
      title.includes("One more step") ||
      title.includes("Ray ID")
    ) {
      logger.info(
        { title, url: page.url() },
        "Cloudflare challenge active — waiting...",
      );
      await sleep(pollInterval);
    } else {
      logger.info({ title, url: page.url() }, "Cloudflare challenge cleared");
      return;
    }
  }

  const finalTitle: string = await page.title().catch(() => "(navigated away)");
  logger.warn(
    { finalTitle },
    "Cloudflare challenge did not clear within timeout — continuing anyway",
  );
}

export async function extendServerWithBrowser(
  serverId: string,
  ylToken: string,
  proxy: ProxyConfig | null = null,
): Promise<{ success: boolean; message: string; data?: unknown }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { connect } = _require("puppeteer-real-browser") as any;
  const effectiveProxy = proxy ?? getProxyFromEnv();
  const proxyArgs = buildProxyArgs(effectiveProxy);

  if (effectiveProxy) {
    logger.info(
      { host: effectiveProxy.host, port: effectiveProxy.port, hasAuth: !!(effectiveProxy.username && effectiveProxy.password) },
      "Using proxy for browser session (extend)",
    );
  } else {
    logger.warn("No proxy configured for extend — Cloudflare may block this datacenter IP.");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let browser: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let page: any = null;

  try {
    const result = await connect({
      headless: false,
      turnstile: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--window-size=1280,800",
        ...proxyArgs,
      ],
      proxy: effectiveProxy
        ? { host: effectiveProxy.host, port: effectiveProxy.port }
        : {},
      customConfig: {},
      connectOption: {},
    });

    browser = result.browser;
    page = result.page;

    await page.setViewport({ width: 1280, height: 800 });

    // Also set page-level auth as a fallback for proxy providers that use 407
    if (effectiveProxy?.username && effectiveProxy?.password) {
      await page.authenticate({
        username: effectiveProxy.username,
        password: effectiveProxy.password,
      });
    }

    // Intercept the extend-time API response to know success/failure
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let extendResult: any = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    page.on("response", async (response: any) => {
      const url: string = response.url();
      if (url.includes("extend-time")) {
        try {
          extendResult = await response.json().catch(() => null);
          logger.info({ url, extendResult }, "Intercepted extend-time response");
        } catch { /* ignore */ }
      }
    });

    // Warm up Cloudflare cookies on homepage
    logger.info({ serverId }, "Warming up Cloudflare cookies for extend...");
    await page.goto(BYTENUT_BASE_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
    await waitForCloudflare(page, 30000);

    // Inject cached yl-token so the page loads as authenticated
    await page.evaluate((token: string) => {
      localStorage.setItem("yl-token", token);
    }, ylToken);

    // Navigate to the free server panel page
    logger.info({ serverId }, "Navigating to free-gamepanel page...");
    await page.goto(`${BYTENUT_BASE_URL}/free-gamepanel/${serverId}`, {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });
    await waitForCloudflare(page, 30000);
    await sleep(4000); // Let the Vue app fully render

    // Dump page buttons for diagnostics
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pageButtons: string[] = await page.evaluate((): string[] =>
      Array.from((document as any).querySelectorAll("button, [class*='button'], [role='button']")).map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (el: any) => `class="${el.className}" text="${el.textContent?.trim().slice(0, 60)}"`,
      ),
    );
    logger.info({ pageButtons }, "Buttons on free-gamepanel page");

    // Try known selectors first
    const EXTEND_SELECTORS = [
      ".free-server-cta",
      "[class*='free-server-cta']",
      "[class*='free-server-button']",
    ];

    let clicked = false;
    for (const sel of EXTEND_SELECTORS) {
      const handle = await page.$(sel).catch(() => null);
      if (handle) {
        await handle.click();
        clicked = true;
        logger.info({ selector: sel, serverId }, "Clicked extend button via selector");
        break;
      }
    }

    if (!clicked) {
      // Fallback: find by text containing "+" and "min"
      clicked = await page.evaluate((): boolean => {
        const all = Array.from(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (document as any).querySelectorAll("button, [class*='button'], [role='button']"),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ) as any[];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const btn = all.find((el: any) => {
          const text = (el.textContent ?? "").trim().toLowerCase();
          return (text.includes("+") && text.includes("min")) || text.includes("extend");
        });
        if (btn) { btn.click(); return true; }
        return false;
      });
      if (clicked) logger.info({ serverId }, "Clicked extend button via text content");
    }

    if (!clicked) {
      throw new Error("Could not find the extend button on the free-gamepanel page");
    }

    // Wait for Turnstile to be solved and extend-time request to complete (up to 35s)
    logger.info({ serverId }, "Waiting for Turnstile solve and extend-time response...");
    const deadline = Date.now() + 35000;
    while (Date.now() < deadline && extendResult === null) {
      await sleep(500);
    }

    if (extendResult !== null) {
      if (extendResult.code === 200) {
        return { success: true, message: "Server extended successfully", data: extendResult };
      }
      return {
        success: false,
        message: extendResult.message ?? "Extend returned non-200",
        data: extendResult,
      };
    }

    // No response intercepted in time — treat button click as best-effort
    return { success: true, message: "Extend button clicked (no response intercepted)" };
  } catch (err) {
    logger.error({ err, serverId }, "Browser extend failed");
    throw err;
  } finally {
    if (page) await page.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}

export async function loginWithBrowser(
  username: string,
  password: string,
  proxy: ProxyConfig | null = null,
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let browser: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let page: any = null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { connect } = _require("puppeteer-real-browser") as any;

    const effectiveProxy = proxy ?? getProxyFromEnv();
    const proxyArgs = buildProxyArgs(effectiveProxy);

    if (effectiveProxy) {
      logger.info(
        { host: effectiveProxy.host, port: effectiveProxy.port, hasAuth: !!(effectiveProxy.username && effectiveProxy.password) },
        "Using proxy for browser session",
      );
    } else {
      logger.warn(
        "No proxy configured — Cloudflare may block this datacenter IP. " +
          "Set PROXY_HOST and PROXY_PORT env vars to use a residential proxy.",
      );
    }

    logger.info("Launching browser to authenticate with Bytenut...");

    const result = await connect({
      headless: false,
      turnstile: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--window-size=1280,800",
        ...proxyArgs,
      ],
      proxy: effectiveProxy
        ? { host: effectiveProxy.host, port: effectiveProxy.port }
        : {},
      customConfig: {},
      connectOption: {},
    });

    browser = result.browser;
    page = result.page;

    await page.setViewport({ width: 1280, height: 800 });

    // Also set page-level auth as a fallback for proxy providers that use 407
    if (effectiveProxy?.username && effectiveProxy?.password) {
      await page.authenticate({
        username: effectiveProxy.username,
        password: effectiveProxy.password,
      });
    }

    // Step 1: Hit the homepage first to collect Cloudflare clearance cookie
    logger.info("Visiting homepage to warm up Cloudflare cookies...");
    await page.goto(BYTENUT_BASE_URL, {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });
    await waitForCloudflare(page, 30000);
    await sleep(2000);

    // Step 2: Navigate to the login page
    logger.info("Navigating to login page...");
    await page.goto(`${BYTENUT_BASE_URL}/login`, {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });
    await waitForCloudflare(page, 30000);
    await sleep(2000);

    const pageUrl: string = page.url();
    const pageTitle: string = await page.title().catch(() => "(navigated away)");
    logger.info({ pageUrl, pageTitle }, "Login page loaded");

    // Dump all inputs for debugging (runs in browser context — DOM types intentional)
    const inputsFound: string[] = await page.evaluate((): string[] => {
      return Array.from((document as any).querySelectorAll("input")).map(
        (el: any) =>
          `type=${el.type} name=${el.name} id=${el.id} placeholder=${el.placeholder}`,
      );
    });
    logger.info({ inputsFound }, "Inputs found on login page");

    if (inputsFound.length === 0) {
      logger.info("No inputs found — scanning for a login trigger...");
      const clicked: boolean = await page.evaluate((): boolean => {
        const all = Array.from((document as any).querySelectorAll("a, button, [role='button']")) as any[];
        const trigger = all.find((el: any) => {
          const text = (el.textContent ?? "").toLowerCase();
          return (
            text.includes("login") ||
            text.includes("sign in") ||
            text.includes("log in")
          );
        });
        if (trigger) {
          trigger.click();
          return true;
        }
        return false;
      });
      if (clicked) {
        logger.info("Clicked login trigger — waiting for form...");
        await sleep(3000);
      }
    }

    logger.info("Waiting for username input...");
    const usernameHandle = await page
      .waitForSelector(
        [
          'input[name="username"]',
          'input[name="account"]',
          'input[name="email"]',
          'input[name="loginName"]',
          'input[name="login"]',
          'input[name="user"]',
          'input[type="email"]',
          'input[type="text"]:not([type="search"]):not([type="hidden"])',
        ].join(", "),
        { timeout: SELECTOR_TIMEOUT_MS },
      )
      .catch(() => null);

    if (!usernameHandle) {
      const allInputs: string[] = await page.evaluate((): string[] =>
        Array.from((document as any).querySelectorAll("input")).map(
          (el: any) =>
            `type=${el.type} name=${el.name} id=${el.id} placeholder=${el.placeholder}`,
        ),
      );
      throw new Error(
        `Username input not found on login page. URL: ${page.url()} — inputs on page: ${JSON.stringify(allInputs)}`,
      );
    }

    await usernameHandle.click({ clickCount: 3 });
    await usernameHandle.type(username, { delay: 60 });
    logger.info("Username entered");

    const passwordHandle = await page
      .waitForSelector('input[type="password"]', {
        timeout: SELECTOR_TIMEOUT_MS,
      })
      .catch(() => null);

    if (!passwordHandle) {
      throw new Error("Password input not found on login page.");
    }

    await passwordHandle.click({ clickCount: 3 });
    await passwordHandle.type(password, { delay: 60 });
    logger.info("Password entered — submitting form...");

    const submitted: boolean = await page.evaluate((): boolean => {
      const explicit = (document as any).querySelector(
        'button[type="submit"], input[type="submit"]',
      );
      if (explicit) {
        explicit.click();
        return true;
      }
      const btns = Array.from((document as any).querySelectorAll("button")) as any[];
      const loginBtn = btns.find((b: any) => {
        const t = (b.textContent ?? "").toLowerCase();
        return (
          t.includes("login") ||
          t.includes("sign in") ||
          t.includes("log in") ||
          t.includes("submit")
        );
      });
      if (loginBtn) {
        loginBtn.click();
        return true;
      }
      return false;
    });

    if (!submitted) {
      logger.warn("No submit button — pressing Enter on password field");
      await passwordHandle.press("Enter");
    }

    logger.info("Waiting for post-login navigation...");
    await Promise.race([
      page
        .waitForNavigation({ waitUntil: "networkidle2", timeout: 20000 })
        .catch(() => null),
      sleep(12000),
    ]);
    await sleep(3000);

    const finalUrl: string = page.url();
    const finalTitle: string = await page.title().catch(() => "(navigated away)");
    logger.info({ finalUrl, finalTitle }, "Post-login page");

    const ylToken: string | null = await page.evaluate(() => {
      const exact =
        localStorage.getItem("yl-token") ??
        sessionStorage.getItem("yl-token");
      if (exact) return exact;

      for (const store of [localStorage, sessionStorage]) {
        for (let i = 0; i < store.length; i++) {
          const key = store.key(i);
          if (!key) continue;
          const lower = key.toLowerCase();
          if (
            lower.includes("token") ||
            lower.startsWith("yl") ||
            lower.includes("auth") ||
            lower.includes("session")
          ) {
            const val = store.getItem(key);
            if (val && val.length > 8) return val;
          }
        }
      }
      return null;
    });

    if (!ylToken) {
      const storageKeys: string[] = await page.evaluate(() => {
        const keys: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k) keys.push(`local:${k}`);
        }
        for (let i = 0; i < sessionStorage.length; i++) {
          const k = sessionStorage.key(i);
          if (k) keys.push(`session:${k}`);
        }
        return keys;
      });
      logger.error({ storageKeys, finalUrl }, "yl-token not found in storage");
      throw new Error(
        `yl-token not found after login. Final URL: ${finalUrl}. ` +
          `Storage keys: ${JSON.stringify(storageKeys)}`,
      );
    }

    logger.info({ username }, "Successfully extracted yl-token");
    return ylToken;
  } catch (err) {
    logger.error({ err, username }, "Browser authentication failed");
    throw err;
  } finally {
    if (page) {
      try {
        await page.close();
      } catch {
        // ignore
      }
    }
    if (browser) {
      try {
        await browser.close();
      } catch {
        // ignore
      }
    }
  }
}
