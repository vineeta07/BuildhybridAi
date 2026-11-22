/**
 * Chrome's built-in Translator API (on-device; Chrome downloads a language pack once).
 * Used to show on-device verdicts in the chosen language. Not available in Firefox.
 */
export type TranslatorStatus = 'available' | 'downloadable' | 'downloading' | 'unavailable';

interface TranslatorLike { translate(text: string): Promise<string>; destroy?(): void }
interface TranslatorStatic {
  availability(o: { sourceLanguage: string; targetLanguage: string }): Promise<TranslatorStatus>;
  create(o: { sourceLanguage: string; targetLanguage: string; monitor?: (m: EventTarget) => void }): Promise<TranslatorLike>;
}
const T = () => (globalThis as { Translator?: TranslatorStatic }).Translator;

export async function translatorStatus(target: string): Promise<TranslatorStatus> {
  const t = T();
  if (!t) return 'unavailable';
  try { return await t.availability({ sourceLanguage: 'en', targetLanguage: target }); } catch { return 'unavailable'; }
}

/** When the pack must be downloaded, call this from a click handler (user activation). */
export async function translateAll(texts: string[], target: string, onProgress?: (f: number) => void): Promise<string[]> {
  const t = T();
  if (!t) throw new Error('Translation is not available in this browser.');
  const tr = await t.create({
    sourceLanguage: 'en', targetLanguage: target,
    ...(onProgress ? { monitor: (m: EventTarget) => m.addEventListener('downloadprogress', (e) => onProgress((e as ProgressEvent).loaded)) } : {}),
  });
  try {
    const out: string[] = [];
    for (const s of texts) out.push(s ? await tr.translate(s) : s);
    return out;
  } finally { tr.destroy?.(); }
}
