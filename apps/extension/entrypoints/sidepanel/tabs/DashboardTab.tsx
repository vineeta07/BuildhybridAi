import { onDeviceShare, receiptChip, reasonSentence } from '@satark/core';
import { useLog } from '@/hooks/useStores';
import { clearReceipts } from '@/lib/storage';

export function DashboardTab() {
  const { receipts, counters } = useLog();

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ counters, receipts }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `satark-receipts-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Checks run" value={counters.checks.toLocaleString('en-US')} />
        <Stat label="Done on-device" value={`${onDeviceShare(counters)}%`} />
        <Stat label="Characters kept on device" value={counters.charsKeptLocal.toLocaleString('en-US')} />
      </div>
      <p className="text-sm text-slate-600">
        {counters.flags} flags raised, {counters.verifiedFlags} with a verified quote, {counters.droppedFlags} dropped because the quote could not be found.
      </p>
      <div className="flex gap-2">
        <button type="button" className="btn-secondary" onClick={exportJson} disabled={!receipts.length}>Export JSON</button>
        <button type="button" className="btn-secondary" onClick={() => { if (confirm('Clear all receipts and counters?')) void clearReceipts(); }} disabled={!receipts.length && !counters.checks}>Clear all</button>
      </div>
      <h2 className="font-semibold">Last {receipts.length} receipts</h2>
      {receipts.length === 0 ? (
        <p className="text-sm text-slate-600">No checks yet. Receipts hold only metadata: where a check ran, why, and how much left the device. Never the text.</p>
      ) : (
        <ul className="space-y-2">
          {receipts.map((r) => (
            <li key={r.id} className="card p-3 text-sm">
              <div className="flex justify-between gap-2 text-slate-500">
                <span>{r.site ?? (r.origin === 'page' ? 'Web page' : r.origin === 'selection' ? 'Selected text' : 'Pasted text')} · {r.lens === 'scam' ? 'Scams' : 'Fine print'}</span>
                <time dateTime={new Date(r.at).toISOString()}>{new Date(r.at).toLocaleString()}</time>
              </div>
              <p className="mt-1 font-medium text-slate-800">{receiptChip(r)}</p>
              <p className="text-slate-600">{reasonSentence(r)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-3 text-center">
      <div className="text-xl font-semibold text-brand">{value}</div>
      <div className="text-xs text-slate-600">{label}</div>
    </div>
  );
}
