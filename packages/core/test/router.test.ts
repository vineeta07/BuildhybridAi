import { describe, expect, it } from 'vitest';
import { classifyError, nextRung, route } from '../src/router';
import type { RouterInput } from '../src/types';

const base: RouterInput = {
  userMode: 'smart', status: 'available', simulateNoOnDevice: false, lang: 'en', chars: 2000,
  hasPersonalData: false, online: true, cloudEnabled: true, onDeviceMaxChars: 9000,
};
const r = (o: Partial<RouterInput>) => route({ ...base, ...o });

describe('router decision table', () => {
  it('1: Private mode stays on device', () => {
    expect(r({ userMode: 'private' })).toMatchObject({ sdkMode: 'ONLY_ON_DEVICE', reason: 'USER_PRIVATE', redact: false });
    expect(r({ userMode: 'private', status: 'unavailable' })).toMatchObject({ sdkMode: 'ONLY_ON_DEVICE', reason: 'USER_PRIVATE' });
  });
  it('2: Remote Config kill switch', () => {
    expect(r({ cloudEnabled: false })).toMatchObject({ sdkMode: 'ONLY_ON_DEVICE', reason: 'RC_CLOUD_OFF' });
    expect(r({ cloudEnabled: false, status: 'unavailable' })).toMatchObject({ sdkMode: 'NONE', reason: 'RC_CLOUD_OFF' });
    expect(r({ cloudEnabled: false, userMode: 'cloud' })).toMatchObject({ reason: 'RC_CLOUD_OFF' });
  });
  it('3: Cloud only', () => {
    expect(r({ userMode: 'cloud' })).toMatchObject({ sdkMode: 'ONLY_IN_CLOUD', reason: 'USER_CLOUD', redact: true, needsConsent: true });
    expect(r({ userMode: 'cloud', online: false })).toMatchObject({ sdkMode: 'NONE', reason: 'OFFLINE_NO_MODEL' });
  });
  it('4: Best quality', () => {
    expect(r({ userMode: 'quality' })).toMatchObject({ sdkMode: 'PREFER_IN_CLOUD', reason: 'USER_QUALITY', redact: true });
  });
  it('5: on-device OK, no personal data -> PREFER_ON_DEVICE', () => {
    expect(r({})).toMatchObject({ sdkMode: 'PREFER_ON_DEVICE', reason: 'ON_DEVICE_OK_LOW_RISK', redact: false });
  });
  it('6: on-device OK with personal data -> ONLY_ON_DEVICE', () => {
    expect(r({ hasPersonalData: true })).toMatchObject({ sdkMode: 'ONLY_ON_DEVICE', reason: 'ON_DEVICE_OK' });
  });
  it('7: model downloadable or downloading', () => {
    expect(r({ status: 'downloadable' })).toMatchObject({ sdkMode: 'ONLY_IN_CLOUD', reason: 'MODEL_NOT_READY', needsConsent: true });
    expect(r({ status: 'downloading' })).toMatchObject({ reason: 'MODEL_NOT_READY' });
  });
  it('8: unsupported language', () => {
    expect(r({ lang: 'hi' })).toMatchObject({ sdkMode: 'ONLY_IN_CLOUD', reason: 'LANG_UNSUPPORTED', redact: true });
    expect(r({ lang: 'en-IN' })).toMatchObject({ reason: 'ON_DEVICE_OK_LOW_RISK' });
  });
  it('9: too long even for the radar', () => {
    expect(r({ chars: 9000 * 6 + 1 })).toMatchObject({ sdkMode: 'ONLY_IN_CLOUD', reason: 'TOO_LONG' });
  });
  it('radar is used for long-but-not-too-long text', () => {
    expect(r({ chars: 20_000 })).toMatchObject({ sdkMode: 'PREFER_ON_DEVICE', useRadar: true });
  });
  it('10: unavailable', () => {
    expect(r({ status: 'unavailable' })).toMatchObject({ sdkMode: 'ONLY_IN_CLOUD', reason: 'NO_ON_DEVICE' });
  });
  it('10: simulation switch forces the cloud route', () => {
    expect(r({ simulateNoOnDevice: true })).toMatchObject({ sdkMode: 'ONLY_IN_CLOUD', reason: 'NO_ON_DEVICE', redact: true });
  });
  it('11: offline with no model', () => {
    expect(r({ online: false, status: 'unavailable' })).toMatchObject({ sdkMode: 'NONE', reason: 'OFFLINE_NO_MODEL' });
  });
  it('offline with a model still runs on-device', () => {
    expect(r({ online: false })).toMatchObject({ sdkMode: 'PREFER_ON_DEVICE' });
  });
  it('every cloud decision redacts and asks consent', () => {
    for (const o of [{ userMode: 'cloud' as const }, { userMode: 'quality' as const }, { lang: 'hi' }, { status: 'unavailable' as const }]) {
      const d = r(o);
      expect(d.redact).toBe(true);
      expect(d.needsConsent).toBe(true);
    }
  });
});

describe('failure ladder', () => {
  const ctx = { cloudEnabled: true, online: true, onDeviceReady: true, userMode: 'smart' as const, schemaRetried: false };
  const local = route(base);
  const cloud = route({ ...base, status: 'unavailable' });

  it('on-device size error retries once at 60%', () => {
    const n = nextRung(local, 'size', { ...ctx, tried: ['PREFER_ON_DEVICE'] });
    expect(n.shrink).toBe(true);
    expect(n.sdkMode).toBe('PREFER_ON_DEVICE');
    const n2 = nextRung(local, 'size', { ...ctx, tried: ['PREFER_ON_DEVICE', 'PREFER_ON_DEVICE'] });
    expect(n2.sdkMode).toBe('ONLY_IN_CLOUD');
    expect(n2.redact).toBe(true);
  });
  it('on-device other error goes to cloud (redacted) when allowed', () => {
    const n = nextRung(local, 'other', { ...ctx, tried: ['PREFER_ON_DEVICE'] });
    expect(n).toMatchObject({ sdkMode: 'ONLY_IN_CLOUD', redact: true, needsConsent: true });
  });
  it('on-device error in Private mode falls to Tier-0', () => {
    expect(nextRung(local, 'other', { ...ctx, userMode: 'private', tried: ['ONLY_ON_DEVICE'] }).sdkMode).toBe('NONE');
  });
  it('on-device error with cloud off falls to Tier-0', () => {
    expect(nextRung(local, 'other', { ...ctx, cloudEnabled: false, tried: ['ONLY_ON_DEVICE'] }).sdkMode).toBe('NONE');
  });
  it('cloud error tries on-device if not tried', () => {
    expect(nextRung(cloud, 'other', { ...ctx, tried: ['ONLY_IN_CLOUD'] }).sdkMode).toBe('ONLY_ON_DEVICE');
    expect(nextRung(cloud, 'other', { ...ctx, tried: ['ONLY_ON_DEVICE', 'ONLY_IN_CLOUD'] }).sdkMode).toBe('NONE');
    expect(nextRung(cloud, 'other', { ...ctx, onDeviceReady: false, tried: ['ONLY_IN_CLOUD'] }).sdkMode).toBe('NONE');
  });
  it('invalid JSON retries once on the same route, then switches', () => {
    const n = nextRung(local, 'parse', { ...ctx, tried: ['PREFER_ON_DEVICE'] });
    expect(n).toMatchObject({ sdkMode: 'PREFER_ON_DEVICE', schemaRetry: true });
    expect(nextRung(local, 'parse', { ...ctx, schemaRetried: true, tried: ['PREFER_ON_DEVICE', 'PREFER_ON_DEVICE'] }).sdkMode).toBe('ONLY_IN_CLOUD');
  });
  it('classifies errors', () => {
    expect(classifyError(new Error('The input is too large'))).toBe('size');
    expect(classifyError(new Error('QuotaExceededError'))).toBe('size');
    expect(classifyError(new Error('network down'))).toBe('other');
    const pe = new Error('x'); pe.name = 'ParseError';
    expect(classifyError(pe)).toBe('parse');
  });
});
