export interface CachedSession {
  token: string;
  cookies: string;
  cachedAt: number;
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

export function setCachedSession(username: string, token: string, cookies: string): void {
  tokenCache.set(username, { token, cookies, cachedAt: Date.now() });
}

export function invalidateCachedToken(username: string): void {
  tokenCache.delete(username);
  loginInFlight.delete(username);
}

export function getCacheSize(): number {
  return tokenCache.size;
}

/**
 * Ensures only ONE browser login runs at a time per user.
 * If a login is already in progress, all callers await the same promise
 * instead of each launching their own browser session.
 */
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
      setCachedSession(username, session.token, session.cookies);
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

/** Legacy shim for callers that only need the token string. */
export function getOrAcquireToken(
  username: string,
  doLogin: () => Promise<string>,
): Promise<string> {
  const cached = getCachedSession(username);
  if (cached) return Promise.resolve(cached.token);

  const existing = loginInFlight.get(username);
  if (existing) return existing.then((s) => s.token);

  const promise = (async () => {
    const token = await doLogin();
    const session: CachedSession = { token, cookies: "", cachedAt: Date.now() };
    setCachedSession(username, token, "");
    return session;
  })().then(
    (session) => {
      loginInFlight.delete(username);
      return session;
    },
    (err) => {
      loginInFlight.delete(username);
      throw err;
    },
  );

  loginInFlight.set(username, promise);
  return promise.then((s) => s.token);
}
