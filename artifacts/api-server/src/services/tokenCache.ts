export interface CachedToken {
  token: string;
  cachedAt: number;
}

const tokenCache = new Map<string, CachedToken>();
const loginInFlight = new Map<string, Promise<string>>();

const TTL_MS = 60 * 60 * 1000;

export function getCachedToken(username: string): string | null {
  const entry = tokenCache.get(username);
  if (!entry) return null;

  const age = Date.now() - entry.cachedAt;
  if (age > TTL_MS) {
    tokenCache.delete(username);
    return null;
  }

  return entry.token;
}

export function setCachedToken(username: string, token: string): void {
  tokenCache.set(username, { token, cachedAt: Date.now() });
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
export function getOrAcquireToken(
  username: string,
  doLogin: () => Promise<string>,
): Promise<string> {
  const cached = getCachedToken(username);
  if (cached) return Promise.resolve(cached);

  const existing = loginInFlight.get(username);
  if (existing) return existing;

  const promise = doLogin().then(
    (token) => {
      setCachedToken(username, token);
      loginInFlight.delete(username);
      return token;
    },
    (err) => {
      loginInFlight.delete(username);
      throw err;
    },
  );

  loginInFlight.set(username, promise);
  return promise;
}
