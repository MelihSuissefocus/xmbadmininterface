import "server-only";

import { createHash } from "crypto";

interface DedupeEntry {
  result: unknown;
  createdAt: number;
  expiresAt: number;
}

const dedupeCache = new Map<string, DedupeEntry>();

const CLEANUP_INTERVAL = 300000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  
  lastCleanup = now;
  
  for (const [key, entry] of dedupeCache.entries()) {
    if (entry.expiresAt < now) {
      dedupeCache.delete(key);
    }
  }
}

export function computeFileHash(bytes: Uint8Array): string {
  const hash = createHash("sha256");
  hash.update(bytes);
  return hash.digest("hex");
}

export function getCachedResult(hash: string, userId: string): unknown | null {
  cleanup();
  
  const key = `${userId}:${hash}`;
  const entry = dedupeCache.get(key);
  
  if (!entry) return null;
  
  const now = Date.now();
  if (entry.expiresAt < now) {
    dedupeCache.delete(key);
    return null;
  }
  
  return entry.result;
}

export function setCachedResult(
  hash: string,
  userId: string,
  result: unknown,
  ttlMs: number = 3600000
): void {
  cleanup();
  
  const key = `${userId}:${hash}`;
  const now = Date.now();
  
  dedupeCache.set(key, {
    result,
    createdAt: now,
    expiresAt: now + ttlMs,
  });
}

export function invalidateCache(hash: string, userId: string): void {
  const key = `${userId}:${hash}`;
  dedupeCache.delete(key);
}

export function getCacheStats(): { size: number; oldestMs: number } {
  let oldest = Date.now();
  
  for (const entry of dedupeCache.values()) {
    if (entry.createdAt < oldest) {
      oldest = entry.createdAt;
    }
  }
  
  return {
    size: dedupeCache.size,
    oldestMs: dedupeCache.size > 0 ? Date.now() - oldest : 0,
  };
}

export const DEDUPE_TTL_MS = 3600000;

