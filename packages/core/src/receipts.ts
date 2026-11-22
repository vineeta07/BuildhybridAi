import type { Receipt, ReasonCode, Source } from './types';

export const RECEIPT_LIMIT = 50;

export const REASON_SENTENCE: Record<ReasonCode, string> = {
  USER_PRIVATE: 'You chose Private mode, so this stayed on your device.',
  ON_DEVICE_OK: 'Your laptop can run Gemini Nano, so nothing was sent.',
  ON_DEVICE_OK_LOW_RISK: 'Your laptop can run Gemini Nano, so nothing was sent.',
  MODEL_NOT_READY: 'The on-device model is still downloading.',
  LANG_UNSUPPORTED: "This page's language is not supported on-device yet, so the cloud helped.",
  TOO_LONG: 'This document is too long for the on-device model.',
  NO_ON_DEVICE: 'This computer cannot run on-device AI, or it is turned off.',
  USER_CLOUD: 'You chose cloud or best-quality mode.',
  USER_QUALITY: 'You chose cloud or best-quality mode.',
  RC_CLOUD_OFF: 'Cloud checks are paused by the Satark team.',
  OFFLINE_NO_MODEL: 'You are offline and the on-device model is not ready, so only quick checks ran.',
};

export function reasonSentence(r: Pick<Receipt, 'decision' | 'simulated'>): string {
  const s = REASON_SENTENCE[r.decision.reason];
  return r.simulated ? `${s} (simulated)` : s;
}

const SOURCE_LABEL: Record<Source, string> = { 'on-device': 'On-device', cloud: 'Cloud', none: 'Quick check only' };

/** "On-device · Gemini Nano · 3.1 s · 0 characters sent" */
export function receiptChip(r: Receipt): string {
  const parts = [SOURCE_LABEL[r.actualSource]];
  if (r.actualSource !== 'none') parts.push(r.model.replace(' (Chrome)', ''));
  if (r.latencyMs > 0) parts.push(`${(r.latencyMs / 1000).toFixed(1)} s`);
  parts.push(`${r.charsSentToCloud.toLocaleString('en-US')} characters sent`);
  const hidden = Object.values(r.redactions).reduce((a, b) => a + b, 0);
  if (hidden > 0) parts.push(`${hidden} ${hidden === 1 ? 'item' : 'items'} hidden`);
  if (r.simulated) parts.push('simulated');
  return parts.join(' · ');
}

export interface Counters {
  checks: number; onDevice: number; cloud: number; tier0Only: number;
  charsKeptLocal: number; flags: number; verifiedFlags: number; droppedFlags: number;
}

export const EMPTY_COUNTERS: Counters = {
  checks: 0, onDevice: 0, cloud: 0, tier0Only: 0, charsKeptLocal: 0, flags: 0, verifiedFlags: 0, droppedFlags: 0,
};

export function addToCounters(c: Counters, r: Receipt): Counters {
  return {
    checks: c.checks + 1,
    onDevice: c.onDevice + (r.actualSource === 'on-device' ? 1 : 0),
    cloud: c.cloud + (r.actualSource === 'cloud' ? 1 : 0),
    tier0Only: c.tier0Only + (r.actualSource === 'none' ? 1 : 0),
    charsKeptLocal: c.charsKeptLocal + Math.max(0, r.inputChars - r.charsSentToCloud),
    flags: c.flags + r.verifiedQuotes + r.droppedQuotes,
    verifiedFlags: c.verifiedFlags + r.verifiedQuotes,
    droppedFlags: c.droppedFlags + r.droppedQuotes,
  };
}

/** Ring buffer: newest first, at most RECEIPT_LIMIT. */
export const pushReceipt = (list: Receipt[], r: Receipt): Receipt[] => [r, ...list].slice(0, RECEIPT_LIMIT);

export const onDeviceShare = (c: Counters) => (c.checks ? Math.round((c.onDevice / c.checks) * 100) : 0);

export function newId(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  return g.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
