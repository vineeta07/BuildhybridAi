import { useState } from 'react';
import type { OnDeviceStatus } from '@satark/core';
import { ModelSetup } from './ModelSetup';
import { ShieldCheck } from './Icons';

export function Onboarding(props: { status: OnDeviceStatus | 'checking'; refresh: () => void; onDone: (trySample: boolean) => void }) {
  const [step, setStep] = useState(0);
  return (
    <div className="space-y-4 p-4" aria-labelledby="ob-h">
      <p className="text-sm text-slate-500">Step {step + 1} of 3</p>
      {step === 0 && (
        <div className="card space-y-3">
          <ShieldCheck width={36} height={36} className="text-brand" />
          <h2 id="ob-h" className="text-lg font-semibold">Satark reads what you never read</h2>
          <p className="text-slate-700">Scam messages, fake KYC pages, and the fine print in loan, rent and subscription agreements. It explains the risk in plain words and shows the exact quote as proof.</p>
          <p className="font-medium text-slate-900">Nothing leaves your device unless you allow it.</p>
        </div>
      )}
      {step === 1 && (
        <div className="card space-y-3">
          <h2 id="ob-h" className="text-lg font-semibold">Turn on on-device AI</h2>
          <ModelSetup status={props.status} onDone={props.refresh} />
          <p className="text-sm text-slate-500">If this laptop cannot run it, Satark will ask before using the cloud, and hide personal details first.</p>
        </div>
      )}
      {step === 2 && (
        <div className="card space-y-3">
          <h2 id="ob-h" className="text-lg font-semibold">Try it</h2>
          <p className="text-slate-700">Check a safe, made-up fake-KYC message to see how a verdict and its Privacy Receipt look.</p>
          <button type="button" className="btn-primary" onClick={() => props.onDone(true)}>Try the sample message</button>
        </div>
      )}
      <div className="flex justify-between">
        <button type="button" className="btn-link text-sm" onClick={() => props.onDone(false)}>Skip</button>
        {step < 2 && <button type="button" className="btn-secondary" onClick={() => setStep(step + 1)}>Next</button>}
      </div>
    </div>
  );
}
