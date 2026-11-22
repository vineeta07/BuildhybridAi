/**
 * Personal-data redaction. These are heuristics: the consent dialog must say that Satark
 * removes common patterns but cannot guarantee nothing sensitive remains.
 * The original-to-placeholder map is never kept beyond the call.
 */
export const luhn = (d: string) => {
  let sum = 0, alt = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let n = Number(d[i]);
    if (alt && (n *= 2) > 9) n -= 9;
    sum += n; alt = !alt;
  }
  return d.length >= 13 && d.length <= 19 && sum % 10 === 0;
};

export type RedactionType =
  | 'EMAIL' | 'CARD' | 'AADHAAR' | 'PAN' | 'PHONE' | 'UPI' | 'IFSC' | 'ACCOUNT' | 'CODE' | 'SSN';

// Order matters: specific patterns first, broad ones later.
const PATTERNS: { type: RedactionType; re: RegExp; ok?: (m: string) => boolean }[] = [
  { type: 'EMAIL', re: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi },
  { type: 'CARD', re: /(?<!\d)\d(?:[ -]?\d){12,18}(?!\d)/g, ok: (m) => luhn(m.replace(/\D/g, '')) },
  { type: 'AADHAAR', re: /(?<!\d)[2-9]\d{3}([\s-]?)\d{4}\1\d{4}(?!\d)/g },
  { type: 'PAN', re: /\b[A-Z]{5}\d{4}[A-Z]\b/g },
  { type: 'SSN', re: /(?<!\d)\d{3}-\d{2}-\d{4}(?!\d)/g },
  { type: 'PHONE', re: /(?<![\d+])(?:\+91[\s-]?|0)?[6-9]\d{9}(?!\d)/g },
  // handle@bankhandle with no dot after the @ (runs after the email pass)
  { type: 'UPI', re: /(?<![\w.-])[\w.-]{2,}@[a-z]{2,}(?![\w-]|\.[a-z])/gi },
  { type: 'IFSC', re: /\b[A-Z]{4}0[A-Z0-9]{6}\b/g },
  { type: 'ACCOUNT', re: /(?<=(?:account|a\/c)[^\d]{0,40})\d{9,18}(?!\d)/gi },
  { type: 'CODE', re: /(?<=\b(?:otp|pin|cvv|code)\b[^\d]{0,30})\d{3,8}(?!\d)/gi },
];

export interface Redaction { text: string; counts: Partial<Record<RedactionType, number>> }

export function redact(text: string): Redaction {
  const counts: Partial<Record<RedactionType, number>> = {};
  let out = text;
  for (const p of PATTERNS) {
    out = out.replace(p.re, (m) => {
      if (p.ok && !p.ok(m)) return m;
      counts[p.type] = (counts[p.type] ?? 0) + 1;
      return `[${p.type}_${counts[p.type]}]`;
    });
  }
  return { text: out, counts };
}

export const hasPersonalData = (t: string) => Object.keys(redact(t).counts).length > 0;

const LABELS: Record<RedactionType, [string, string]> = {
  EMAIL: ['email address', 'email addresses'],
  CARD: ['card number', 'card numbers'],
  AADHAAR: ['Aadhaar number', 'Aadhaar numbers'],
  PAN: ['PAN', 'PANs'],
  PHONE: ['phone number', 'phone numbers'],
  UPI: ['UPI ID', 'UPI IDs'],
  IFSC: ['IFSC code', 'IFSC codes'],
  ACCOUNT: ['account number', 'account numbers'],
  CODE: ['OTP or PIN', 'OTPs or PINs'],
  SSN: ['SSN', 'SSNs'],
};

/** "2 phone numbers, 1 card number" */
export function describeRedactions(counts: Record<string, number>): string {
  const parts = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([t, n]) => {
      const l = LABELS[t as RedactionType] ?? [t.toLowerCase(), t.toLowerCase()];
      return `${n} ${n === 1 ? l[0] : l[1]}`;
    });
  return parts.length ? parts.join(', ') : 'nothing';
}

export const totalRedactions = (counts: Record<string, number>) =>
  Object.values(counts).reduce((a, b) => a + b, 0);
