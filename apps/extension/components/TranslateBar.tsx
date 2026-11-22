import { useEffect, useState } from 'react';
import { applyTranslations, languageCode, needsLocalTranslation, translatableStrings, type Analysis, type CheckResult } from '@satark/core';
import { translateAll, translatorStatus, type TranslatorStatus } from '@/lib/translator';

type State = { s: 'idle' | 'checking' | 'working' | 'done' | 'error'; msg?: string; progress?: number };

/**
 * Translates an on-device verdict into the chosen language with Chrome's on-device Translator.
 * Quotes are never translated, so they still match the page. Calls onChange with the analysis
 * to display (translated, or the original when the user switches back).
 */
export function TranslateBar(props: { result: CheckResult; outputLanguage: string; onChange: (a: Analysis | null) => void }) {
  const { result, outputLanguage, onChange } = props;
  const [state, setState] = useState<State>({ s: 'idle' });
  const [avail, setAvail] = useState<TranslatorStatus | null>(null);
  const [translated, setTranslated] = useState<Analysis | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const needed = needsLocalTranslation(result, outputLanguage);
  const code = languageCode(outputLanguage);

  const run = async () => {
    if (!result.analysis) return;
    setState({ s: 'working' });
    try {
      const out = await translateAll(translatableStrings(result.analysis), code, (f) => setState({ s: 'working', progress: f }));
      const t = applyTranslations(result.analysis, out);
      setTranslated(t); setShowOriginal(false); onChange(t);
      setState({ s: 'done' });
    } catch (e) {
      setState({ s: 'error', msg: String((e as Error)?.message ?? e) });
    }
  };

  useEffect(() => {
    setTranslated(null); setShowOriginal(false); onChange(null);
    if (!needed) return;
    setState({ s: 'checking' });
    void translatorStatus(code).then((a) => {
      setAvail(a);
      setState({ s: 'idle' });
      if (a === 'available') void run(); // no download needed, so no user gesture needed
    });
  }, [result, code]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!needed) return null;
  if (avail === 'unavailable') {
    return <p className="text-sm text-slate-600">{outputLanguage} translation is not available in this browser, so this verdict is in English. Cloud checks can answer in {outputLanguage}.</p>;
  }
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg bg-brand-tint px-3 py-2 text-sm text-slate-800" aria-live="polite">
      {state.s === 'working' && <span>Translating to {outputLanguage} on your device{state.progress !== undefined && state.progress < 1 ? ` (downloading ${Math.round(state.progress * 100)}%)` : ''}…</span>}
      {state.s === 'checking' && <span>Checking {outputLanguage} translation…</span>}
      {state.s === 'idle' && avail && avail !== 'available' && (
        <button type="button" className="btn-link" onClick={() => void run()}>Show in {outputLanguage} (translated on this device)</button>
      )}
      {state.s === 'done' && translated && (
        <>
          <span>{showOriginal ? 'Showing the original English.' : `Translated to ${outputLanguage} on your device. Quotes stay as written on the page.`}</span>
          <button type="button" className="btn-link" onClick={() => { const o = !showOriginal; setShowOriginal(o); onChange(o ? null : translated); }}>
            {showOriginal ? `Show in ${outputLanguage}` : 'Show original'}
          </button>
        </>
      )}
      {state.s === 'error' && (
        <>
          <span>Could not translate: {state.msg}</span>
          <button type="button" className="btn-link" onClick={() => void run()}>Try again</button>
        </>
      )}
    </div>
  );
}
