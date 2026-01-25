import "server-only";

interface RateLimitEntry {
  count: number;
  firstRequest: number;
}

interface DailyQuotaEntry {
  count: number;
  date: string;
}

const rateLimitStore = new Map<string, RateLimitEntry>();
const dailyQuotaStore = new Map<string, DailyQuotaEntry>();
const tenantQuotaStore = new Map<string, DailyQuotaEntry>();

const CLEANUP_INTERVAL = 60000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  
  lastCleanup = now;
  const expireTime = now - 3600000;
  const today = getToday();
  
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.firstRequest < expireTime) {
      rateLimitStore.delete(key);
    }
  }

  for (const [key, entry] of dailyQuotaStore.entries()) {
    if (entry.date !== today) {
      dailyQuotaStore.delete(key);
    }
  }

  for (const [key, entry] of tenantQuotaStore.entries()) {
    if (entry.date !== today) {
      tenantQuotaStore.delete(key);
    }
  }
}

function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export interface QuotaConfig {
  dailyLimit: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  reason?: "rate_limit" | "daily_quota" | "tenant_quota";
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
      reason: "rate_limit",
    };
  }
  
  entry.count++;
  return {
    allowed: true,
    remaining: Math.max(0, remaining),
    resetAt,
  };
}

export function checkDailyQuota(
  userId: string,
  config: QuotaConfig
): RateLimitResult {
  cleanup();
  
  const today = getToday();
  const key = `daily:${userId}`;
  const entry = dailyQuotaStore.get(key);
  
  if (!entry || entry.date !== today) {
    dailyQuotaStore.set(key, { count: 1, date: today });
    return {
      allowed: true,
      remaining: config.dailyLimit - 1,
      resetAt: getEndOfDay(),
    };
  }
  
  if (entry.count >= config.dailyLimit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: getEndOfDay(),
      reason: "daily_quota",
    };
  }
  
  entry.count++;
  return {
    allowed: true,
    remaining: config.dailyLimit - entry.count,
    resetAt: getEndOfDay(),
  };
}

export function checkTenantQuota(
  tenantId: string,
  dailyLimit: number
): RateLimitResult {
  cleanup();
  
  const today = getToday();
  const key = `tenant:${tenantId}`;
  const entry = tenantQuotaStore.get(key);
  
  if (!entry || entry.date !== today) {
    tenantQuotaStore.set(key, { count: 1, date: today });
    return {
      allowed: true,
      remaining: dailyLimit - 1,
      resetAt: getEndOfDay(),
    };
  }
  
  if (entry.count >= dailyLimit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: getEndOfDay(),
      reason: "tenant_quota",
    };
  }
  
  entry.count++;
  return {
    allowed: true,
    remaining: dailyLimit - entry.count,
    resetAt: getEndOfDay(),
  };
}

function getEndOfDay(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
}

export function getUserDailyUsage(userId: string): number {
  const key = `daily:${userId}`;
  const entry = dailyQuotaStore.get(key);
  const today = getToday();
  
  if (!entry || entry.date !== today) return 0;
  return entry.count;
}

export function getTenantDailyUsage(tenantId: string): number {
  const key = `tenant:${tenantId}`;
  const entry = tenantQuotaStore.get(key);
  const today = getToday();
  
  if (!entry || entry.date !== today) return 0;
  return entry.count;
}

export const CV_ANALYSIS_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60000,
  maxRequests: 10,
};

export const CV_UPLOAD_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60000,
  maxRequests: 20,
};

export const CV_DAILY_QUOTA: QuotaConfig = {
  dailyLimit: 100,
};

export const DEFAULT_TENANT_DAILY_QUOTA = 500;
