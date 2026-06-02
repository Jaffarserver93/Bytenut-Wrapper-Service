import { Router, type IRouter, type Request, type Response } from "express";
import { loginWithBrowser } from "../../services/authService.js";
import {
  getCachedToken,
  setCachedToken,
} from "../../services/tokenCache.js";

const router: IRouter = Router();

router.post("/login", async (req: Request, res: Response) => {
  const { username, password } = req.body as {
    username?: string;
    password?: string;
  };

  if (!username || !password) {
    res.status(400).json({
      error: "username and password are required",
    });
    return;
  }

  const cached = getCachedToken(username);
  if (cached) {
    req.log.info({ username }, "Returning cached yl-token");
    res.json({ ylToken: cached, cached: true });
    return;
  }

  try {
    req.log.info({ username }, "No cached token — starting browser auth");
    const ylToken = await loginWithBrowser(username, password);
    setCachedToken(username, ylToken);
    res.json({ ylToken, cached: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    req.log.error({ username, err }, "Login via browser failed");
    res.status(500).json({ error: "Authentication failed", detail: message });
  }
});

export default router;
