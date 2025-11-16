import prisma from "../db/client";

export interface TokenCacheRecord {
  token: string;
  expiresAt: number;
}

export interface TokenCache {
  get(): Promise<TokenCacheRecord | null>;
  set(record: TokenCacheRecord): Promise<void>;
  clear(): Promise<void>;
}

export class MemoryTokenCache implements TokenCache {
  private record: TokenCacheRecord | null = null;

  async get(): Promise<TokenCacheRecord | null> {
    return this.record;
  }

  async set(record: TokenCacheRecord): Promise<void> {
    this.record = record;
  }

  async clear(): Promise<void> {
    this.record = null;
  }
}

const TOKEN_CACHE_KEY = "airalo:access_token";

class RestRedisTokenCache implements TokenCache {
  constructor(private readonly client: RestRedisClient, private readonly key: string) {}

  async get(): Promise<TokenCacheRecord | null> {
    const value = await this.client.get(this.key);
    if (!value) {
      return null;
    }

    try {
      const parsed = JSON.parse(value) as TokenCacheRecord;
      if (typeof parsed?.token === "string" && typeof parsed?.expiresAt === "number") {
        return parsed;
      }
    } catch {
      // ignore malformed cache entries
    }

    return null;
  }

  async set(record: TokenCacheRecord): Promise<void> {
    const ttlMs = Math.max(record.expiresAt - Date.now(), 0);
    await this.client.set(this.key, JSON.stringify(record), ttlMs > 0 ? ttlMs : undefined);
  }

  async clear(): Promise<void> {
    await this.client.delete(this.key);
  }
}

class RestRedisClient {
  constructor(private readonly baseUrl: string, private readonly token: string) {}

  async get(key: string): Promise<string | null> {
    return this.executeCommand<string | null>("GET", key);
  }

  async set(key: string, value: string, ttlMs?: number): Promise<void> {
    const args = ["SET", key, value];
    if (ttlMs !== undefined) {
      const bounded = Math.max(1, Math.floor(ttlMs));
      args.push("PX", String(bounded));
    }

    await this.executeCommand(...args);
  }

  async delete(key: string): Promise<void> {
    await this.executeCommand("DEL", key);
  }

  private async executeCommand<T = unknown>(...command: string[]): Promise<T> {
    const response = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Redis REST command failed with status ${response.status}: ${text || response.statusText}`,
      );
    }

    const payload = (await response.json()) as { result?: T; error?: string };

    if (payload.error) {
      throw new Error(payload.error);
    }

    return (payload.result ?? null) as T;
  }
}

class PrismaTokenCache implements TokenCache {
  constructor(private readonly key: string) {}

  async get(): Promise<TokenCacheRecord | null> {
    const record = await prisma.airaloAccessToken.findUnique({ where: { key: this.key } });
    if (!record) {
      return null;
    }

    return {
      token: record.token,
      expiresAt: record.expiresAt.getTime(),
    };
  }

  async set(record: TokenCacheRecord): Promise<void> {
    await prisma.airaloAccessToken.upsert({
      where: { key: this.key },
      create: {
        key: this.key,
        token: record.token,
        expiresAt: new Date(record.expiresAt),
      },
      update: {
        token: record.token,
        expiresAt: new Date(record.expiresAt),
      },
    });
  }

  async clear(): Promise<void> {
    await prisma.airaloAccessToken.deleteMany({ where: { key: this.key } });
  }
}

function isKvConfigured(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

function isUpstashRedisConfigured(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

function createKvCache(): TokenCache {
  const url = process.env.KV_REST_API_URL!;
  const token = process.env.KV_REST_API_TOKEN!;
  return new RestRedisTokenCache(new RestRedisClient(url, token), TOKEN_CACHE_KEY);
}

function createUpstashRedisCache(): TokenCache {
  const url = process.env.UPSTASH_REDIS_REST_URL!;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
  return new RestRedisTokenCache(new RestRedisClient(url, token), TOKEN_CACHE_KEY);
}

function createPrismaCache(): TokenCache {
  return new PrismaTokenCache(TOKEN_CACHE_KEY);
}

const globalTokenCache = globalThis as typeof globalThis & {
  airaloTokenCache?: TokenCache;
};

export function resolveSharedTokenCache(): TokenCache {
  if (globalTokenCache.airaloTokenCache) {
    return globalTokenCache.airaloTokenCache;
  }

  let cache: TokenCache;

  if (isKvConfigured()) {
    cache = createKvCache();
  } else if (isUpstashRedisConfigured()) {
    cache = createUpstashRedisCache();
  } else {
    cache = createPrismaCache();
  }

  globalTokenCache.airaloTokenCache = cache;
  return cache;
}
