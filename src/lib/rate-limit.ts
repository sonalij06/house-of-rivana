/**
 * In-memory sliding-window limiter. Good enough for a single Node process and for
 * blunting form abuse; swap the store for Upstash Redis when the app runs on more
 * than one instance (the interface below is deliberately trivial to reimplement).
 */

type Bucket = { hits: number[]; };

const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

function sweep(windowMs: number) {
  const now = Date.now();
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    bucket.hits = bucket.hits.filter((t) => now - t < windowMs);
    if (bucket.hits.length === 0) buckets.delete(key);
  }
}

export async function checkRateLimit(
  key: string,
  options: { max: number; windowMs: number },
): Promise<{ allowed: boolean; remaining: number; retryAfterMs: number }> {
  const now = Date.now();
  sweep(options.windowMs);

  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < options.windowMs);

  if (bucket.hits.length >= options.max) {
    const oldest = bucket.hits[0];
    buckets.set(key, bucket);
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: options.windowMs - (now - oldest),
    };
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);
  return {
    allowed: true,
    remaining: options.max - bucket.hits.length,
    retryAfterMs: 0,
  };
}
