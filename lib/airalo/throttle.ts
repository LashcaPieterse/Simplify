export type AiraloThrottledEndpoint =
  | "token"
  | "packages"
  | "sim_usage"
  | "sim_packages";

export interface EndpointThrottleRule {
  endpoint: AiraloThrottledEndpoint;
  key: string;
  limit: number;
  windowMs: number;
}

export interface EndpointRateLimiter {
  acquire(rule: EndpointThrottleRule): Promise<void>;
}

class InMemoryEndpointRateLimiter implements EndpointRateLimiter {
  private readonly buckets = new Map<string, number[]>();
  private readonly chains = new Map<string, Promise<void>>();

  async acquire(rule: EndpointThrottleRule): Promise<void> {
    const limit = Math.max(0, Math.floor(rule.limit));
    const windowMs = Math.max(1, Math.floor(rule.windowMs));

    if (limit <= 0) {
      return;
    }

    const bucketKey = this.buildBucketKey(rule.endpoint, rule.key, limit, windowMs);
    const previous = this.chains.get(bucketKey) ?? Promise.resolve();
    const current = previous.then(() => this.waitForSlot(bucketKey, limit, windowMs));

    this.chains.set(bucketKey, current.catch(() => {}));

    try {
      await current;
    } finally {
      if (this.chains.get(bucketKey) === current) {
        this.chains.delete(bucketKey);
      }
    }
  }

  private buildBucketKey(
    endpoint: AiraloThrottledEndpoint,
    key: string,
    limit: number,
    windowMs: number,
  ): string {
    return `${endpoint}:${key}:${limit}:${windowMs}`;
  }

  private async waitForSlot(
    bucketKey: string,
    limit: number,
    windowMs: number,
  ): Promise<void> {
    while (true) {
      const now = Date.now();
      const cutoff = now - windowMs;
      const timestamps = this.buckets.get(bucketKey) ?? [];

      while (timestamps.length > 0 && timestamps[0]! <= cutoff) {
        timestamps.shift();
      }

      if (timestamps.length < limit) {
        timestamps.push(now);
        this.buckets.set(bucketKey, timestamps);
        return;
      }

      const oldest = timestamps[0]!;
      const waitMs = Math.max(oldest + windowMs - now, 1);
      await sleep(waitMs);
    }
  }
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => setTimeout(resolve, ms));
}

const globalLimiter = globalThis as typeof globalThis & {
  airaloEndpointRateLimiter?: EndpointRateLimiter;
};

export function resolveEndpointRateLimiter(): EndpointRateLimiter {
  if (!globalLimiter.airaloEndpointRateLimiter) {
    globalLimiter.airaloEndpointRateLimiter = new InMemoryEndpointRateLimiter();
  }

  return globalLimiter.airaloEndpointRateLimiter;
}
