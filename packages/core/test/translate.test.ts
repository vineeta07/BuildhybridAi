import { describe, expect, it } from 'vitest';
import { applyTranslations, languageCode, needsLocalTranslation, translatableStrings } from '../src/translate';
import type { Analysis, CheckResult } from '../src/types';

const a: Analysis = {
  verdict: 'danger', headline: 'H', summary: 'S', advice: ['A1', 'A2'],
  reasons: [{ category: 'urgency_threat', severity: 'high', explanation: 'E1', quote: 'exact quote from the page' }],
};
const result = (source: 'cloud' | 'on-device'): CheckResult => ({
  kind: 'full', analysis: a, tier0: { score: 0, level: 'neutral', findings: [], suggestedLens: 'scam' },
  receipt: { actualSource: source } as CheckResult['receipt'],
});

describe('translation helpers', () => {
  it('maps language names to codes', () => {
    expect(languageCode('Hindi')).toBe('hi');
    expect(languageCode('Klingon')).toBe('en');
  });
  it('only on-device results in a non-English language need a local pass', () => {
    expect(needsLocalTranslation(result('on-device'), 'Hindi')).toBe(true);
    expect(needsLocalTranslation(result('cloud'), 'Hindi')).toBe(false);
    expect(needsLocalTranslation(result('on-device'), 'English')).toBe(false);
  });
  it('never translates quotes and round-trips order', () => {
    const s = translatableStrings(a);
    expect(s).toEqual(['H', 'S', 'E1', 'A1', 'A2']);
    expect(s).not.toContain('exact quote from the page');
    const t = applyTranslations(a, s.map((x) => `hi:${x}`));
    expect(t).toMatchObject({ headline: 'hi:H', summary: 'hi:S', advice: ['hi:A1', 'hi:A2'] });
    expect(t.reasons[0]).toMatchObject({ explanation: 'hi:E1', quote: 'exact quote from the page' });
    expect(t.verdict).toBe('danger');
  });
  it('falls back to the original for missing or empty translations', () => {
    const t = applyTranslations(a, ['', 'hi:S']);
    expect(t.headline).toBe('H');
    expect(t.summary).toBe('hi:S');
    expect(t.advice).toEqual(['A1', 'A2']);
  });
});
