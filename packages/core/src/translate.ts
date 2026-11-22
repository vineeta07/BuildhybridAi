import type { Analysis, CheckResult } from './types';

/** Explanation languages offered in Options, with their BCP 47 codes for the Translator API. */
export const OUTPUT_LANGUAGES: Record<string, string> = {
  English: 'en', Hindi: 'hi', Bengali: 'bn', Tamil: 'ta', Telugu: 'te', Marathi: 'mr',
  Kannada: 'kn', Gujarati: 'gu', Spanish: 'es', French: 'fr', German: 'de', Japanese: 'ja',
};

export const languageCode = (name: string): string => OUTPUT_LANGUAGES[name] ?? 'en';

/**
 * On-device verdicts are written in English; cloud verdicts already come back in the chosen
 * language (the prompt asks for it). So only non-cloud full results need a local translation.
 */
export function needsLocalTranslation(r: CheckResult, outputLanguage: string): boolean {
  return r.kind === 'full' && !!r.analysis && languageCode(outputLanguage) !== 'en' && r.receipt.actualSource !== 'cloud';
}

/** The strings to translate, in a fixed order. Quotes are excluded: evidence stays verbatim. */
export function translatableStrings(a: Analysis): string[] {
  return [a.headline, a.summary, ...a.reasons.map((r) => r.explanation), ...a.advice];
}

/** Puts translated strings back in the same order. Falls back to the original for any gap. */
export function applyTranslations(a: Analysis, t: string[]): Analysis {
  let i = 0;
  const next = (orig: string) => { const v = t[i++]; return typeof v === 'string' && v.trim() ? v : orig; };
  const headline = next(a.headline);
  const summary = next(a.summary);
  const reasons = a.reasons.map((r) => ({ ...r, explanation: next(r.explanation) }));
  const advice = a.advice.map((x) => next(x));
  return { ...a, headline, summary, reasons, advice };
}
