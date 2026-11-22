import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@/assets/tailwind.css';
import { OUTPUT_LANGUAGES, type UserMode } from '@satark/core';
import { useOnDeviceStatus, useSettings } from '@/hooks/useStores';
import { ModelSetup } from '@/components/ModelSetup';
import { StatusDot } from '@/components/StatusLine';
import { Shield } from '@/components/Icons';
import { clearAllData, getCounters, getDebugToken, getGuardian, setDebugToken, setGuardian } from '@/lib/storage';
import { deleteSyncedData, syncToFirestore } from '@/lib/sync';
import { firebaseConfigured } from '@/lib/firebase';

const PRIVACY_URL = 'https://satark-demo.web.app/privacy.html';

const MODES: { id: UserMode; label: string; desc: string }[] = [
  { id: 'private', label: 'Private', desc: 'Never leaves this device. Needs on-device AI.' },
  { id: 'smart', label: 'Smart (recommended)', desc: 'On-device when it can; the cloud only when needed, with personal details hidden and your permission.' },
  { id: 'quality', label: 'Best quality', desc: 'Cloud first (redacted), on-device if you are offline.' },
  { id: 'cloud', label: 'Cloud only', desc: 'For laptops without on-device AI. Personal details are always hidden first.' },
];
const LANGS = Object.keys(OUTPUT_LANGUAGES);

function Options() {
  const [settings, update] = useSettings();
  const [status, refresh] = useOnDeviceStatus();
  const [token, setToken] = useState('');
  const [tokenSaved, setTokenSaved] = useState(false);
  const [guardian, setG] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  const toggleSync = async (on: boolean) => {
    const next = await update({ sync: on });
    setSyncMsg(on ? 'Syncing…' : 'Removing synced data…');
    try {
      if (on) await syncToFirestore(next, await getCounters());
      else await deleteSyncedData();
      setSyncMsg(on ? 'Synced.' : 'Synced data removed.');
    } catch (e) {
      setSyncMsg(`Could not reach Firebase: ${String((e as Error)?.message ?? e)}`);
    }
  };

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
        <h1 className="font-display font-semibold text-3xl">Satark options</h1>
      </header>

      <section className="card space-y-3" aria-labelledby="mode-h">
        <h2 id="mode-h" className="font-display font-semibold text-xl">Where checks run</h2>
        <div role="radiogroup" aria-labelledby="mode-h" className="space-y-2">
          {MODES.map((m) => (
            <label key={m.id} className="flex cursor-pointer gap-3 rounded-lg border border-transparent p-3 hover:bg-slate-50 has-[:checked]:border-brand/30 has-[:checked]:bg-brand-tint">
              <input type="radio" name="mode" className="mt-1 h-4 w-4 accent-brand" checked={settings.mode === m.id} onChange={() => void update({ mode: m.id })} />
              <span><span className="text-[15px] font-medium text-slate-900">{m.label}</span><br /><span className="text-sm text-slate-600">{m.desc}</span></span>
            </label>
          ))}
        </div>
      </section>

      <section className="card space-y-2" aria-labelledby="lang-h">
        <h2 id="lang-h" className="font-display font-semibold text-xl">Explanation language</h2>
        <label className="block text-sm text-slate-600" htmlFor="lang">Cloud checks answer in this language. On-device checks are translated on your device with Chrome's built-in translator when it supports the language. Quotes always stay as written on the page.</label>
        <select id="lang" className="rounded-lg border border-slate-300 bg-white p-2" value={settings.outputLanguage} onChange={(e) => void update({ outputLanguage: e.target.value })}>
          {LANGS.map((l) => <option key={l}>{l}</option>)}
        </select>
      </section>

      <section className="card space-y-2" aria-labelledby="od-h">
        <h2 id="od-h" className="font-display font-semibold text-xl">On-device AI</h2>
        <StatusDot status={status} simulate={settings.simulate} />
        <ModelSetup status={status} onDone={() => void refresh()} />
      </section>

      <section className="card space-y-2" aria-labelledby="g-h">
        <h2 id="g-h" className="font-display font-semibold text-xl">Guardian mode</h2>
        <p className="text-sm text-slate-600">Runs the instant, no-AI quick check on every page you open and shows a badge on the Satark icon when it sees red flags. Needs permission to read all sites; nothing is sent anywhere.</p>
        <button type="button" className="btn-secondary" onClick={() => void toggleGuardian()} aria-pressed={guardian}>
          {guardian ? 'Turn off Guardian mode' : 'Turn on Guardian mode'}
        </button>
      </section>

      <section className="card space-y-2" aria-labelledby="d-h">
        <h2 id="d-h" className="font-display font-semibold text-xl">Your data</h2>
        <label className="flex items-center gap-2">
          <input type="checkbox" className="h-4 w-4 accent-brand" checked={settings.keepSiteNames} onChange={(e) => void update({ keepSiteNames: e.target.checked })} />
          Keep site names in my log
        </label>
        <label className="flex items-start gap-2">
          <input type="checkbox" className="mt-1 h-4 w-4 accent-brand" checked={settings.sync} disabled={!firebaseConfigured} onChange={(e) => void toggleSync(e.target.checked)} />
          <span>Sync settings and counters to my anonymous Firebase account<br /><span className="text-sm text-slate-600">Only your mode, language and totals (checks run, share on-device). Never page text, site names or receipts. Turning it off deletes the synced copy.</span></span>
        </label>
        {syncMsg && <p className="text-sm text-slate-600" role="status">{syncMsg}</p>}
        <p className="text-sm text-slate-600">Satark never stores page text or the AI reply, only a receipt of where each check ran.</p>
        <button type="button" className="btn-secondary" onClick={() => void clearAllData().then(() => setCleared(true))}>Clear all data</button>
        {cleared && <p className="text-sm text-safe" role="status">Cleared.</p>}
        <p className="text-sm"><a className="btn-link" href={PRIVACY_URL} target="_blank" rel="noreferrer">Privacy policy</a></p>
      </section>

      <details className="card">
        <summary className="cursor-pointer font-display font-semibold text-xl">Developer</summary>
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
          <p><a className="btn-link" href={chrome.runtime.getURL('/eval.html')} target="_blank" rel="noreferrer">Open the evaluation page</a> <span className="text-sm text-slate-600">(runs 30 fictional samples through both routes)</span></p>
        </div>
      </details>

      <p className="text-sm text-slate-500">Satark {chrome.runtime.getManifest().version}</p>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><Options /></StrictMode>);
