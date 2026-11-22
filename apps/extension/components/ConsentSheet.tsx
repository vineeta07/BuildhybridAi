import { useEffect, useRef, useState } from 'react';
import { describeRedactions, type ConsentRequest } from '@satark/core';

export function ConsentSheet(props: { req: ConsentRequest; onAnswer: (ok: boolean, remember: boolean) => void }) {
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(false);
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => { first.current?.focus(); }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') props.onAnswer(false, false); };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, [props]);

  const hidden = describeRedactions(props.req.counts);
  return (
    <div className="fixed inset-0 z-20 flex items-end bg-slate-900/30" role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="consent-h" className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl border-t border-slate-200 bg-paper p-5 shadow-[0_-8px_24px_rgba(43,41,37,0.10)]">
        <h2 id="consent-h" className="font-display font-semibold text-xl">This check needs the cloud.</h2>
        <p className="mt-2 text-slate-700">
          Satark will send {props.req.chars.toLocaleString('en-US')} characters to Gemini through Firebase.
          {' '}{hidden === 'nothing' ? 'No personal details were found to hide.' : `Hidden first: ${hidden}.`}
        </p>
        <p className="mt-2 text-sm text-slate-500">Satark removes common patterns (phone, card, Aadhaar, OTP and more) but cannot guarantee that nothing sensitive remains.</p>
        <button type="button" className="btn-link mt-2 text-sm" aria-expanded={show} onClick={() => setShow(!show)}>
          {show ? 'Hide' : 'See exactly what will be sent'}
        </button>
        {show && (
          <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-800">{props.req.redactedText}</pre>
        )}
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 accent-brand" />
          Remember for this session
        </label>
        <div className="mt-4 flex flex-wrap gap-2">
          <button ref={first} type="button" className="btn-primary" onClick={() => props.onAnswer(true, remember)}>Send redacted text</button>
          <button type="button" className="btn-secondary" onClick={() => props.onAnswer(false, false)}>Stay on this device</button>
        </div>
      </div>
    </div>
  );
}
