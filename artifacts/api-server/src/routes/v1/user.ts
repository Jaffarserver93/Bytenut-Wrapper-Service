import { Router, type IRouter, type Request, type Response } from "express";
import { loginWithBrowser, getProxyFromEnv } from "../../services/authService.js";
import {
  getCachedToken,
  setCachedToken,
  invalidateCachedToken,
} from "../../services/tokenCache.js";
import { httpClient } from "../../lib/httpClient.js";

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

router.post("/servers", async (req: Request, res: Response) => {
  const { username, password } = req.body as {
    username?: string;
    password?: string;
  };

  if (!username || !password) {
    res.status(400).json({ error: "username and password are required" });
    return;
  }

  const proxy = getProxyFromEnv();

  const getOrFreshToken = async (): Promise<string> => {
    const cached = getCachedToken(username);
    if (cached) return cached;

    req.log.info({ username }, "No cached token — running browser auth");
    const fresh = await loginWithBrowser(username, password, proxy);
    setCachedToken(username, fresh);
    return fresh;
  };

  try {
    let token = await getOrFreshToken();

    let { status, body } = await fetchWithToken(
      token,
      "/game-panel/api/gpPanelServer/user/servers",
    );

    if (status === 401) {
      req.log.warn({ username }, "Got 401 — invalidating cached token and retrying");
      invalidateCachedToken(username);
      token = await getOrFreshToken();
      ({ status, body } = await fetchWithToken(
        token,
        "/game-panel/api/gpPanelServer/user/servers",
      ));
    }

    if (status >= 400) {
      res.status(status).json({
        error: "Upstream request failed",
        upstreamStatus: status,
        detail: body,
      });
      return;
    }

    res.json({ servers: body });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    req.log.error({ username, err }, "Servers fetch failed");
    res.status(500).json({ error: "Failed to fetch servers", detail: message });
  }
});

router.post("/profile", async (req: Request, res: Response) => {
  const { username, password } = req.body as {
    username?: string;
    password?: string;
  };

  if (!username || !password) {
    res.status(400).json({ error: "username and password are required" });
    return;
  }

  const proxy = getProxyFromEnv();

  const getOrFreshToken = async (): Promise<string> => {
    const cached = getCachedToken(username);
    if (cached) return cached;

    req.log.info({ username }, "No cached token — running browser auth");
    const fresh = await loginWithBrowser(username, password, proxy);
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

router.post("/extension-info/:serverId", async (req: Request, res: Response) => {
  const { username, password } = req.body as {
    username?: string;
    password?: string;
  };
  const { serverId } = req.params;

  if (!username || !password) {
    res.status(400).json({ error: "username and password are required" });
    return;
  }

  const proxy = getProxyFromEnv();

  const getOrFreshToken = async (): Promise<string> => {
    const cached = getCachedToken(username);
    if (cached) return cached;
    req.log.info({ username }, "No cached token — running browser auth");
    const fresh = await loginWithBrowser(username, password, proxy);
    setCachedToken(username, fresh);
    return fresh;
  };

  try {
    let token = await getOrFreshToken();

    let { status, body } = await fetchWithToken(
      token,
      `/game-panel/api/gp-free-server/extension-info/${serverId}`,
    );

    if (status === 401) {
      req.log.warn({ username }, "Got 401 — invalidating cached token and retrying");
      invalidateCachedToken(username);
      token = await getOrFreshToken();
      ({ status, body } = await fetchWithToken(
        token,
        `/game-panel/api/gp-free-server/extension-info/${serverId}`,
      ));
    }

    if (status >= 400) {
      res.status(status).json({ error: "Upstream request failed", upstreamStatus: status, detail: body });
      return;
    }

    res.json({ extensionInfo: body });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    req.log.error({ username, serverId, err }, "Extension info fetch failed");
    res.status(500).json({ error: "Failed to fetch extension info", detail: message });
  }
});

router.post("/extend/:serverId", async (req: Request, res: Response) => {
  const { username, password } = req.body as {
    username?: string;
    password?: string;
  };
  const { serverId } = req.params;

  if (!username || !password) {
    res.status(400).json({ error: "username and password are required" });
    return;
  }

  const proxy = getProxyFromEnv();

  const getOrFreshToken = async (): Promise<string> => {
    const cached = getCachedToken(username);
    if (cached) return cached;
    req.log.info({ username }, "No cached token — running browser auth");
    const fresh = await loginWithBrowser(username, password, proxy);
    setCachedToken(username, fresh);
    return fresh;
  };

  try {
    let token = await getOrFreshToken();

    let res2 = await httpClient.post(
      `https://www.bytenut.com/game-panel/api/gp-free-server/extend/${serverId}`,
      {},
      {
        headers: {
          Accept: "application/json, text/plain, */*",
          "yl-token": token,
          "Content-Type": "application/json",
        },
        validateStatus: () => true,
      },
    );

    if (res2.status === 401) {
      req.log.warn({ username }, "Got 401 on extend — retrying with fresh token");
      invalidateCachedToken(username);
      token = await getOrFreshToken();
      res2 = await httpClient.post(
        `https://www.bytenut.com/game-panel/api/gp-free-server/extend/${serverId}`,
        {},
        {
          headers: {
            Accept: "application/json, text/plain, */*",
            "yl-token": token,
            "Content-Type": "application/json",
          },
          validateStatus: () => true,
        },
      );
    }

    if (res2.status >= 400) {
      res.status(res2.status).json({ error: "Upstream request failed", upstreamStatus: res2.status, detail: res2.data });
      return;
    }

    res.json({ result: res2.data });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    req.log.error({ username, serverId, err }, "Extend server failed");
    res.status(500).json({ error: "Failed to extend server", detail: message });
  }
});

export default router;
