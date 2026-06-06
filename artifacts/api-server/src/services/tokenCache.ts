export interface CachedSession {
  token: string;
  cookies: string;
  cachedAt: number;
  profile: unknown;
  servers: unknown;
}

const tokenCache = new Map<string, CachedSession>();
const loginInFlight = new Map<string, Promise<CachedSession>>();

const TTL_MS = 60 * 60 * 1000;

export function getCachedSession(username: string): CachedSession | null {
  const entry = tokenCache.get(username);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > TTL_MS) {
    tokenCache.delete(username);
    return null;
  }
  return entry;
}

/** @deprecated Use getCachedSession */
export function getCachedToken(username: string): string | null {
  return getCachedSession(username)?.token ?? null;
}

export function setCachedSession(username: string, session: Omit<CachedSession, "cachedAt">): void {
  tokenCache.set(username, { ...session, cachedAt: Date.now() });
}

export function invalidateCachedToken(username: string): void {
  tokenCache.delete(username);
  loginInFlight.delete(username);
}

export function getCacheSize(): number {
  return tokenCache.size;
}

export function getOrAcquireSession(
  username: string,
  doLogin: () => Promise<CachedSession>,
): Promise<CachedSession> {
  const cached = getCachedSession(username);
  if (cached) return Promise.resolve(cached);

  const existing = loginInFlight.get(username);
  if (existing) return existing;

  const promise = doLogin().then(
    (session) => {
      setCachedSession(username, session);
      loginInFlight.delete(username);
      return session;
    },
    (err) => {
      loginInFlight.delete(username);
      throw err;
    },
  );

  loginInFlight.set(username, promise);
  return promise;
}
