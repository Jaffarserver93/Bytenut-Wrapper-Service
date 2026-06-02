import { Router, type IRouter, type Request, type Response } from "express";
import { loginWithBrowser } from "../../services/authService.js";
import {
  getCachedToken,
  setCachedToken,
  invalidateCachedToken,
} from "../../services/tokenCache.js";

const router: IRouter = Router();

const BYTENUT_BASE_URL = "https://www.bytenut.com";

async function fetchWithToken(
  token: string,
  path: string,
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${BYTENUT_BASE_URL}${path}`, {
    method: "GET",
    headers: {
      Accept: "application/json, text/plain, */*",
      "yl-token": token,
    },
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

router.post("/profile", async (req: Request, res: Response) => {
  const { username, password } = req.body as {
    username?: string;
    password?: string;
  };

  if (!username || !password) {
    res.status(400).json({ error: "username and password are required" });
    return;
  }

  const getOrFreshToken = async (): Promise<string> => {
    const cached = getCachedToken(username);
    if (cached) return cached;

    req.log.info({ username }, "No cached token — running browser auth");
    const fresh = await loginWithBrowser(username, password);
    setCachedToken(username, fresh);
    return fresh;
  };

  try {
    let token = await getOrFreshToken();

    let { status, body } = await fetchWithToken(token, "/common/user/current");

    if (status === 401) {
      req.log.warn({ username }, "Got 401 — invalidating cached token and retrying");
      invalidateCachedToken(username);
      token = await getOrFreshToken();
      ({ status, body } = await fetchWithToken(token, "/common/user/current"));
    }

    if (status >= 400) {
      res.status(status).json({
        error: "Upstream request failed",
        upstreamStatus: status,
        detail: body,
      });
      return;
    }

    res.json({ profile: body });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    req.log.error({ username, err }, "Profile fetch failed");
    res.status(500).json({ error: "Failed to fetch profile", detail: message });
  }
});

export default router;
