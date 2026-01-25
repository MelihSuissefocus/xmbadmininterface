import "server-only";

interface RateLimitEntry {
  count: number;
  firstRequest: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

const CLEANUP_INTERVAL = 60000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  
  lastCleanup = now;
  const expireTime = now - 3600000;
  
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.firstRequest < expireTime) {
      rateLimitStore.delete(key);
    }
  }
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

export function checkRateLimit(
  identifier: string,
  action: string,
  config: RateLimitConfig
): RateLimitResult {
  cleanup();
  
  const key = `${action}:${identifier}`;
  const now = Date.now();
  const entry = rateLimitStore.get(key);
  
  if (!entry || now - entry.firstRequest >= config.windowMs) {
    rateLimitStore.set(key, { count: 1, firstRequest: now });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: new Date(now + config.windowMs),
    };
  }
  
  const remaining = config.maxRequests - entry.count - 1;
  const resetAt = new Date(entry.firstRequest + config.windowMs);
  
  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt,
    };
  }
  
  entry.count++;
  return {
    allowed: true,
    remaining: Math.max(0, remaining),
    resetAt,
  };
}

export const CV_ANALYSIS_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60000,
  maxRequests: 10,
};

export const CV_UPLOAD_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60000,
  maxRequests: 20,
};

