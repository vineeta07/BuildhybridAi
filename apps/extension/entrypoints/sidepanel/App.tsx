import { useCallback, useEffect, useMemo, useState } from 'react';
import { SAMPLE_SCAM_SMS, versionLessThan, type ConsentRequest, type Lens, type Msg, type PageSnapshot, type UserMode } from '@satark/core';
import { useCheck } from '@/hooks/useCheck';
import { useOnDeviceStatus, useOnline, useRemote, useSettings } from '@/hooks/useStores';
import { ConsentSheet } from '@/components/ConsentSheet';
import { Onboarding } from '@/components/Onboarding';
import { StatusDot } from '@/components/StatusLine';
import { ModelSetup } from '@/components/ModelSetup';
import { Gear, Shield } from '@/components/Icons';
import { getConsentRemembered, isOnboarded, setConsentRemembered, setOnboarded } from '@/lib/storage';
import { firebaseConfigured } from '@/lib/firebase';
import { CheckTab } from './tabs/CheckTab';
import { PasteTab } from './tabs/PasteTab';
import { DashboardTab } from './tabs/DashboardTab';

type Tab = 'check' | 'paste' | 'dashboard';
const MODE_LABEL: Record<UserMode, string> = { private: 'Private', smart: 'Smart', quality: 'Best quality', cloud: 'Cloud only' };

export default function App() {
  const [settings] = useSettings();
  const remote = useRemote();
  const [status, refreshStatus] = useOnDeviceStatus();
  const online = useOnline();
  const [tab, setTab] = useState<Tab>('check');
  const [onboarded, setOb] = useState<boolean | null>(null);
  const [consent, setConsent] = useState<{ req: ConsentRequest; resolve: (ok: boolean) => void } | null>(null);
  const [checkToken, setCheckToken] = useState(0);
  const [incoming, setIncoming] = useState<{ text: string; url: string; token: number; origin: 'paste' | 'selection' } | null>(null);
  const [showModel, setShowModel] = useState(false);

  useEffect(() => { void isOnboarded().then(setOb); }, []);

  const askConsent = useCallback(async (req: ConsentRequest) => {
    if (await getConsentRemembered()) return true;
    return new Promise<boolean>((resolve) => setConsent({ req, resolve }));
  }, []);

  const checkOpts = useMemo(() => ({ settings, remote, askConsent, highlightOnPage: true }), [settings, remote, askConsent]);
  const pasteOpts = useMemo(() => ({ settings, remote, askConsent, highlightOnPage: false }), [settings, remote, askConsent]);
  const pageCheck = useCheck(checkOpts);
  const pasteCheck = useCheck(pasteOpts);

  // Requests handed over by the service worker through storage.session.
  useEffect(() => {
    const take = async () => {
      const { pending } = (await chrome.storage.session.get('pending')) as { pending?: Msg };
      if (!pending) return;
      await chrome.storage.session.remove(['pending', 'pendingAt']);
      if (pending.t === 'CHECK_REQUESTED') { setTab('check'); setCheckToken((n) => n + 1); }
      if (pending.t === 'SELECTION') { setTab('paste'); setIncoming({ text: pending.text, url: pending.url, token: Date.now(), origin: 'selection' }); }
    };
    void take();
    const l = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'session' && changes.pending?.newValue) void take();
    };
    chrome.storage.onChanged.addListener(l);
    return () => chrome.storage.onChanged.removeListener(l);
  }, []);

  const onFix = (fix: 'download' | 'cloud', snap: PageSnapshot, lens: Lens) => {
    if (fix === 'download') { setShowModel(true); return; }
    // "Allow a cloud check": one check in Cloud-only mode, still redacted and with consent.
    const run = snap.origin === 'page' ? pageCheck.run : pasteCheck.run;
    void run(snap, lens, 'cloud');
  };

  if (onboarded === null) return null;
  if (!onboarded) {
    return (
      <Onboarding status={status} refresh={() => void refreshStatus()} onDone={(trySample) => {
        void setOnboarded(); setOb(true);
        if (trySample) { setTab('paste'); setIncoming({ text: SAMPLE_SCAM_SMS, url: '', token: Date.now(), origin: 'paste' }); }
      }} />
    );
  }

  const version = chrome.runtime.getManifest().version;
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-paper px-4 py-3">
        <div className="flex items-center gap-2">
          <Shield className="text-brand" width={22} height={22} />
          <h1 className="font-display font-semibold text-xl">Satark</h1>
          <button type="button" className="ml-1 rounded-full bg-brand-tint px-2.5 py-0.5 text-sm font-medium text-brand hover:bg-brand/15" onClick={() => void chrome.runtime.openOptionsPage()} title="Change mode in Options">
            <span className="sr-only">Mode: </span>{MODE_LABEL[settings.mode]}
          </button>
          <button type="button" className="ml-auto rounded p-1 text-slate-600 hover:bg-slate-100 hover:text-slate-900" aria-label="Open options" onClick={() => void chrome.runtime.openOptionsPage()}>
            <Gear />
          </button>
        </div>
        <div className="mt-1"><StatusDot status={status} simulate={settings.simulate} /></div>
      </header>

      {versionLessThan(version, remote.minExtensionVersion) && (
        <p className="bg-caution-bg px-4 py-2 text-sm text-caution" role="status">A newer version of Satark is available. Please update.</p>
      )}
      {!online && <p className="bg-slate-100 px-4 py-2 text-sm text-slate-700" role="status">You are offline. On-device checks still work; cloud checks are off.</p>}
      {!firebaseConfigured && <p className="bg-slate-100 px-4 py-2 text-sm text-slate-700" role="status">This build has no Firebase config, so only on-device and quick checks are available.</p>}
      {showModel && (
        <div className="card m-4 space-y-2">
          <ModelSetup status={status} onDone={() => { void refreshStatus(); setShowModel(false); }} />
          <button type="button" className="btn-link text-sm" onClick={() => setShowModel(false)}>Close</button>
        </div>
      )}

      <nav className="mx-4 mt-3 flex gap-1 rounded-lg bg-slate-100 p-1" role="tablist" aria-label="Satark sections">
        {([['check', 'Check page'], ['paste', 'Paste text'], ['dashboard', 'Dashboard']] as const).map(([id, label]) => (
          <button key={id} role="tab" type="button" id={`tab-${id}`} aria-selected={tab === id} aria-controls={`panel-${id}`}
            className={`flex-1 rounded-md px-2 py-1.5 text-sm font-medium transition-colors ${tab === id ? 'bg-white text-slate-900 shadow-[0_1px_2px_rgba(43,41,37,0.08)]' : 'text-slate-600 hover:text-slate-900'}`}
            onClick={() => setTab(id)}
            onKeyDown={(e) => {
              const order: Tab[] = ['check', 'paste', 'dashboard'];
              const i = order.indexOf(tab);
              if (e.key === 'ArrowRight') { const n = order[(i + 1) % 3]!; setTab(n); document.getElementById(`tab-${n}`)?.focus(); }
              if (e.key === 'ArrowLeft') { const n = order[(i + 2) % 3]!; setTab(n); document.getElementById(`tab-${n}`)?.focus(); }
            }}
            tabIndex={tab === id ? 0 : -1}
          >{label}</button>
        ))}
      </nav>

      <main className="flex-1 p-4">
        <div role="tabpanel" id="panel-check" aria-labelledby="tab-check" hidden={tab !== 'check'}>
          <CheckTab check={pageCheck} remote={remote} requestToken={checkToken} onFix={onFix} />
        </div>
        <div role="tabpanel" id="panel-paste" aria-labelledby="tab-paste" hidden={tab !== 'paste'}>
          <PasteTab check={pasteCheck} incoming={incoming} onFix={onFix} />
        </div>
        <div role="tabpanel" id="panel-dashboard" aria-labelledby="tab-dashboard" hidden={tab !== 'dashboard'}>
          {tab === 'dashboard' && <DashboardTab />}
        </div>
      </main>
      <footer className="px-4 pb-3 text-xs text-slate-500">Satark {version}</footer>

      {consent && (
        <ConsentSheet req={consent.req} onAnswer={(ok, remember) => {
          if (ok && remember) void setConsentRemembered(true);
          consent.resolve(ok); setConsent(null);
        }} />
      )}
    </div>
  );
}
