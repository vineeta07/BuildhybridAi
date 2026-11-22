import { describe, expect, it } from 'vitest';
import { EMPTY_SIGNALS, lookalikeBrand, suggestLens, tier0 } from '../src/tier0';
import { DEFAULT_SCAM_PHRASES } from '../src/defaults';
import type { PageSignals } from '../src/types';

const run = (url: string, sig: Partial<PageSignals> = {}, text = '', title = '') =>
  tier0({ url, title, text, signals: { ...EMPTY_SIGNALS, ...sig }, phrases: DEFAULT_SCAM_PHRASES });

describe('tier0', () => {
  it('flags punycode hosts', () => {
    const r = run('https://xn--pypal-4ve.com/login', { hostHasPunycode: true });
    expect(r.findings.map((f) => f.id)).toContain('host_ip_punycode');
  });
  it('flags IP hosts', () => {
    expect(run('http://192.168.10.4/kyc', { hostIsIp: true }).findings.map((f) => f.id)).toContain('host_ip_punycode');
  });
  it('flags lookalike brand hosts', () => {
    expect(lookalikeBrand('paypa1-secure.com')).toBe('paypal');
    expect(lookalikeBrand('sbi-kyc-update.com')).toBe('sbi');
    expect(lookalikeBrand('www.paypal.com')).toBeNull();
    expect(lookalikeBrand('onlinesbi.sbi')).toBeNull();
    expect(lookalikeBrand('www.amazon.in')).toBeNull();
    expect(lookalikeBrand('apply-now.example.org')).toBeNull();
    expect(lookalikeBrand('example.com')).toBeNull();
  });
  it('password field on HTTP is red with a lookalike host', () => {
    const r = run('http://paypa1-login.com/', { isHttps: false, hasPasswordField: true });
    expect(r.score).toBeGreaterThanOrEqual(60);
    expect(r.level).toBe('red');
  });
  it('password field on HTTPS is not flagged as insecure', () => {
    expect(run('https://example.com', { hasPasswordField: true }).findings).toHaveLength(0);
  });
  it('caps phrase points at 40', () => {
    const text = DEFAULT_SCAM_PHRASES.join(' ');
    const r = run('https://example.com', {}, text);
    expect(r.findings.find((f) => f.id === 'phrases')?.points).toBe(40);
  });
  it('caps link mismatch at 40', () => {
    expect(run('https://example.com', { linkHostMismatches: 5 }).findings.find((f) => f.id === 'link_mismatch')?.points).toBe(40);
  });
  it('neutral when nothing found', () => {
    const r = run('https://example.com/news', {}, 'Weather is pleasant today.');
    expect(r).toMatchObject({ score: 0, level: 'neutral', suggestedLens: 'scam' });
  });
  it('amber band', () => {
    expect(run('https://example.com', { externalFormAction: true, hasCountdownLike: true }).level).toBe('amber');
  });
  it('lens selection by page type', () => {
    expect(suggestLens('https://x.com/terms', '', '')).toBe('fineprint');
    expect(suggestLens('https://x.com/a', 'Loan agreement', '')).toBe('fineprint');
    const legal = 'hereby the liability under governing law and arbitration. '.repeat(60);
    expect(suggestLens('https://x.com/a', '', legal)).toBe('fineprint');
    expect(suggestLens('https://x.com/a', '', 'hello')).toBe('scam');
  });
  it('runs fast', () => {
    const text = 'lorem ipsum '.repeat(4000);
    const t = performance.now();
    run('https://sub.a.b.c.example.com', {}, text);
    expect(performance.now() - t).toBeLessThan(50);
  });
});

describe('dark patterns', () => {
  it('flags pre-ticked paid add-ons', () => {
    const f = run('https://shop.example', { preTickedAddOns: 1 }).findings.find((x) => x.id === 'preticked');
    expect(f?.points).toBe(15);
    expect(run('https://shop.example', { preTickedAddOns: 5 }).findings.find((x) => x.id === 'preticked')?.points).toBe(30);
  });
});
