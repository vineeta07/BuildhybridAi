import { useState } from 'react';
import type { OnDeviceStatus } from '@satark/core';
import { downloadModel } from '@/lib/engine';

/** Download button with progress. The click handler itself starts the download (user activation). */
export function ModelSetup(props: { status: OnDeviceStatus | 'checking'; onDone: () => void; compact?: boolean }) {
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');

  const start = () => {
    setError(''); setProgress(0);
    downloadModel((f) => setProgress(f))
      .then(() => { setProgress(1); props.onDone(); })
      .catch((e: unknown) => { setProgress(null); setError(String((e as Error)?.message ?? e)); });
  };

  if (props.status === 'available') {
    return <p className="text-sm text-safe">On-device AI is ready. Checks can run without sending anything.</p>;
  }
  if (props.status === 'unavailable') {
    return (
      <div className="space-y-1 text-sm text-slate-700">
        <p>This laptop cannot run on-device AI, or it is turned off. Satark will ask before using the cloud.</p>
        {!props.compact && (
          <p className="text-slate-500">It needs desktop Chrome 139+, 22 GB of free disk, and a GPU with more than 4 GB of memory or 16 GB of RAM with 4+ cores. Diagnostics: <code>chrome://on-device-internals</code></p>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-700">
        {props.status === 'downloading' ? 'The on-device model is downloading.' : 'Download the on-device model (Gemini Nano) so checks can stay on this laptop.'} It can take a few minutes.
      </p>
      {progress === null ? (
        <button type="button" className="btn-primary" onClick={start}>Enable on-device AI</button>
      ) : (
        <div>
          <div className="h-2 w-full overflow-hidden rounded bg-slate-200" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} aria-label="Model download">
            <div className="h-full bg-brand transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <p className="mt-1 text-sm text-slate-600" aria-live="polite">{progress >= 1 ? 'Ready.' : `Downloading ${Math.round(progress * 100)}%`}</p>
        </div>
      )}
      {error && <p className="text-sm text-danger" role="alert">Could not start the download: {error}</p>}
    </div>
  );
}
