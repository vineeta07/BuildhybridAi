import { useEffect, useState } from 'react';
import { applyTranslations, languageCode, languageInfo, needsLocalTranslation, translatableStrings, type Analysis, type CheckResult } from '@satark/core';
import { translateAll, translatorStatus, type TranslatorStatus } from '@/lib/translator';

type State = { s: 'idle' | 'checking' | 'working' | 'done' | 'error'; msg?: string; progress?: number };

/**
 * Translates an on-device verdict into the chosen language with Chrome's on-device Translator.
 * Quotes are never translated, so they still match the page. When Chrome cannot translate the
 * language on this device, offers to have the cloud explain it in that language instead.
 */
export function TranslateBar(props: {
  result: CheckResult; outputLanguage: string;
  onChange: (a: Analysis | null) => void;
  onCloudExplain?: (() => void) | undefined;
}) {
  const { result, outputLanguage, onChange } = props;
  const [state, setState] = useState<State>({ s: 'idle' });
  const [avail, setAvail] = useState<TranslatorStatus | null>(null);
  const [translated, setTranslated] = useState<Analysis | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const needed = needsLocalTranslation(result, outputLanguage);
  const code = languageCode(outputLanguage);
  const lang = languageInfo(code);
  const label = lang.native === lang.name ? lang.name : `${lang.native} (${lang.name})`;

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
    return (
      <div className="space-y-1 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">
        <p>This browser cannot translate to {label} on your device, so this verdict is in English.</p>
        {props.onCloudExplain && (
          <button type="button" className="btn-link" onClick={props.onCloudExplain}>Explain in {lang.name} using the cloud (personal details hidden, asks first)</button>
        )}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg bg-brand-tint px-3 py-2 text-sm text-slate-800" aria-live="polite">
      {state.s === 'working' && <span>Translating to {label} on your device{state.progress !== undefined && state.progress < 1 ? ` (downloading ${Math.round(state.progress * 100)}%)` : ''}…</span>}
      {state.s === 'checking' && <span>Checking {lang.name} translation…</span>}
      {state.s === 'idle' && avail && avail !== 'available' && (
        <button type="button" className="btn-link" onClick={() => void run()}>Show in <span lang={code}>{lang.native}</span> (translated on this device)</button>
      )}
      {state.s === 'done' && translated && (
        <>
          <span>{showOriginal ? 'Showing the original English.' : `Translated to ${lang.name} on your device. Quotes stay as written on the page.`}</span>
          <button type="button" className="btn-link" onClick={() => { const o = !showOriginal; setShowOriginal(o); onChange(o ? null : translated); }}>
            {showOriginal ? <>Show in <span lang={code}>{lang.native}</span></> : 'Show original'}
          </button>
        </>
      )}
      {state.s === 'error' && (
        <>
          <span>Could not translate: {state.msg}</span>
          <button type="button" className="btn-link" onClick={() => void run()}>Try again</button>
          {props.onCloudExplain && <button type="button" className="btn-link" onClick={props.onCloudExplain}>Explain in {lang.name} using the cloud</button>}
        </>
      )}
    </div>
  );
}
