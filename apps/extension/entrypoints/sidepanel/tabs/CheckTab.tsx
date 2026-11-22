import { useCallback, useEffect, useState } from 'react';
import { tier0, type Lens, type PageSnapshot, type RemoteSettings, type Tier0Result } from '@satark/core';
import { Tier0Chip } from '@/components/Tier0Chip';
import { ResultView } from '@/components/ResultView';
import { SnapshotFailure, highlight, requestSnapshot } from '@/lib/messaging';
import { detectLang } from '@/lib/engine';
import type { useCheck } from '@/hooks/useCheck';

type Check = ReturnType<typeof useCheck>;

export function CheckTab(props: {
  check: Check; remote: RemoteSettings; requestToken: number;
  onFix: (fix: 'download' | 'cloud', snap: PageSnapshot, lens: Lens) => void;
}) {
  const { check, remote } = props;
  const [snap, setSnap] = useState<PageSnapshot | null>(null);
  const [t0, setT0] = useState<Tier0Result | null>(null);
  const [lens, setLens] = useState<Lens>('scam');
  const [problem, setProblem] = useState<'navigated' | 'unreadable' | 'other' | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (): Promise<{ snap: PageSnapshot; lens: Lens } | null> => {
    setLoading(true); setProblem(null);
    try {
      const raw = await requestSnapshot();
      const s = { ...raw, lang: await detectLang(raw.text, raw.lang) };
      const r = tier0({ url: s.url, title: s.title, text: s.text, signals: s.signals, phrases: remote.scamPhrases });
      setSnap(s); setT0(r); setLens(r.suggestedLens);
      return { snap: s, lens: r.suggestedLens };
    } catch (e) {
      setSnap(null); setT0(null);
      setProblem(e instanceof SnapshotFailure && e.kind !== 'unknown' && e.kind !== 'no_tab' ? e.kind : 'other');
      return null;
    } finally { setLoading(false); }
  }, [remote.scamPhrases]);

  // A toolbar click, the shortcut, or the panel opening: read the page and run the check.
  useEffect(() => {
    if (props.requestToken === 0) return;
    void (async () => {
      const got = await load();
      if (got && got.snap.text.trim().length > 0) void check.run(got.snap, got.lens);
    })();
  }, [props.requestToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const runNow = async () => {
    const got = snap ? { snap, lens } : await load();
    if (got) void check.run(got.snap, snap ? lens : got.lens);
  };

  const st = check.state;
  return (
    <div className="space-y-4">
      {problem === 'navigated' && (
        <p className="card text-slate-700" role="status">Click the Satark icon on this page to check it. Chrome only lets Satark read a page right after you ask.</p>
      )}
      {problem === 'unreadable' && (
        <p className="card text-slate-700" role="status">Satark cannot read this page. Chrome blocks extensions on its own pages, the Web Store and some PDFs. Try copying the text into the Paste tab.</p>
      )}
      {problem === 'other' && (
        <p className="card text-slate-700" role="status">Satark could not read this page. Click the Satark icon on the page, or paste the text instead.</p>
      )}

      {snap && (
        <div className="space-y-2">
          <p className="truncate font-display font-semibold text-base text-slate-900" title={snap.title}>{snap.title || snap.url}</p>
          {t0 && <Tier0Chip r={t0} />}
          {!snap.text.trim() && <p className="text-sm text-slate-600">This page has no readable text.</p>}
        </div>
      )}

      {(st.s === 'idle' || st.s === 'error' || st.s === 'result') && (
        <div className="space-y-3">
          <fieldset className="flex gap-1 rounded-lg bg-slate-100 p-1">
            <legend className="sr-only">What to look for</legend>
            {(['scam', 'fineprint'] as const).map((l) => (
              <label key={l} className={`flex-1 cursor-pointer rounded-md px-3 py-1.5 text-center text-sm font-medium ${lens === l ? 'bg-white text-slate-900 shadow-[0_1px_2px_rgba(43,41,37,0.08)]' : 'text-slate-600'}`}>
                <input type="radio" name="lens" value={l} checked={lens === l} onChange={() => setLens(l)} className="sr-only" />
                {l === 'scam' ? 'Scams' : 'Fine print'}
              </label>
            ))}
          </fieldset>
          <button type="button" className="btn-primary w-full" disabled={loading} onClick={() => void runNow()}>
            {loading ? 'Reading the page…' : st.s === 'result' ? 'Check again' : 'Check this page'}
          </button>
        </div>
      )}

      <div aria-live="polite">
        {st.s === 'running' && (
          <div className="space-y-3" role="status">
            <p className="text-slate-700">{st.where === 'cloud' ? 'Checking in the cloud (personal details hidden)…' : 'Checking on your device…'}</p>
            <div className="space-y-2" aria-hidden="true">
              {[80, 95, 60].map((w) => <div key={w} className="h-4 animate-pulse rounded bg-slate-200" style={{ width: `${w}%` }} />)}
            </div>
            <button type="button" className="btn-secondary" onClick={check.cancel}>Cancel</button>
          </div>
        )}
        {st.s === 'error' && <p className="card text-danger" role="alert">Something went wrong: {st.message}</p>}
        {st.s === 'result' && (
          <ResultView
            result={st.result}
            onShow={(q, all) => void highlight([q, ...all.filter((x) => x !== q)])}
            onFix={snap ? (fix) => props.onFix(fix, snap, lens) : undefined}
          />
        )}
      </div>
    </div>
  );
}
