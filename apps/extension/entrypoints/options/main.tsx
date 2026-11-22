import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@/assets/tailwind.css';
import type { UserMode } from '@satark/core';
import { useOnDeviceStatus, useSettings } from '@/hooks/useStores';
import { ModelSetup } from '@/components/ModelSetup';
import { StatusDot } from '@/components/StatusLine';
import { Shield } from '@/components/Icons';
import { clearAllData, getDebugToken, getGuardian, setDebugToken, setGuardian } from '@/lib/storage';

const PRIVACY_URL = 'https://satark-demo.web.app/privacy.html';

const MODES: { id: UserMode; label: string; desc: string }[] = [
  { id: 'private', label: 'Private', desc: 'Never leaves this device. Needs on-device AI.' },
  { id: 'smart', label: 'Smart (recommended)', desc: 'On-device when it can; the cloud only when needed, with personal details hidden and your permission.' },
  { id: 'quality', label: 'Best quality', desc: 'Cloud first (redacted), on-device if you are offline.' },
  { id: 'cloud', label: 'Cloud only', desc: 'For laptops without on-device AI. Personal details are always hidden first.' },
];
const LANGS = ['English', 'Hindi', 'Bengali', 'Tamil', 'Telugu', 'Marathi', 'Spanish', 'French', 'German', 'Japanese'];

function Options() {
  const [settings, update] = useSettings();
  const [status, refresh] = useOnDeviceStatus();
  const [token, setToken] = useState('');
  const [tokenSaved, setTokenSaved] = useState(false);
  const [guardian, setG] = useState(false);
  const [cleared, setCleared] = useState(false);

  useEffect(() => { void getDebugToken().then(setToken); void getGuardian().then(setG); }, []);

  const toggleGuardian = async () => {
    if (guardian) {
      await setGuardian(false); setG(false);
      await chrome.permissions.remove({ origins: ['<all_urls>'] }).catch(() => false);
      return;
    }
    // Must run inside the click handler: permissions.request needs a user gesture.
    const ok = await chrome.permissions.request({ origins: ['<all_urls>'] });
    if (ok) { await setGuardian(true); setG(true); }
  };

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <header className="flex items-center gap-2">
        <Shield className="text-brand" width={28} height={28} />
        <h1 className="text-2xl font-semibold">Satark options</h1>
      </header>

      <section className="card space-y-3" aria-labelledby="mode-h">
        <h2 id="mode-h" className="text-lg font-semibold">Where checks run</h2>
        <div role="radiogroup" aria-labelledby="mode-h" className="space-y-2">
          {MODES.map((m) => (
            <label key={m.id} className="flex cursor-pointer gap-3 rounded-lg p-2 hover:bg-slate-50">
              <input type="radio" name="mode" className="mt-1 h-4 w-4 accent-brand" checked={settings.mode === m.id} onChange={() => void update({ mode: m.id })} />
              <span><span className="font-medium">{m.label}</span><br /><span className="text-sm text-slate-600">{m.desc}</span></span>
            </label>
          ))}
        </div>
      </section>

      <section className="card space-y-2" aria-labelledby="lang-h">
        <h2 id="lang-h" className="text-lg font-semibold">Explanation language</h2>
        <label className="block text-sm text-slate-600" htmlFor="lang">Cloud checks explain in this language. On-device checks stay in English for now.</label>
        <select id="lang" className="rounded-lg border border-slate-300 p-2" value={settings.outputLanguage} onChange={(e) => void update({ outputLanguage: e.target.value })}>
          {LANGS.map((l) => <option key={l}>{l}</option>)}
        </select>
      </section>

      <section className="card space-y-2" aria-labelledby="od-h">
        <h2 id="od-h" className="text-lg font-semibold">On-device AI</h2>
        <StatusDot status={status} simulate={settings.simulate} />
        <ModelSetup status={status} onDone={() => void refresh()} />
      </section>

      <section className="card space-y-2" aria-labelledby="g-h">
        <h2 id="g-h" className="text-lg font-semibold">Guardian mode</h2>
        <p className="text-sm text-slate-600">Runs the instant, no-AI quick check on every page you open and shows a badge on the Satark icon when it sees red flags. Needs permission to read all sites; nothing is sent anywhere.</p>
        <button type="button" className="btn-secondary" onClick={() => void toggleGuardian()} aria-pressed={guardian}>
          {guardian ? 'Turn off Guardian mode' : 'Turn on Guardian mode'}
        </button>
      </section>

      <section className="card space-y-2" aria-labelledby="d-h">
        <h2 id="d-h" className="text-lg font-semibold">Your data</h2>
        <label className="flex items-center gap-2">
          <input type="checkbox" className="h-4 w-4 accent-brand" checked={settings.keepSiteNames} onChange={(e) => void update({ keepSiteNames: e.target.checked })} />
          Keep site names in my log
        </label>
        <p className="text-sm text-slate-600">Satark never stores page text or the AI reply, only a receipt of where each check ran.</p>
        <button type="button" className="btn-secondary" onClick={() => void clearAllData().then(() => setCleared(true))}>Clear all data</button>
        {cleared && <p className="text-sm text-safe" role="status">Cleared.</p>}
        <p className="text-sm"><a className="btn-link" href={PRIVACY_URL} target="_blank" rel="noreferrer">Privacy policy</a></p>
      </section>

      <details className="card">
        <summary className="cursor-pointer text-lg font-semibold">Developer</summary>
        <div className="mt-3 space-y-4">
          <div className="space-y-1">
            <label htmlFor="tok" className="block font-medium">App Check debug token</label>
            <p className="text-sm text-slate-600">Type <code>true</code> and reload the side panel to make the SDK print a new token in the panel's DevTools console, register it in the Firebase console, then paste it here. Never commit it.</p>
            <div className="flex gap-2">
              <input id="tok" type="password" autoComplete="off" className="flex-1 rounded-lg border border-slate-300 p-2 font-mono text-sm" value={token} onChange={(e) => { setToken(e.target.value); setTokenSaved(false); }} />
              <button type="button" className="btn-secondary" onClick={() => void setDebugToken(token).then(() => setTokenSaved(true))}>Save</button>
            </div>
            {tokenSaved && <p className="text-sm text-safe" role="status">Saved. Reopen the side panel to use it.</p>}
          </div>
          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-brand" checked={settings.simulate} onChange={(e) => void update({ simulate: e.target.checked })} />
            <span>Pretend this laptop cannot run on-device AI<br /><span className="text-sm text-slate-600">Forces the cloud fallback for demos. Every receipt it produces says "simulated".</span></span>
          </label>
        </div>
      </details>

      <p className="text-sm text-slate-500">Satark {chrome.runtime.getManifest().version}</p>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><Options /></StrictMode>);
