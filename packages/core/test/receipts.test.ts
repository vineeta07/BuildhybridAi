import { describe, expect, it } from 'vitest';
import { EMPTY_COUNTERS, RECEIPT_LIMIT, addToCounters, pushReceipt, reasonSentence, receiptChip } from '../src/receipts';
import { analyze } from '../src/analyze';
import { DEFAULT_REMOTE, DEFAULT_SETTINGS } from '../src/defaults';
import { EMPTY_SIGNALS } from '../src/tier0';
import type { Receipt } from '../src/types';

const SECRET = 'My Aadhaar is 2345 6789 0123 and OTP is 482913. Your account will be blocked today unless you pay.';

async function sampleReceipt(): Promise<Receipt> {
  const res = await analyze({
    snap: { origin: 'paste', url: '', title: '', lang: 'en', text: SECRET, signals: EMPTY_SIGNALS },
    lens: 'scam', settings: { ...DEFAULT_SETTINGS, mode: 'cloud' }, remote: DEFAULT_REMOTE,
    status: 'unavailable', online: true, askConsent: async () => true,
    runModel: async () => ({
      json: JSON.stringify({ verdict: 'danger', headline: 'h', summary: 's', advice: [],
        reasons: [{ category: 'urgency_threat', severity: 'high', explanation: 'e', quote: 'your account will be blocked today' }] }),
      source: 'cloud', latencyMs: 2200, model: 'gemini-2.5-flash-lite',
    }),
  });
  return res.receipt;
}

describe('receipts', () => {
  it('serialized receipts contain none of the input text', async () => {
    const r = await sampleReceipt();
    const json = JSON.stringify(r);
    expect(json).not.toContain('2345');
    expect(json).not.toContain('482913');
    expect(json).not.toContain('blocked');
    expect(json).not.toContain('Aadhaar is');
    expect(r.redactions).toEqual({ AADHAAR: 1, CODE: 1 });
  });
  it('chip text', async () => {
    const r = await sampleReceipt();
    expect(receiptChip(r)).toBe(`Cloud · gemini-2.5-flash-lite · 2.2 s · ${r.charsSentToCloud.toLocaleString('en-US')} characters sent · 2 items hidden`);
    expect(reasonSentence(r)).toBe('You chose cloud or best-quality mode.');
  });
  it('ring buffer keeps the newest 50', async () => {
    const r = await sampleReceipt();
    let list: Receipt[] = [];
    for (let i = 0; i < 60; i++) list = pushReceipt(list, { ...r, id: String(i) });
    expect(list).toHaveLength(RECEIPT_LIMIT);
    expect(list[0]?.id).toBe('59');
  });
  it('counters', async () => {
    const r = await sampleReceipt();
    const c = addToCounters(EMPTY_COUNTERS, r);
    expect(c).toMatchObject({ checks: 1, cloud: 1, onDevice: 0, verifiedFlags: 1 });
    expect(c.charsKeptLocal).toBe(Math.max(0, r.inputChars - r.charsSentToCloud));
  });
});
