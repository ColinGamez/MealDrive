import { RequestHandler } from 'express';

export interface RateLimitOptions {
  max: number;
  windowMs: number;
  message: string;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export function createRateLimiter(options: RateLimitOptions): RequestHandler {
  const entries = new Map<string, RateLimitEntry>();
  let requestsSinceSweep = 0;

  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    let entry = entries.get(key);

    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + options.windowMs };
      entries.set(key, entry);
    }

    requestsSinceSweep += 1;
    if (requestsSinceSweep >= 100) {
      requestsSinceSweep = 0;
      for (const [entryKey, value] of entries) {
        if (value.resetAt <= now) entries.delete(entryKey);
      }
    }

    const resetSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
    const remaining = Math.max(0, options.max - entry.count - 1);
    res.setHeader('RateLimit-Limit', String(options.max));
    res.setHeader('RateLimit-Remaining', String(remaining));
    res.setHeader('RateLimit-Reset', String(resetSeconds));

    if (entry.count >= options.max) {
      res.setHeader('Retry-After', String(resetSeconds));
      res.status(429).json({ message: options.message, retryAfterSeconds: resetSeconds });
      return;
    }

    entry.count += 1;
    next();
  };
}
