const cache = new Map();
const DEFAULT_TTL = 30_000;

export async function cachedJson(key, loader, ttl = DEFAULT_TTL) {
  const now = Date.now();
  const cached = cache.get(key);

  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const data = await loader();
  cache.set(key, {
    data,
    expiresAt: now + ttl,
  });

  return data;
}

export function invalidateCache(prefix = "") {
  for (const key of cache.keys()) {
    if (!prefix || key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
}
