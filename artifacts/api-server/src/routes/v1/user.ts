import { Router, type IRouter, type Request, type Response } from "express";
import { loginWithBrowser, getProxyFromEnv, extendServerWithBrowser, browserFetch } from "../../services/authService.js";
import {
  getCachedSession,
  getOrAcquireSession,
  invalidateCachedToken,
  type CachedSession,
} from "../../services/tokenCache.js";
import {
  setAutoExtendConfig,
  getAutoExtendConfig,
} from "../../services/autoExtendService.js";

const router: IRouter = Router();

/** Get or acquire a full browser session (token + cookies + pre-fetched data). */
async function resolveSession(
  username: string,
  password: string,
  log: Request["log"],
): Promise<CachedSession> {
  const proxy = getProxyFromEnv();
  return getOrAcquireSession(username, async () => {
    log.info({ username }, "No cached session — starting browser auth");
    const { ylToken, cookieHeader, profile, servers } = await loginWithBrowser(username, password, proxy);
    return { token: ylToken, cookies: cookieHeader, cachedAt: Date.now(), profile, servers };
  });
}

/** Force a fresh browser login, bypassing cache. */
async function reacquireSession(
  username: string,
  password: string,
  log: Request["log"],
): Promise<CachedSession> {
  const proxy = getProxyFromEnv();
  invalidateCachedToken(username);
  return getOrAcquireSession(username, async () => {
    log.info({ username }, "Re-acquiring session with fresh browser login...");
    const { ylToken, cookieHeader, profile, servers } = await loginWithBrowser(username, password, proxy);
    return { token: ylToken, cookies: cookieHeader, cachedAt: Date.now(), profile, servers };
  });
}

router.post("/servers", async (req: Request, res: Response) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) {
    res.status(400).json({ error: "username and password are required" });
    return;
  }

  try {
    let session = await resolveSession(username, password, req.log);

    if (!session.servers) {
      req.log.warn({ username }, "No servers data in session — re-acquiring");
      session = await reacquireSession(username, password, req.log);
    }

    if (!session.servers) {
      res.status(502).json({ error: "Could not fetch servers from Bytenut" });
      return;
    }

    res.json({ servers: session.servers });
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
    let session = await resolveSession(username, password, req.log);

    if (!session.profile) {
      req.log.warn({ username }, "No profile data in session — re-acquiring");
      session = await reacquireSession(username, password, req.log);
    }

    if (!session.profile) {
      res.status(502).json({ error: "Could not fetch profile from Bytenut" });
      return;
    }

    res.json({ profile: session.profile });
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
    let session = await resolveSession(username, password, req.log);

    if (!session.profile) {
      req.log.warn({ username }, "No profile data in session for balance — re-acquiring");
      session = await reacquireSession(username, password, req.log);
    }

    if (!session.profile) {
      res.status(502).json({ error: "Could not fetch balance from Bytenut" });
      return;
    }

    const d = (session.profile as { data?: Record<string, unknown> })?.data ?? {};
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
    const session = await resolveSession(username, password, req.log);
    const proxy = getProxyFromEnv();
    const data = await browserFetch(
      `/game-panel/api/gp-free-server/extension-info/${serverId}`,
      session.token,
      proxy,
    );
    if (!data) {
      res.status(502).json({ error: "Could not fetch extension info from Bytenut" });
      return;
    }
    res.json({ extensionInfo: data });
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
    const session = await resolveSession(username, password, req.log);
    req.log.info({ username, serverId }, "Starting browser-based extend...");
    const result = await extendServerWithBrowser(serverId, session.token, proxy);

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
