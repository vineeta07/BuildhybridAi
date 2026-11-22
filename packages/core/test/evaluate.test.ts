import { describe, expect, it } from 'vitest';
import { scoreEval, type EvalRun, type EvalSample } from '../src/evaluate';
import type { CheckResult, VerdictLevel } from '../src/types';

const res = (verdict: VerdictLevel, latencyMs: number, v = 1, d = 0): CheckResult => ({
  kind: 'full', analysis: { verdict, headline: '', summary: '', reasons: [], advice: [] },
  tier0: { score: 0, level: 'neutral', findings: [], suggestedLens: 'scam' },
  receipt: { latencyMs, verifiedQuotes: v, droppedQuotes: d } as CheckResult['receipt'],
});
const samples: EvalSample[] = [
  { id: 'a', lens: 'scam', label: 'scam', text: '' },
  { id: 'b', lens: 'scam', label: 'benign', text: '' },
];

describe('scoreEval', () => {
  it('scores accuracy, agreement, quote rate and latency per route', () => {
    const runs: EvalRun[] = [
      { sampleId: 'a', route: 'on-device', result: res('danger', 100) },
      { sampleId: 'b', route: 'on-device', result: res('caution', 300, 0, 1) },
      { sampleId: 'a', route: 'cloud', result: res('caution', 50) },
      { sampleId: 'b', route: 'cloud', result: res('safe', 70) },
    ];
    const r = scoreEval(samples, runs);
    expect(r.routes[0]).toMatchObject({ route: 'on-device', ran: 2, correct: 1, accuracy: 0.5, verifiedQuoteRate: 0.5, medianLatencyMs: 200 });
    expect(r.routes[1]).toMatchObject({ route: 'cloud', ran: 2, correct: 2, accuracy: 1, medianLatencyMs: 60 });
    expect(r.agreement).toEqual({ both: 2, agree: 1, rate: 0.5 });
  });
  it('counts failures and ignores them for agreement', () => {
    const r = scoreEval(samples, [{ sampleId: 'a', route: 'cloud', error: 'offline' }]);
    expect(r.routes[1]).toMatchObject({ ran: 0, failed: 1, accuracy: 0 });
    expect(r.agreement.both).toBe(0);
  });
});
