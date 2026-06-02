export interface CachedToken {
  token: string;
  cachedAt: number;
}

const tokenCache = new Map<string, CachedToken>();

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
}

export function getCacheSize(): number {
  return tokenCache.size;
}
