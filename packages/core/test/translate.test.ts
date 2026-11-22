import { describe, expect, it } from 'vitest';
import {
  LANGUAGES, applyTranslations, isRtl, languageCode, languageName, needsLocalTranslation, resolveLanguage, translatableStrings,
} from '../src/translate';
import { buildPrompt } from '../src/prompts';
import type { Analysis, CheckResult } from '../src/types';

const a: Analysis = {
  verdict: 'danger', headline: 'H', summary: 'S', advice: ['A1', 'A2'],
  reasons: [{ category: 'urgency_threat', severity: 'high', explanation: 'E1', quote: 'exact quote from the page' }],
};
const result = (source: 'cloud' | 'on-device'): CheckResult => ({
  kind: 'full', analysis: a, tier0: { score: 0, level: 'neutral', findings: [], suggestedLens: 'scam' },
  receipt: { actualSource: source } as CheckResult['receipt'],
});

describe('language list', () => {
  it('has many languages with unique codes and native names', () => {
    expect(LANGUAGES.length).toBeGreaterThanOrEqual(50);
    expect(new Set(LANGUAGES.map((l) => l.code)).size).toBe(LANGUAGES.length);
    expect(LANGUAGES.every((l) => l.native.trim() && l.name.trim())).toBe(true);
  });
  it('covers the major Indian languages', () => {
    for (const c of ['hi', 'bn', 'ta', 'te', 'mr', 'gu', 'kn', 'ml', 'pa', 'or', 'ur']) expect(languageCode(c)).toBe(c);
  });
});

describe('languageCode', () => {
  it('accepts codes, regional codes, English names (old settings) and aliases', () => {
    expect(languageCode('Hindi')).toBe('hi');
    expect(languageCode('hi-IN')).toBe('hi');
    expect(languageCode('pt-BR')).toBe('pt');
    expect(languageCode('zh-TW')).toBe('zh-Hant');
    expect(languageCode('zh-CN')).toBe('zh');
    expect(languageCode('iw')).toBe('he');
    expect(languageCode('nb-NO')).toBe('no');
    expect(languageCode('tl')).toBe('fil');
  });
  it('falls back to English for unknown values', () => {
    expect(languageCode('Klingon')).toBe('en');
    expect(languageCode('')).toBe('en');
  });
  it('knows right-to-left scripts', () => {
    expect(isRtl('ar')).toBe(true);
    expect(isRtl('ur')).toBe(true);
    expect(isRtl('hi')).toBe(false);
  });
  it('resolves "auto" from the browser language', () => {
    expect(resolveLanguage('auto', 'ta-IN')).toBe('ta');
    expect(resolveLanguage('auto', 'xx-YY')).toBe('en');
    expect(resolveLanguage('bn', 'en-US')).toBe('bn');
  });
});

describe('cloud prompt language', () => {
  const snap = { url: '', title: '', origin: 'paste' as const };
  it('asks the cloud model to answer in the chosen language and keep quotes verbatim', () => {
    const p = buildPrompt('scam', snap, 'text', { cloud: true, outputLanguage: 'ml' });
    expect(p).toContain('in Malayalam (ml)');
    expect(p).toContain('copied exactly');
  });
  it('does not add a language line for English or on-device', () => {
    expect(buildPrompt('scam', snap, 't', { cloud: true, outputLanguage: 'en' })).not.toContain('Write the headline');
    expect(buildPrompt('scam', snap, 't', { cloud: false, outputLanguage: 'hi' })).not.toContain('Write the headline');
    expect(languageName('Hindi')).toBe('Hindi');
  });
});

describe('translation helpers', () => {
  it('only on-device results in a non-English language need a local pass', () => {
    expect(needsLocalTranslation(result('on-device'), 'hi')).toBe(true);
    expect(needsLocalTranslation(result('cloud'), 'hi')).toBe(false);
    expect(needsLocalTranslation(result('on-device'), 'en')).toBe(false);
  });
  it('never translates quotes and round-trips order', () => {
    const s = translatableStrings(a);
    expect(s).toEqual(['H', 'S', 'E1', 'A1', 'A2']);
    const t = applyTranslations(a, s.map((x) => `hi:${x}`));
    expect(t).toMatchObject({ headline: 'hi:H', summary: 'hi:S', advice: ['hi:A1', 'hi:A2'] });
    expect(t.reasons[0]).toMatchObject({ explanation: 'hi:E1', quote: 'exact quote from the page' });
  });
  it('falls back to the original for missing or empty translations', () => {
    const t = applyTranslations(a, ['', 'hi:S']);
    expect(t.headline).toBe('H');
    expect(t.summary).toBe('hi:S');
  });
});
