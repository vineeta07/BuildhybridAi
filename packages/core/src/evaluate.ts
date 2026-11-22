import type { CheckResult } from './types';

export type SampleLabel = 'scam' | 'benign' | 'risky' | 'ordinary';
export interface EvalSample { id: string; lens: 'scam' | 'fineprint'; label: SampleLabel; text: string }
export interface EvalRun { sampleId: string; route: 'on-device' | 'cloud'; result?: CheckResult; error?: string }

/** A sample is "flagged" when the AI says caution or danger. Scam and risky samples should be flagged. */
export const shouldFlag = (l: SampleLabel) => l === 'scam' || l === 'risky';
export const flagged = (r: CheckResult) => r.kind === 'full' && r.analysis !== undefined && r.analysis.verdict !== 'safe';

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : Math.round((s[m - 1]! + s[m]!) / 2);
};

export interface RouteScore {
  route: 'on-device' | 'cloud'; ran: number; failed: number; correct: number; accuracy: number;
  verifiedQuoteRate: number; medianLatencyMs: number;
}
export interface EvalReport { routes: RouteScore[]; agreement: { both: number; agree: number; rate: number } }

/** Pure scoring for the evaluation page: accuracy per route, agreement, verified-quote rate, latency. */
export function scoreEval(samples: EvalSample[], runs: EvalRun[]): EvalReport {
  const byId = new Map(samples.map((s) => [s.id, s]));
  const routes = (['on-device', 'cloud'] as const).map((route): RouteScore => {
    const rs = runs.filter((r) => r.route === route);
    const ok = rs.filter((r) => r.result?.kind === 'full');
    const correct = ok.filter((r) => shouldFlag(byId.get(r.sampleId)!.label) === flagged(r.result!)).length;
    const v = ok.reduce((a, r) => a + r.result!.receipt.verifiedQuotes, 0);
    const d = ok.reduce((a, r) => a + r.result!.receipt.droppedQuotes, 0);
    return {
      route, ran: ok.length, failed: rs.length - ok.length, correct,
      accuracy: ok.length ? correct / ok.length : 0,
      verifiedQuoteRate: v + d ? v / (v + d) : 0,
      medianLatencyMs: median(ok.map((r) => r.result!.receipt.latencyMs)),
    };
  });
  let both = 0, agree = 0;
  for (const s of samples) {
    const a = runs.find((r) => r.sampleId === s.id && r.route === 'on-device' && r.result?.kind === 'full');
    const b = runs.find((r) => r.sampleId === s.id && r.route === 'cloud' && r.result?.kind === 'full');
    if (!a || !b) continue;
    both++;
    if (flagged(a.result!) === flagged(b.result!)) agree++;
  }
  return { routes, agreement: { both, agree, rate: both ? agree / both : 0 } };
}
