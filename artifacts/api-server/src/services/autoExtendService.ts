import { logger } from "../lib/logger.js";
import {
  getCachedSession,
  setCachedSession,
  type CachedSession,
} from "./tokenCache.js";
import {
  loginWithBrowser,
  extendServerWithBrowser,
  browserFetch,
  getProxyFromEnv,
} from "./authService.js";

const POLL_INTERVAL_MS = 60_000;

export interface AutoExtendConfig {
  username: string;
  password: string;
  serverId: string;
  thresholdMinutes: number;
  enabled: boolean;
  lastExtendedAt: number | null;
  lastError: string | null;
  status: "idle" | "extending" | "cooldown" | "disabled";
}

const configs = new Map<string, AutoExtendConfig>();
const extending = new Set<string>();

function configKey(username: string, serverId: string): string {
  return `${username}:${serverId}`;
}

export function setAutoExtendConfig(
  username: string,
  password: string,
  serverId: string,
  enabled: boolean,
  thresholdMinutes: number,
): AutoExtendConfig {
  const key = configKey(username, serverId);
  const existing = configs.get(key);
  const config: AutoExtendConfig = {
    username,
    password,
    serverId,
    thresholdMinutes,
    enabled,
    lastExtendedAt: existing?.lastExtendedAt ?? null,
    lastError: existing?.lastError ?? null,
    status: enabled ? "idle" : "disabled",
  };
  configs.set(key, config);
  logger.info({ username, serverId, enabled, thresholdMinutes }, "Auto-extend config updated");
  return config;
}

export function getAutoExtendConfig(
  username: string,
  serverId: string,
): AutoExtendConfig | null {
  return configs.get(configKey(username, serverId)) ?? null;
}

export function getAllConfigs(): AutoExtendConfig[] {
  return Array.from(configs.values());
}

async function getOrFreshSession(username: string, password: string): Promise<CachedSession> {
  const cached = getCachedSession(username);
  if (cached) return cached;
  logger.info({ username }, "[auto-extend] No cached session — running browser auth");
  const proxy = getProxyFromEnv();
  const { ylToken, cookieHeader, profile, servers } = await loginWithBrowser(username, password, proxy);
  setCachedSession(username, { token: ylToken, cookies: cookieHeader, profile, servers });
  return { token: ylToken, cookies: cookieHeader, cachedAt: Date.now(), profile, servers };
}

async function fetchExtensionInfo(
  session: CachedSession,
  serverId: string,
): Promise<{ minutesUntilExpiration: number; canExtend: boolean } | null> {
  try {
    const proxy = getProxyFromEnv();
    const result = await browserFetch(
      `/game-panel/api/gp-free-server/extension-info/${serverId}`,
      session.token,
      proxy,
    ) as { data?: { minutesUntilExpiration: number; canExtend: boolean } } | null;
    return result?.data ?? null;
  } catch {
    return null;
  }
}

async function runAutoExtendForConfig(config: AutoExtendConfig): Promise<void> {
  const key = configKey(config.username, config.serverId);

  if (extending.has(key)) {
    logger.info({ key }, "[auto-extend] Extend already in progress, skipping");
    return;
  }

  try {
    const session = await getOrFreshSession(config.username, config.password);
    const info = await fetchExtensionInfo(session, config.serverId);

    if (!info) {
      logger.warn({ key }, "[auto-extend] Could not fetch extension info");
      return;
    }

    const cfg = configs.get(key);
    if (!cfg) return;

    if (!info.canExtend) {
      cfg.status = "cooldown";
      logger.info(
        { key, minutesUntilExpiration: info.minutesUntilExpiration },
        "[auto-extend] canExtend=false (cooldown active)",
      );
      return;
    }

    if (info.minutesUntilExpiration > cfg.thresholdMinutes) {
      cfg.status = "idle";
      logger.info(
        { key, minutesUntilExpiration: info.minutesUntilExpiration, threshold: cfg.thresholdMinutes },
        "[auto-extend] Above threshold, no extend needed",
      );
      return;
    }

    logger.info(
      { key, minutesUntilExpiration: info.minutesUntilExpiration, threshold: cfg.thresholdMinutes },
      "[auto-extend] Below threshold — triggering browser extend",
    );

    extending.add(key);
    cfg.status = "extending";

    const proxy = getProxyFromEnv();
    const result = await extendServerWithBrowser(config.serverId, session.token, proxy);

    cfg.lastExtendedAt = Date.now();
    cfg.lastError = result.success ? null : result.message;
    cfg.status = "idle";

    logger.info({ key, success: result.success, message: result.message }, "[auto-extend] Extend result");
  } catch (err) {
    const cfg = configs.get(key);
    if (cfg) {
      cfg.lastError = err instanceof Error ? err.message : String(err);
      cfg.status = "idle";
    }
    logger.error({ key, err }, "[auto-extend] Error during auto-extend");
  } finally {
    extending.delete(key);
  }
}

async function pollAll(): Promise<void> {
  const enabled = Array.from(configs.values()).filter((c) => c.enabled);
  if (enabled.length === 0) return;
  logger.info({ count: enabled.length }, "[auto-extend] Polling configs");
  await Promise.allSettled(enabled.map((c) => runAutoExtendForConfig(c)));
}

let pollTimer: ReturnType<typeof setInterval> | null = null;

export function startAutoExtendPoller(): void {
  if (pollTimer) return;
  pollTimer = setInterval(() => {
    pollAll().catch((err) =>
      logger.error({ err }, "[auto-extend] Unhandled error in poll"),
    );
  }, POLL_INTERVAL_MS);
  logger.info({ intervalMs: POLL_INTERVAL_MS }, "[auto-extend] Poller started");
}

export function stopAutoExtendPoller(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}
