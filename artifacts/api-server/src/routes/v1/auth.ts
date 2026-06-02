import { Router, type IRouter, type Request, type Response } from "express";
import { loginWithBrowser, getProxyFromEnv } from "../../services/authService.js";
import { getOrAcquireToken } from "../../services/tokenCache.js";

const router: IRouter = Router();

router.post("/login", async (req: Request, res: Response) => {
  const { username, password } = req.body as {
    username?: string;
    password?: string;
  };

  if (!username || !password) {
    res.status(400).json({ error: "username and password are required" });
    return;
  }

  try {
    const proxy = getProxyFromEnv();
    const ylToken = await getOrAcquireToken(username, () => {
      req.log.info({ username }, "No cached token — starting browser auth");
      return loginWithBrowser(username, password, proxy);
    });
    res.json({ ylToken, cached: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    req.log.error({ username, err }, "Login via browser failed");
    res.status(500).json({ error: "Authentication failed", detail: message });
  }
});

export default router;
