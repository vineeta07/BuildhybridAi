import type { Reason } from './types';

export const MIN_QUOTE_CHARS = 12;

/** NFKC, lowercase, strip curly/straight quotes and ellipses, collapse whitespace. */
export const normalizeForMatch = (s: string) =>
  s.normalize('NFKC').toLowerCase()
    .replace(/[“”‘’"'`…]/g, '')
    .replace(/\.{3}/g, '')
    .replace(/\s+/g, ' ').trim();

/** Keep only reasons whose quote is an exact substring (after normalizing) of the text sent. */
export function verifyReasons(reasons: Reason[], sentText: string) {
  const hay = normalizeForMatch(sentText);
  let dropped = 0;
  const kept = reasons
    .filter((r) => {
      const q = normalizeForMatch(r.quote ?? '');
      const ok = q.length >= MIN_QUOTE_CHARS && hay.includes(q);
      if (!ok) dropped++;
      return ok;
    })
    .map((r) => ({ ...r, verified: true }));
  return { kept, dropped };
}
