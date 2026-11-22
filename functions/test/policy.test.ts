import { describe, expect, it } from 'vitest';
import { claimsAcceptable, originAllowed, takeQuota } from '../src/policy.js';

describe('takeQuota', () => {
  const L = { perUserPerHour: 2, windowMs: 1000 };
  it('allows up to the limit then blocks within the window', () => {
    let q = takeQuota(undefined, 0, L); expect(q.allowed).toBe(true);
    q = takeQuota(q.next, 10, L); expect(q.allowed).toBe(true);
    const blocked = takeQuota(q.next, 20, L);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBe(1);
  });
  it('resets after the window', () => {
    expect(takeQuota({ windowStart: 0, count: 2 }, 1000, L)).toMatchObject({ allowed: true, next: { windowStart: 1000, count: 1 } });
  });
});

describe('originAllowed', () => {
  const rules = 'chrome-extension://abcdefghijklmnop,moz-extension://*';
  it('matches exact and wildcard rules', () => {
    expect(originAllowed('chrome-extension://abcdefghijklmnop', rules)).toBe(true);
    expect(originAllowed('moz-extension://1b2c3d4e-0000-4000-8000-123456789abc', rules)).toBe(true);
  });
  it('rejects others', () => {
    expect(originAllowed('chrome-extension://zzzz', rules)).toBe(false);
    expect(originAllowed('https://evil.example', rules)).toBe(false);
    expect(originAllowed('moz-extension://', rules)).toBe(false);
    expect(originAllowed(undefined, rules)).toBe(false);
    expect(originAllowed('chrome-extension://abcdefghijklmnop', '')).toBe(false);
  });
});

describe('claimsAcceptable', () => {
  it('needs a provider and auth_time', () => {
    expect(claimsAcceptable({ firebase: { sign_in_provider: 'anonymous' }, auth_time: 100 }, 200)).toBe(true);
    expect(claimsAcceptable({ auth_time: 100 }, 200)).toBe(false);
    expect(claimsAcceptable({ firebase: { sign_in_provider: 'anonymous' } }, 200)).toBe(false);
  });
});
