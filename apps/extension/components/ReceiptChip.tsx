import { useState } from 'react';
import { describeRedactions, reasonSentence, receiptChip, type Receipt } from '@satark/core';
import { Chip, Cloud, Bolt } from './Icons';
import { firebaseConfigured } from '@/lib/firebase';

export function ReceiptChip({ r }: { r: Receipt }) {
  const [open, setOpen] = useState(false);
  const Icon = r.actualSource === 'cloud' ? Cloud : r.actualSource === 'on-device' ? Chip : Bolt;
  return (
    <div className="rounded-lg border border-slate-200 bg-white text-sm">
      <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Icon width={16} height={16} className="shrink-0 text-brand" />
        <span className="flex-1"><span className="sr-only">Privacy receipt: </span>{receiptChip(r)}</span>
        <span aria-hidden="true" className="text-slate-500">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="space-y-1 border-t border-slate-200 px-3 py-2 text-slate-700">
          <p>{r.decision.reason === 'RC_CLOUD_OFF' && !firebaseConfigured ? 'This build has no cloud setup, so the cloud was not used.' : reasonSentence(r)}</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-slate-600">
            <dt>Route</dt><dd>{r.decision.sdkMode} ({r.decision.reason})</dd>
            <dt>Input</dt><dd>{r.inputChars.toLocaleString('en-US')} characters{r.partial ? ' (most relevant part)' : ''}</dd>
            <dt>Sent</dt><dd>{r.charsSentToCloud.toLocaleString('en-US')} characters</dd>
            <dt>Hidden</dt><dd>{describeRedactions(r.redactions)}</dd>
            <dt>Evidence</dt><dd>{r.verifiedQuotes} verified, {r.droppedQuotes} dropped</dd>
            {r.attempts.length > 1 && (<><dt>Attempts</dt><dd>{r.attempts.map((a) => `${a.sdkMode} ${a.ok ? 'ok' : 'failed'}`).join(' → ')}</dd></>)}
          </dl>
        </div>
      )}
    </div>
  );
}
