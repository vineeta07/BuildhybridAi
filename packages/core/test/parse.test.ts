import { describe, expect, it } from 'vitest';
import { ParseError, parseAnalysis } from '../src/parse';

const good = {
  verdict: 'danger', headline: 'Fake KYC message', summary: 'It asks for your OTP.',
  reasons: [{ category: 'credential_request', severity: 'high', explanation: 'Banks never ask for OTP.', quote: 'share the OTP sent to your mobile' }],
  advice: ['Do not share the OTP.'],
};

describe('parseAnalysis', () => {
  it('accepts a valid reply', () => {
    expect(parseAnalysis(JSON.stringify(good))).toEqual(good);
  });
  it('accepts a reply wrapped in a code fence', () => {
    expect(parseAnalysis('```json\n' + JSON.stringify(good) + '\n```').verdict).toBe('danger');
  });
  it('rejects invalid JSON', () => {
    expect(() => parseAnalysis('not json')).toThrow(ParseError);
  });
  it('rejects an out-of-enum category', () => {
    const bad = { ...good, reasons: [{ ...good.reasons[0], category: 'hacking' }] };
    expect(() => parseAnalysis(JSON.stringify(bad))).toThrow(/category/);
  });
  it('rejects an out-of-enum verdict', () => {
    expect(() => parseAnalysis(JSON.stringify({ ...good, verdict: 'totally_safe' }))).toThrow(/verdict/);
  });
  it('rejects a missing field', () => {
    const { summary: _s, ...rest } = good;
    expect(() => parseAnalysis(JSON.stringify(rest))).toThrow(/summary/);
  });
  it('rejects over-long strings', () => {
    expect(() => parseAnalysis(JSON.stringify({ ...good, headline: 'x'.repeat(500) }))).toThrow(/headline/);
  });
  it('trims to 3 reasons and 3 advice', () => {
    const many = { ...good, reasons: Array(5).fill(good.reasons[0]), advice: ['a', 'b', 'c', 'd'] };
    const p = parseAnalysis(JSON.stringify(many));
    expect(p.reasons).toHaveLength(3);
    expect(p.advice).toHaveLength(3);
  });
});
