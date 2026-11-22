import { StrictMode, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@/assets/tailwind.css';
import { DEFAULT_SETTINGS, EMPTY_SIGNALS, flagged, scoreEval, shouldFlag, type EvalRun, type EvalSample } from '@satark/core';
import data from '../../../../eval/samples.json';
import { runEvalCheck } from '@/lib/engine';
import { loadRemote } from '@/lib/firebase';

/**
 * Developer page (not linked from the toolbar): runs the 30 synthetic samples through
 * ONLY_ON_DEVICE and ONLY_IN_CLOUD and prints accuracy, agreement, verified-quote rate and latency.
 * Nothing here is written to the receipt log.
 */
const samples = (data as { samples: EvalSample[] }).samples;
const pct = (x: number) => `${Math.round(x * 100)}%`;

function Eval() {
  const [runs, setRuns] = useState<EvalRun[]>([]);
  const [busy, setBusy] = useState(false);
  const [routes, setRoutes] = useState({ device: true, cloud: true });
  const stop = useRef(false);

  const start = async () => {
    setBusy(true); setRuns([]); stop.current = false;
    const remote = await loadRemote();
    const out: EvalRun[] = [];
    for (const s of samples) {
      for (const route of ['on-device', 'cloud'] as const) {
        if (stop.current) break;
        if ((route === 'on-device' && !routes.device) || (route === 'cloud' && !routes.cloud)) continue;
        try {
          const result = await runEvalCheck({
            snap: { origin: 'paste', url: '', title: '', lang: 'en', text: s.text, signals: EMPTY_SIGNALS },
            lens: s.lens, remote,
            settings: { ...DEFAULT_SETTINGS, mode: route === 'on-device' ? 'private' : 'cloud' },
          });
          out.push({ sampleId: s.id, route, result });
        } catch (e) {
          out.push({ sampleId: s.id, route, error: String((e as Error)?.message ?? e) });
        }
        setRuns([...out]);
      }
    }
    setBusy(false);
  };

  const report = scoreEval(samples, runs);
  const markdown = [
    '| Route | Ran | Accuracy | Verified quotes | Median latency |', '|---|---|---|---|---|',
    ...report.routes.map((r) => `| ${r.route} | ${r.ran} | ${pct(r.accuracy)} (${r.correct}/${r.ran}) | ${pct(r.verifiedQuoteRate)} | ${(r.medianLatencyMs / 1000).toFixed(1)} s |`),
    '', `Agreement between routes: ${report.agreement.agree} of ${report.agreement.both} samples (${pct(report.agreement.rate)}).`,
  ].join('\n');

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <header>
        <h1 className="font-display text-3xl font-semibold">Satark evaluation</h1>
        <p className="mt-1 text-slate-600">{samples.length} synthetic, fictional samples. Cloud runs skip the consent sheet because no real data is involved.</p>
      </header>
      <section className="card flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-brand" checked={routes.device} onChange={(e) => setRoutes({ ...routes, device: e.target.checked })} />On-device</label>
        <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-brand" checked={routes.cloud} onChange={(e) => setRoutes({ ...routes, cloud: e.target.checked })} />Cloud</label>
        {busy
          ? <button type="button" className="btn-secondary" onClick={() => { stop.current = true; }}>Stop</button>
          : <button type="button" className="btn-primary" onClick={() => void start()} disabled={!routes.device && !routes.cloud}>Run evaluation</button>}
        <span className="text-sm text-slate-600" aria-live="polite">{busy ? `Running… ${runs.length} done` : runs.length ? `${runs.length} runs finished` : 'Not run yet'}</span>
      </section>

      {runs.length > 0 && (
        <>
          <section className="grid gap-3 sm:grid-cols-3">
            {report.routes.map((r) => (
              <div key={r.route} className="card">
                <h2 className="font-display text-lg font-semibold">{r.route === 'on-device' ? 'On-device' : 'Cloud'}</h2>
                <p className="font-display text-3xl font-semibold">{r.ran ? pct(r.accuracy) : '–'}</p>
                <p className="text-sm text-slate-600">{r.correct}/{r.ran} correct, {r.failed} failed · {pct(r.verifiedQuoteRate)} quotes verified · {(r.medianLatencyMs / 1000).toFixed(1)} s median</p>
              </div>
            ))}
            <div className="card">
              <h2 className="font-display text-lg font-semibold">Agreement</h2>
              <p className="font-display text-3xl font-semibold">{report.agreement.both ? pct(report.agreement.rate) : '–'}</p>
              <p className="text-sm text-slate-600">{report.agreement.agree} of {report.agreement.both} samples run on both routes</p>
            </div>
          </section>
          <section className="card space-y-2">
            <h2 className="font-display text-lg font-semibold">For the README</h2>
            <pre className="overflow-auto rounded-lg border border-slate-200 bg-paper p-3 text-sm">{markdown}</pre>
            <button type="button" className="btn-secondary" onClick={() => void navigator.clipboard.writeText(markdown)}>Copy</button>
          </section>
          <section className="card overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr className="border-b border-slate-200 text-slate-600"><th className="py-2 pr-3">Sample</th><th className="pr-3">Expected</th><th className="pr-3">Route</th><th className="pr-3">Verdict</th><th>Result</th></tr></thead>
              <tbody>
                {runs.map((r, i) => {
                  const s = samples.find((x) => x.id === r.sampleId)!;
                  const ok = r.result?.kind === 'full' && shouldFlag(s.label) === flagged(r.result);
                  return (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="py-1.5 pr-3">{s.id}</td>
                      <td className="pr-3">{shouldFlag(s.label) ? 'flag' : 'no flag'}</td>
                      <td className="pr-3">{r.route}</td>
                      <td className="pr-3">{r.error ? 'error' : r.result?.kind === 'full' ? r.result.analysis?.verdict : 'no AI'}</td>
                      <td className={ok ? 'text-safe' : 'text-danger'}>{r.error ? r.error.slice(0, 60) : ok ? 'correct' : 'wrong'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        </>
      )}
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><Eval /></StrictMode>);
