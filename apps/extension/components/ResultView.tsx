import { useEffect, useRef, useState } from 'react';
import { REASON_SENTENCE, type CheckResult, type Reason, type VerdictLevel } from '@satark/core';
import { Alert, Octagon, ShieldCheck } from './Icons';
import { ReceiptChip } from './ReceiptChip';
import { firebaseConfigured } from '@/lib/firebase';
import { Tier0Chip } from './Tier0Chip';

const VERDICT: Record<VerdictLevel, { words: string; cls: string; Icon: typeof Alert }> = {
  danger: { words: 'Looks risky', cls: 'bg-danger-bg text-danger border-danger/30', Icon: Octagon },
  caution: { words: 'Be careful', cls: 'bg-caution-bg text-caution border-caution/30', Icon: Alert },
  safe: { words: 'No red flags found', cls: 'bg-safe-bg text-safe border-safe/30', Icon: ShieldCheck },
};

const CATEGORY_LABEL: Record<string, string> = {
  urgency_threat: 'Urgency or threat', impersonation: 'Impersonation', credential_request: 'Asks for secrets',
  advance_fee: 'Upfront fee', too_good_to_be_true: 'Too good to be true', risky_payment: 'Risky payment',
  secrecy_pressure: 'Secrecy pressure', link_mismatch: 'Link mismatch', auto_renewal: 'Auto-renewal',
  fees_penalties: 'Fees and penalties', data_sharing: 'Data sharing', arbitration_waiver: 'Arbitration / waiver',
  unilateral_change: 'Terms can change', liability_limit: 'Liability limit', lock_in: 'Lock-in', other: 'Other',
};

function warningText(r: CheckResult): string {
  const a = r.analysis;
  if (!a) return '';
  const lines = [
    `Satark check: ${VERDICT[a.verdict].words}. ${a.headline}`,
    a.summary,
    ...a.reasons.map((x) => `• ${x.explanation} ("${x.quote}")`),
    ...(a.advice.length ? ['What to do:', ...a.advice.map((x) => `• ${x}`)] : []),
    'Never share an OTP, PIN or password with anyone, even if they say they are from your bank.',
  ];
  return lines.join('\n');
}

export function ResultView(props: {
  result: CheckResult; onShow?: (quote: string, all: string[]) => void; onFix?: (fix: 'download' | 'cloud') => void;
}) {
  const { result } = props;
  const heading = useRef<HTMLHeadingElement>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => { heading.current?.focus(); }, [result]);

  if (result.kind === 'limited') {
    const r = result.receipt;
    const why =
      result.limitedCause === 'consent_declined' ? 'You chose to stay on this device, so only quick checks ran.'
      : result.limitedCause === 'private_unavailable' ? 'Private mode needs on-device AI, which is not ready on this laptop.'
      : result.limitedCause === 'all_attempts_failed' ? 'The AI check could not finish, so only quick checks ran.'
      : r.decision.reason === 'RC_CLOUD_OFF' && !firebaseConfigured ? 'On-device AI is not ready, and this build has no cloud setup, so only quick checks ran.'
      : REASON_SENTENCE[r.decision.reason];
    return (
      <section aria-labelledby="result-h" className="space-y-3">
        <h2 id="result-h" ref={heading} tabIndex={-1} className="text-lg font-semibold">Limited check (no AI)</h2>
        <p className="text-sm text-slate-700">{why}</p>
        <Tier0Chip r={result.tier0} expanded />
        <div className="flex flex-wrap gap-2">
          {props.onFix && <button type="button" className="btn-secondary" onClick={() => props.onFix?.('download')}>Enable on-device AI</button>}
          {props.onFix && r.requestedMode !== 'private' && r.decision.reason !== 'RC_CLOUD_OFF' && firebaseConfigured && navigator.onLine && (
            <button type="button" className="btn-secondary" onClick={() => props.onFix?.('cloud')}>Allow a cloud check</button>
          )}
        </div>
        <ReceiptChip r={r} />
      </section>
    );
  }

  const a = result.analysis!;
  const v = VERDICT[a.verdict];
  const quotes = a.reasons.map((x) => x.quote);
  return (
    <section aria-labelledby="result-h" className="space-y-3">
      <div className={`flex items-start gap-3 rounded-xl border p-4 ${v.cls}`}>
        <v.Icon width={28} height={28} className="mt-0.5 shrink-0" />
        <div>
          <h2 id="result-h" ref={heading} tabIndex={-1} className="text-lg font-semibold">{v.words}</h2>
          <p className="font-medium text-slate-900">{a.headline}</p>
        </div>
      </div>
      <p className="text-slate-800">{a.summary}</p>
      {result.evidenceUnverified && (
        <p className="rounded-lg bg-caution-bg px-3 py-2 text-sm text-caution">Evidence could not be verified, so this is shown as a caution.</p>
      )}
      {result.partialNote && <p className="text-sm text-slate-600">{result.partialNote}.</p>}
      {a.reasons.length > 0 && (
        <ul className="space-y-2" aria-label="Reasons">
          {a.reasons.map((x, i) => <ReasonRow key={i} r={x} onShow={props.onShow ? () => props.onShow?.(x.quote, quotes) : undefined} />)}
        </ul>
      )}
      {a.advice.length > 0 && (
        <div>
          <h3 className="font-semibold">What you can do</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-800">{a.advice.map((x, i) => <li key={i}>{x}</li>)}</ul>
        </div>
      )}
      <ReceiptChip r={result.receipt} />
      <button type="button" className="btn-link text-sm" onClick={() => {
        void navigator.clipboard.writeText(warningText(result)).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
      }}>{copied ? 'Copied' : 'Copy a warning for family'}</button>
      <p className="text-xs text-slate-500">Satark helps you notice red flags. It cannot guarantee a page is safe.</p>
    </section>
  );
}

function ReasonRow({ r, onShow }: { r: Reason; onShow?: (() => void) | undefined }) {
  const sev = r.severity === 'high' ? 'text-danger' : r.severity === 'medium' ? 'text-caution' : 'text-slate-600';
  return (
    <li className="card space-y-2 p-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">{CATEGORY_LABEL[r.category] ?? r.category}</span>
        <span className={`font-medium ${sev}`}>{r.severity} severity</span>
      </div>
      <p className="text-slate-800">{r.explanation}</p>
      <blockquote className="border-l-4 border-brand/40 pl-3 text-sm italic text-slate-700">“{r.quote}”</blockquote>
      {onShow && <button type="button" className="btn-link text-sm" onClick={onShow}>Show on page</button>}
    </li>
  );
}
