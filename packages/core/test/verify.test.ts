import { describe, expect, it } from 'vitest';
import { verifyReasons } from '../src/verify';
import type { Reason } from '../src/types';

const reason = (quote: string): Reason => ({ category: 'urgency_threat', severity: 'high', explanation: 'x', quote });
const text = 'Your account will be blocked today. Update your “KYC details” within 24 hours…';

describe('quote verification', () => {
  it('keeps an exact match', () => {
    const { kept, dropped } = verifyReasons([reason('your account will be blocked today')], text);
    expect(kept).toHaveLength(1);
    expect(kept[0]?.verified).toBe(true);
    expect(dropped).toBe(0);
  });
  it('tolerates curly vs straight quotes, case and whitespace', () => {
    expect(verifyReasons([reason('Update your "KYC   details" within 24 hours...')], text).kept).toHaveLength(1);
  });
  it('drops quotes under 12 characters', () => {
    expect(verifyReasons([reason('blocked')], text)).toMatchObject({ kept: [], dropped: 1 });
  });
  it('drops an invented quote', () => {
    expect(verifyReasons([reason('send money to this number now')], text)).toMatchObject({ kept: [], dropped: 1 });
  });
  it('counts multiple drops', () => {
    const r = verifyReasons([reason('your account will be blocked'), reason('made up text here'), reason('')], text);
    expect(r.kept).toHaveLength(1);
    expect(r.dropped).toBe(2);
  });
});
