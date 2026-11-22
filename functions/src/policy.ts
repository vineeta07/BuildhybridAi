/**
 * Pure policy for the App Check token exchange, kept free of Firebase imports so it is unit-tested.
 */

export interface Quota { windowStart: number; count: number }
export interface Limits { perUserPerHour: number; windowMs: number }
export const DEFAULT_LIMITS: Limits = { perUserPerHour: 20, windowMs: 60 * 60 * 1000 };

/** Fixed-window rate limit. Returns whether to allow and the quota to store. */
export function takeQuota(prev: Quota | undefined, now: number, limits: Limits = DEFAULT_LIMITS):
  { allowed: boolean; next: Quota; retryAfterSec: number } {
  const fresh = !prev || now - prev.windowStart >= limits.windowMs;
  const cur: Quota = fresh ? { windowStart: now, count: 0 } : prev;
  if (cur.count >= limits.perUserPerHour) {
    return { allowed: false, next: cur, retryAfterSec: Math.ceil((cur.windowStart + limits.windowMs - now) / 1000) };
  }
  return { allowed: true, next: { windowStart: cur.windowStart, count: cur.count + 1 }, retryAfterSec: 0 };
}

/**
 * Origins allowed to call the exchange: the extension's own pages. `allowed` is a comma list
 * such as "chrome-extension://abcdef...,moz-extension://*". A trailing "*" allows any ID for
 * that scheme (Firefox gives each install a random UUID).
 */
export function originAllowed(origin: string | undefined, allowed: string): boolean {
  if (!origin) return false;
  return allowed.split(',').map((s) => s.trim()).filter(Boolean).some((rule) =>
    rule.endsWith('*') ? origin.startsWith(rule.slice(0, -1)) && origin.length > rule.length - 1 : origin === rule);
}

/** Only anonymous (or other Firebase) sign-ins with a recent auth_time are accepted. */
export function claimsAcceptable(c: { firebase?: { sign_in_provider?: string }; auth_time?: number }, nowSec: number): boolean {
  const provider = c.firebase?.sign_in_provider;
  if (!provider) return false;
  // Anonymous accounts that are months old are fine; reject tokens with no auth_time at all.
  return typeof c.auth_time === 'number' && c.auth_time <= nowSec + 60;
}

export const TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes (App Check allows 30 min to 7 days)
