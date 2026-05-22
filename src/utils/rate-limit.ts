import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Shared distributed rate limiter using Upstash Redis.
// Falls back to in-memory (single-instance) if UPSTASH env vars are not set.
// In-memory fallback is intentional for local dev; production MUST set Upstash vars.

function makeRedisRatelimit(requests: number, windowSeconds: number): Ratelimit | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;

  const redis = new Redis({ url, token });
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, `${windowSeconds}s`),
    analytics: false,
  });
}

// Sliding-window rate limiters for each endpoint family.
// In production these share state across all Vercel instances — no per-instance bypass.
const workerLoginLimiter = makeRedisRatelimit(5, 60);        // 5/min
const workerLoginPhoneLimiter = makeRedisRatelimit(5, 60);   // 5/min per phone
const adminSignupLimiter = makeRedisRatelimit(3, 600);       // 3/10min
const qrEntryLimiter = makeRedisRatelimit(10, 60);           // 10/min
const nfcEntryLimiter = makeRedisRatelimit(20, 60);          // 20/min per IP
const translateLimiter = makeRedisRatelimit(60, 60);         // 60/min per user/IP (4x paid API calls)

// In-memory fallback (single-instance only — acceptable for dev/staging)
const inMemoryMap = new Map<string, { count: number; resetAt: number }>();
function inMemoryCheck(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = inMemoryMap.get(key);
  if (!entry || now > entry.resetAt) {
    inMemoryMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count++;
  return true;
}

async function check(limiter: Ratelimit | null, key: string, max: number, windowMs: number): Promise<boolean> {
  if (limiter) {
    const { success } = await limiter.limit(key);
    return success;
  }
  return inMemoryCheck(key, max, windowMs);
}

export async function checkWorkerLoginLimit(ip: string): Promise<boolean> {
  return check(workerLoginLimiter, `wl:ip:${ip}`, 5, 60_000);
}

export async function checkWorkerLoginPhoneLimit(phoneDigits: string): Promise<boolean> {
  return check(workerLoginPhoneLimiter, `wl:phone:${phoneDigits}`, 5, 60_000);
}

export async function checkAdminSignupLimit(ip: string): Promise<boolean> {
  return check(adminSignupLimiter, `as:ip:${ip}`, 3, 600_000);
}

export async function checkQrEntryLimit(ip: string): Promise<boolean> {
  return check(qrEntryLimiter, `qr:ip:${ip}`, 10, 60_000);
}

export async function checkNfcEntryLimit(ip: string): Promise<boolean> {
  return check(nfcEntryLimiter, `nfc:ip:${ip}`, 20, 60_000);
}

export async function checkTranslateLimit(key: string): Promise<boolean> {
  return check(translateLimiter, `tl:${key}`, 60, 60_000);
}
