import { CATEGORIES, SEVERITIES, VERDICTS, type Analysis, type Reason } from './types';

export class ParseError extends Error {
  override name = 'ParseError';
}

export const LIMITS = {
  headline: 160, summary: 700, explanation: 500, quote: 400, advice: 300,
  maxReasons: 3, maxAdvice: 3,
} as const;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, field: string, max: number): string => {
  if (typeof v !== 'string') throw new ParseError(`${field} is not a string`);
  const s = v.trim();
  if (s.length > max) throw new ParseError(`${field} is longer than ${max} characters`);
  return s;
};
const oneOf = <T extends string>(v: unknown, list: readonly T[], field: string): T => {
  if (typeof v !== 'string' || !(list as readonly string[]).includes(v)) {
    throw new ParseError(`${field} is not one of ${list.join(', ')}`);
  }
  return v as T;
};

/** Parses and validates model output. Throws ParseError on anything outside the schema. */
export function parseAnalysis(raw: string): Analysis {
  let text = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(text);
  if (fence?.[1] !== undefined) text = fence[1];
  let data: unknown;
  try { data = JSON.parse(text); } catch { throw new ParseError('reply is not valid JSON'); }
  if (!isObj(data)) throw new ParseError('reply is not an object');

  const verdict = oneOf(data.verdict, VERDICTS, 'verdict');
  const headline = str(data.headline, 'headline', LIMITS.headline);
  const summary = str(data.summary, 'summary', LIMITS.summary);
  if (!Array.isArray(data.reasons)) throw new ParseError('reasons is not an array');
  if (!Array.isArray(data.advice)) throw new ParseError('advice is not an array');

  const reasons: Reason[] = data.reasons.slice(0, LIMITS.maxReasons).map((r, i) => {
    if (!isObj(r)) throw new ParseError(`reasons[${i}] is not an object`);
    return {
      category: oneOf(r.category, CATEGORIES, `reasons[${i}].category`),
      severity: oneOf(r.severity, SEVERITIES, `reasons[${i}].severity`),
      explanation: str(r.explanation, `reasons[${i}].explanation`, LIMITS.explanation),
      quote: str(r.quote, `reasons[${i}].quote`, LIMITS.quote),
    };
  });
  const advice = data.advice.slice(0, LIMITS.maxAdvice)
    .map((a, i) => str(a, `advice[${i}]`, LIMITS.advice))
    .filter((a) => a.length > 0);

  return { verdict, headline, summary, reasons, advice };
}
