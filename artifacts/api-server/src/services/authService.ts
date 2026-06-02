import { createRequire } from "node:module";
import { logger } from "../lib/logger.js";

const _require = createRequire(import.meta.url);

const BYTENUT_BASE_URL = "https://www.bytenut.com";
const LOGIN_PAGE_URL = `${BYTENUT_BASE_URL}/login`;
const CLOUDFLARE_SETTLE_MS = 5000;
const POST_SUBMIT_SETTLE_MS = 3000;
const SELECTOR_TIMEOUT_MS = 15000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function loginWithBrowser(
  username: string,
  password: string,
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let browser: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let page: any = null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { connect } = _require("puppeteer-real-browser") as any;

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
      ],
      customConfig: {},
      connectOption: {},
    });

    browser = result.browser;
    page = result.page;

    await page.setViewport({ width: 1280, height: 800 });

    logger.info({ url: LOGIN_PAGE_URL }, "Navigating to login page...");
    await page.goto(LOGIN_PAGE_URL, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    logger.info(
      `Waiting ${CLOUDFLARE_SETTLE_MS}ms for Cloudflare Turnstile to auto-solve...`,
    );
    await sleep(CLOUDFLARE_SETTLE_MS);

    logger.info("Filling login form...");

    const usernameSelector = 'input[name="username"], input[type="text"], input[placeholder*="user" i], input[placeholder*="email" i]';
    const passwordSelector = 'input[name="password"], input[type="password"]';

    await page.waitForSelector(usernameSelector, {
      timeout: SELECTOR_TIMEOUT_MS,
    });
    await page.click(usernameSelector);
    await page.keyboard.type(username, { delay: 60 });

    await page.waitForSelector(passwordSelector, {
      timeout: SELECTOR_TIMEOUT_MS,
    });
    await page.click(passwordSelector);
    await page.keyboard.type(password, { delay: 60 });

    const submitSelector =
      'button[type="submit"], input[type="submit"], button:contains("Login"), button:contains("Sign in")';

    try {
      await page.waitForSelector(submitSelector, {
        timeout: SELECTOR_TIMEOUT_MS,
      });
      await page.click(submitSelector);
    } catch {
      logger.warn("Could not find submit button by selector, pressing Enter");
      await page.keyboard.press("Enter");
    }

    logger.info("Submitted login form, waiting for navigation...");
    await Promise.race([
      page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }),
      sleep(10000),
    ]);

    logger.info(
      `Waiting ${POST_SUBMIT_SETTLE_MS}ms for session to settle...`,
    );
    await sleep(POST_SUBMIT_SETTLE_MS);

    const ylToken: string | null = await page.evaluate(() => {
      const fromLocal = localStorage.getItem("yl-token");
      if (fromLocal) return fromLocal;

      const fromSession = sessionStorage.getItem("yl-token");
      if (fromSession) return fromSession;

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (key.toLowerCase().includes("token") || key.toLowerCase().includes("yl")) {
          const val = localStorage.getItem(key);
          if (val && val.length > 8) return val;
        }
      }
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (!key) continue;
        if (key.toLowerCase().includes("token") || key.toLowerCase().includes("yl")) {
          const val = sessionStorage.getItem(key);
          if (val && val.length > 8) return val;
        }
      }
      return null;
    });

    if (!ylToken) {
      throw new Error(
        "yl-token not found in localStorage or sessionStorage after login. " +
          "The login may have failed or the token storage key has changed.",
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
      }
    }
    if (browser) {
      try {
        await browser.close();
      } catch {
      }
    }
  }
}
