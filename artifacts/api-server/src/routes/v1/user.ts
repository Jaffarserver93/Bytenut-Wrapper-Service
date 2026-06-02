import { Router, type IRouter, type Request, type Response } from "express";
import { loginWithBrowser, getProxyFromEnv, extendServerWithBrowser } from "../../services/authService.js";
import {
  getCachedToken,
  getOrAcquireToken,
  invalidateCachedToken,
} from "../../services/tokenCache.js";
import { httpClient } from "../../lib/httpClient.js";
import {
  setAutoExtendConfig,
  getAutoExtendConfig,
} from "../../services/autoExtendService.js";

const router: IRouter = Router();

const BYTENUT_BASE_URL = "https://www.bytenut.com";

async function fetchWithToken(
  token: string,
  path: string,
): Promise<{ status: number; body: unknown }> {
  const res = await httpClient.get(`${BYTENUT_BASE_URL}${path}`, {
    headers: {
      Accept: "application/json, text/plain, */*",
      "yl-token": token,
    },
    validateStatus: () => true,
  });
  return { status: res.status, body: res.data };
}

/** Shared helper: get or acquire a token with mutex, with 401 retry. */
async function resolveToken(
  username: string,
  password: string,
): Promise<string> {
  const proxy = getProxyFromEnv();
  return getOrAcquireToken(username, () =>
    loginWithBrowser(username, password, proxy),
  );
}

async function resolveTokenWithRetry(
  username: string,
  password: string,
  log: Request["log"],
): Promise<string> {
  const proxy = getProxyFromEnv();
  const token = await getOrAcquireToken(username, () => {
    log.info({ username }, "No cached token — starting browser auth");
    return loginWithBrowser(username, password, proxy);
  });
  return token;
}

router.post("/servers", async (req: Request, res: Response) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) {
    res.status(400).json({ error: "username and password are required" });
    return;
  }

  try {
    let token = await resolveTokenWithRetry(username, password, req.log);
    let { status, body } = await fetchWithToken(token, "/game-panel/api/gpPanelServer/user/servers");

    if (status === 401) {
      req.log.warn({ username }, "Got 401 — invalidating cached token and retrying");
      invalidateCachedToken(username);
      token = await resolveToken(username, password);
      ({ status, body } = await fetchWithToken(token, "/game-panel/api/gpPanelServer/user/servers"));
    }

    if (status >= 400) {
      res.status(status).json({ error: "Upstream request failed", upstreamStatus: status, detail: body });
      return;
    }

    res.json({ servers: body });
  } catch (err) {
    req.log.error({ username, err }, "Servers fetch failed");
    res.status(500).json({ error: "Failed to fetch servers", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/profile", async (req: Request, res: Response) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) {
    res.status(400).json({ error: "username and password are required" });
    return;
  }

  try {
    let token = await resolveTokenWithRetry(username, password, req.log);
    let { status, body } = await fetchWithToken(token, "/common/user/current");

    if (status === 401) {
      req.log.warn({ username }, "Got 401 — invalidating cached token and retrying");
      invalidateCachedToken(username);
      token = await resolveToken(username, password);
      ({ status, body } = await fetchWithToken(token, "/common/user/current"));
    }

    if (status >= 400) {
      res.status(status).json({ error: "Upstream request failed", upstreamStatus: status, detail: body });
      return;
    }

    res.json({ profile: body });
  } catch (err) {
    req.log.error({ username, err }, "Profile fetch failed");
    res.status(500).json({ error: "Failed to fetch profile", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/balance", async (req: Request, res: Response) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) {
    res.status(400).json({ error: "username and password are required" });
    return;
  }

  try {
    let token = await resolveTokenWithRetry(username, password, req.log);
    let { status, body } = await fetchWithToken(token, "/common/user/current");

    if (status === 401) {
      req.log.warn({ username }, "Got 401 — invalidating cached token and retrying");
      invalidateCachedToken(username);
      token = await resolveToken(username, password);
      ({ status, body } = await fetchWithToken(token, "/common/user/current"));
    }

    if (status >= 400) {
      res.status(status).json({ error: "Upstream request failed", upstreamStatus: status, detail: body });
      return;
    }

    const d = (body as { data?: Record<string, unknown> })?.data ?? {};
    res.json({
      balance: {
        money: d["money"] ?? 0,
        inviteMoney: d["inviteMoney"] ?? 0,
        total: ((d["money"] as number) ?? 0) + ((d["inviteMoney"] as number) ?? 0),
        points: d["point"] ?? 0,
        vipLevel: d["vipLevel"] ?? "NORMAL",
        consumeAll: d["consumeAll"] ?? 0,
      },
    });
  } catch (err) {
    req.log.error({ username, err }, "Balance fetch failed");
    res.status(500).json({ error: "Failed to fetch balance", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/extension-info/:serverId", async (req: Request, res: Response) => {
  const { username, password } = req.body as { username?: string; password?: string };
  const { serverId } = req.params;

  if (!username || !password) {
    res.status(400).json({ error: "username and password are required" });
    return;
  }

  try {
    let token = await resolveTokenWithRetry(username, password, req.log);
    let { status, body } = await fetchWithToken(token, `/game-panel/api/gp-free-server/extension-info/${serverId}`);

    if (status === 401) {
      req.log.warn({ username }, "Got 401 — invalidating cached token and retrying");
      invalidateCachedToken(username);
      token = await resolveToken(username, password);
      ({ status, body } = await fetchWithToken(token, `/game-panel/api/gp-free-server/extension-info/${serverId}`));
    }

    if (status >= 400) {
      res.status(status).json({ error: "Upstream request failed", upstreamStatus: status, detail: body });
      return;
    }

    res.json({ extensionInfo: body });
  } catch (err) {
    req.log.error({ username, serverId, err }, "Extension info fetch failed");
    res.status(500).json({ error: "Failed to fetch extension info", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/extend/:serverId", async (req: Request, res: Response) => {
  const { username, password } = req.body as { username?: string; password?: string };
  const { serverId } = req.params;

  if (!username || !password) {
    res.status(400).json({ error: "username and password are required" });
    return;
  }

  const proxy = getProxyFromEnv();

  try {
    const token = await resolveTokenWithRetry(username, password, req.log);
    req.log.info({ username, serverId }, "Starting browser-based extend...");
    const result = await extendServerWithBrowser(serverId, token, proxy);

    if (!result.success) {
      res.status(400).json({ error: result.message, detail: result.data });
      return;
    }

    res.json({ success: true, message: result.message, detail: result.data });
  } catch (err) {
    req.log.error({ username, serverId, err }, "Extend server failed");
    res.status(500).json({ error: "Failed to extend server", detail: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/auto-extend/:serverId", async (req: Request, res: Response) => {
  const { username, password, enabled, thresholdMinutes } = req.body as {
    username?: string;
    password?: string;
    enabled?: boolean;
    thresholdMinutes?: number;
  };
  const { serverId } = req.params;

  if (!username || !password) {
    res.status(400).json({ error: "username and password are required" });
    return;
  }

  if (enabled !== undefined) {
    const threshold = Number(thresholdMinutes ?? 10);
    const config = setAutoExtendConfig(username, password, serverId, !!enabled, threshold);
    res.json({ autoExtend: config });
    return;
  }

  const config = getAutoExtendConfig(username, serverId);
  res.json({
    autoExtend: config ?? {
      username,
      serverId,
      enabled: false,
      thresholdMinutes: 10,
      lastExtendedAt: null,
      lastError: null,
      status: "disabled",
    },
  });
});

export default router;
