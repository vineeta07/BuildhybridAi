import { editDistance, hostOf, isIpHost, registrableDomain } from './domain';
import type { Lens, PageSignals, Tier0Finding, Tier0Result } from './types';

/**
 * Brand tokens for lookalike detection, with the registrable domains that legitimately use them.
 * Used only to flag hosts that look like a brand but are not on that brand's domain.
 */
export const BRANDS: Record<string, string[]> = {
  paypal: ['paypal.com'], amazon: ['amazon.com', 'amazon.in', 'amazon.co.uk'],
  google: ['google.com', 'google.co.in'], apple: ['apple.com'], microsoft: ['microsoft.com'],
  netflix: ['netflix.com'], flipkart: ['flipkart.com'], paytm: ['paytm.com'],
  phonepe: ['phonepe.com'], sbi: ['sbi.co.in', 'onlinesbi.sbi', 'sbi'], hdfcbank: ['hdfcbank.com'],
  icicibank: ['icicibank.com'], axisbank: ['axisbank.com'], kotak: ['kotak.com'],
  irctc: ['irctc.co.in'], incometax: ['incometax.gov.in'], uidai: ['uidai.gov.in'],
  whatsapp: ['whatsapp.com'], instagram: ['instagram.com'], facebook: ['facebook.com'],
  indiapost: ['indiapost.gov.in'], fedex: ['fedex.com'], dhl: ['dhl.com'],
};

// Ordinary words one edit away from a brand token.
const COMMON_WORDS = new Set(['apply', 'apples', 'amazing', 'kotaku', 'dhal']);

const LEGAL_WORDS = ['hereby', 'liability', 'governing law', 'arbitration', 'indemnify'];
const FINEPRINT_URL = /(terms|privacy|policy|agreement|conditions|eula|loan|subscription|cancel)/i;

export interface Tier0Input {
  url: string; title: string; text: string; signals: PageSignals; phrases: string[];
}

export function lookalikeBrand(host: string): string | null {
  if (!host || isIpHost(host)) return null;
  const reg = registrableDomain(host);
  const tokens = host.split(/[.-]/).filter((t) => t.length >= 3);
  for (const [brand, domains] of Object.entries(BRANDS)) {
    if (domains.includes(reg) || domains.includes(host)) continue;
    for (const t of tokens) {
      if (COMMON_WORDS.has(t)) continue;
      const d = t === brand ? 0 : editDistance(t, brand, 2);
      // distance 0 = brand name used on someone else's domain; 1-2 = typo-squat
      // (2 only for long brand names, to keep false positives down).
      const maxD = brand.length >= 8 ? 2 : brand.length >= 5 ? 1 : 0;
      if (d <= maxD) return brand;
    }
  }
  return null;
}

export function suggestLens(url: string, title: string, text: string): Lens {
  if (FINEPRINT_URL.test(url) || FINEPRINT_URL.test(title)) return 'fineprint';
  if (text.length >= 2500) {
    const lower = text.toLowerCase();
    const hits = LEGAL_WORDS.filter((w) => lower.includes(w)).length;
    if (hits >= 3) return 'fineprint';
  }
  return 'scam';
}

/** Pure, no AI, meant to run in well under 50 ms. Never says "safe". */
export function tier0(i: Tier0Input): Tier0Result {
  const findings: Tier0Finding[] = [];
  const add = (id: string, label: string, points: number) => findings.push({ id, label, points });
  const host = hostOf(i.url);
  const s = i.signals;

  if (s.hostIsIp || s.hostHasPunycode || host.includes('xn--') || (host && isIpHost(host))) {
    add('host_ip_punycode', 'The web address is a raw IP or uses look-alike characters', 25);
  }
  const hyphens = (host.match(/-/g) ?? []).length;
  if (s.subdomainDepth >= 4 || hyphens >= 3) add('host_complex', 'The web address is unusually long or complex', 10);
  const brand = lookalikeBrand(host);
  if (brand) add('lookalike', `The address looks like "${brand}" but is not its official site`, 35);
  if (!s.isHttps && (s.hasPasswordField || s.hasOtpField || s.hasCardField)) {
    add('insecure_secret', 'Asks for a password, OTP or card on an insecure page', 40);
  }
  const lower = `${i.title}\n${i.text}`.toLowerCase();
  const hits = i.phrases.filter((p) => p && lower.includes(p.toLowerCase()));
  if (hits.length) {
    add('phrases', `Uses common scam phrases: ${hits.slice(0, 4).map((h) => `"${h}"`).join(', ')}`,
      Math.min(40, hits.length * 8));
  }
  if (s.hasCountdownLike) add('countdown', 'Uses a countdown or "only a few left" pressure', 10);
  if (s.externalFormAction) add('external_form', 'A form sends your details to a different website', 25);
  if (s.linkHostMismatches > 0) {
    add('link_mismatch', 'A link shows one website but goes to another', Math.min(40, s.linkHostMismatches * 25));
  }

  const score = findings.reduce((a, f) => a + f.points, 0);
  const level = score >= 60 ? 'red' : score >= 30 ? 'amber' : 'neutral';
  return { score, level, findings, suggestedLens: suggestLens(i.url, i.title, i.text) };
}

export const TIER0_LABEL: Record<Tier0Result['level'], string> = {
  red: 'Quick check: several red flags',
  amber: 'Quick check: some warning signs',
  neutral: 'No quick red flags (AI not run)',
};

export const EMPTY_SIGNALS: PageSignals = {
  isHttps: true, hasPasswordField: false, hasOtpField: false, hasCardField: false,
  hasCountdownLike: false, hostIsIp: false, hostHasPunycode: false,
  subdomainDepth: 0, externalFormAction: false, linkHostMismatches: 0,
};
