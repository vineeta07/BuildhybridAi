import { useState } from 'react';
import type { OnDeviceStatus } from '@satark/core';
import { ModelSetup } from './ModelSetup';
import { ShieldCheck } from './Icons';

export function Onboarding(props: { status: OnDeviceStatus | 'checking'; refresh: () => void; onDone: (trySample: boolean) => void }) {
  const [step, setStep] = useState(0);
  return (
    <div className="space-y-4 p-4" aria-labelledby="ob-h">
      <div className="flex items-center gap-2" aria-label={`Step ${step + 1} of 3`}>{[0, 1, 2].map((i) => <span key={i} aria-hidden="true" className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-brand' : 'w-1.5 bg-slate-300'}`} />)}<span className="ml-2 text-sm text-slate-500">Step {step + 1} of 3</span></div>
      {step === 0 && (
        <div className="card space-y-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-brand-tint text-brand"><ShieldCheck width={24} height={24} /></span>
          <h2 id="ob-h" className="font-display font-semibold text-xl">Satark reads what you never read</h2>
          <p className="text-slate-700">Scam messages, fake KYC pages, and the fine print in loan, rent and subscription agreements. It explains the risk in plain words and shows the exact quote as proof.</p>
          <p className="font-medium text-slate-900">Nothing leaves your device unless you allow it.</p>
        </div>
      )}
      {step === 1 && (
        <div className="card space-y-3">
          <h2 id="ob-h" className="font-display font-semibold text-xl">Turn on on-device AI</h2>
          <ModelSetup status={props.status} onDone={props.refresh} />
          <p className="text-sm text-slate-500">If this laptop cannot run it, Satark will ask before using the cloud, and hide personal details first.</p>
        </div>
      )}
      {step === 2 && (
        <div className="card space-y-3">
          <h2 id="ob-h" className="font-display font-semibold text-xl">Try it</h2>
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
