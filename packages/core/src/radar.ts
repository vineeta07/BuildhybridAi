import type { Lens } from './types';

const KEYWORDS: Record<Lens, string[]> = {
  scam: [
    'otp', 'kyc', 'pin', 'cvv', 'password', 'aadhaar', 'pan', 'upi', 'blocked', 'suspend',
    'urgent', 'immediately', 'within 24 hours', 'verify', 'click', 'link', 'prize', 'won',
    'lottery', 'fee', 'pay', 'refund', 'customs', 'arrest', 'police', 'anydesk', 'gift card',
    'crypto', 'guaranteed', 'returns', 'investment', 'do not tell', 'bank', 'account',
  ],
  fineprint: [
    'auto-renew', 'automatically renew', 'renewal', 'cancel', 'penalty', 'interest', 'late fee',
    'fee', 'charge', 'arbitration', 'class action', 'waive', 'waiver', 'third part', 'share',
    'sell', 'partners', 'data', 'terminate', 'without notice', 'modify', 'change these terms',
    'liability', 'indemnif', 'lock-in', 'minimum term', 'non-refundable', 'governing law',
  ],
};

export interface RadarResult {
  text: string; partial: boolean; keptParagraphs: number; totalParagraphs: number;
}

const splitParagraphs = (t: string) =>
  t.split(/\n\s*\n|\n/).map((p) => p.trim()).filter((p) => p.length > 0);

/**
 * Clause radar: fit long text into the on-device budget by keeping the most relevant
 * paragraphs, in their original order. Output never exceeds `budget` characters.
 */
export function radar(text: string, lens: Lens, budget: number): RadarResult {
  const paras = splitParagraphs(text);
  if (text.length <= budget) {
    return { text, partial: false, keptParagraphs: paras.length, totalParagraphs: paras.length };
  }
  const kw = KEYWORDS[lens];
  const scored = paras.map((p, idx) => {
    const l = p.toLowerCase();
    let score = 0;
    for (const k of kw) if (l.includes(k)) score += 1;
    return { idx, p, score };
  });
  const order = [...scored].sort((a, b) => b.score - a.score || a.idx - b.idx);
  const keep = new Set<number>();
  let used = 0;
  const SEP = 2; // "\n\n"
  for (const s of order) {
    const cost = s.p.length + (keep.size ? SEP : 0);
    if (used + cost > budget) continue;
    keep.add(s.idx); used += cost;
  }
  let out = scored.filter((s) => keep.has(s.idx)).map((s) => s.p).join('\n\n');
  if (!out) out = (order[0]?.p ?? text).slice(0, budget); // one giant paragraph
  return {
    text: out.slice(0, budget), partial: true,
    keptParagraphs: Math.max(1, keep.size), totalParagraphs: paras.length,
  };
}

export const partialNote = (r: RadarResult) =>
  `Checked the ${r.keptParagraphs} most relevant of ${r.totalParagraphs} paragraphs`;
