import { useEffect, useState } from 'react';
import { EMPTY_SIGNALS, SAMPLE_SCAM_SMS, suggestLens, type Lens, type PageSnapshot } from '@satark/core';
import { ResultView } from '@/components/ResultView';
import { detectLang } from '@/lib/engine';
import type { useCheck } from '@/hooks/useCheck';

export function PasteTab(props: {
  check: ReturnType<typeof useCheck>;
  incoming: { text: string; url: string; token: number; origin: 'paste' | 'selection' } | null;
  onFix: (fix: 'download' | 'cloud', snap: PageSnapshot, lens: Lens) => void;
}) {
  const { check } = props;
  const [text, setText] = useState('');
  const [lens, setLens] = useState<Lens>('scam');
  const [last, setLast] = useState<PageSnapshot | null>(null);

  const go = async (t: string, origin: 'paste' | 'selection', url = '') => {
    const body = t.trim().slice(0, 40_000);
    if (!body) return;
    const l = suggestLens(url, '', body);
    setLens(l);
    const snap: PageSnapshot = { origin, url, title: '', lang: await detectLang(body, 'und'), text: body, signals: EMPTY_SIGNALS };
    setLast(snap);
    void check.run(snap, l);
  };

  useEffect(() => {
    if (props.incoming) { setText(props.incoming.text); void go(props.incoming.text, props.incoming.origin, props.incoming.url); }
  }, [props.incoming?.token]); // eslint-disable-line react-hooks/exhaustive-deps

  const st = check.state;
  return (
    <div className="space-y-3">
      <label htmlFor="paste" className="block font-medium">Paste a message, email or agreement</label>
      <textarea
        id="paste" value={text} onChange={(e) => setText(e.target.value)} rows={8} maxLength={40_000}
        className="w-full rounded-lg border border-slate-300 bg-white p-3 text-[15px] placeholder:text-slate-500 focus:border-brand"
        placeholder="For example, an SMS that says your account will be blocked"
      />
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-primary" disabled={!text.trim() || st.s === 'running'} onClick={() => void go(text, 'paste')}>Check this message</button>
        <button type="button" className="btn-link text-sm" onClick={() => setText(SAMPLE_SCAM_SMS)}>Try a sample scam message</button>
      </div>
      <div aria-live="polite">
        {st.s === 'running' && (
          <div className="space-y-2" role="status">
            <p className="text-slate-700">{st.where === 'cloud' ? 'Checking in the cloud (personal details hidden)…' : 'Checking on your device…'}</p>
            <button type="button" className="btn-secondary" onClick={check.cancel}>Cancel</button>
          </div>
        )}
        {st.s === 'error' && <p className="card text-danger" role="alert">Something went wrong: {st.message}</p>}
        {st.s === 'result' && <ResultView result={st.result} onFix={last ? (fix) => props.onFix(fix, last, lens) : undefined} />}
      </div>
    </div>
  );
}
