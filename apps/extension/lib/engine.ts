import {
  analyze, bindRunModel,
  type CheckResult, type ConsentRequest, type Lens, type OnDeviceStatus, type PageSnapshot,
  type RemoteSettings, type UserSettings,
} from '@satark/core';
import { ensureCloud, firebaseConfigured, initFirebase } from './firebase';
import { recordReceipt } from './storage';

interface LanguageModelLike {
  availability(o?: unknown): Promise<OnDeviceStatus>;
  create(o?: unknown): Promise<{ destroy(): void }>;
}
const LM = () => (globalThis as { LanguageModel?: LanguageModelLike }).LanguageModel;

const LANG_OPTS = {
  expectedInputs: [{ type: 'text', languages: ['en'] }],
  expectedOutputs: [{ type: 'text', languages: ['en'] }],
};

let statusCache: { at: number; value: OnDeviceStatus } | undefined;

/** Capability probe, cached for 30 s. The global may not exist at all. */
export async function onDeviceStatus(force = false): Promise<OnDeviceStatus> {
  if (!force && statusCache && Date.now() - statusCache.at < 30_000) return statusCache.value;
  let value: OnDeviceStatus = 'unavailable';
  const lm = LM();
  if (lm) {
    try { value = await lm.availability(LANG_OPTS); } catch { value = 'unavailable'; }
  }
  statusCache = { at: Date.now(), value };
  return value;
}

/** Call ONLY from a click handler: Chrome requires user activation to start the download. */
export async function downloadModel(onProgress: (fraction: number) => void): Promise<void> {
  const lm = LM();
  if (!lm) throw new Error('This browser does not offer on-device AI.');
  const session = await lm.create({
    ...LANG_OPTS,
    monitor(m: EventTarget) {
      m.addEventListener('downloadprogress', (e) => onProgress((e as ProgressEvent).loaded));
    },
  });
  session.destroy();
  statusCache = undefined;
}

/** chrome.i18n.detectLanguage runs locally; fall back to the page's lang attribute. */
export async function detectLang(text: string, hint: string): Promise<string> {
  try {
    const r = await chrome.i18n.detectLanguage(text.slice(0, 5000));
    const best = r.languages?.sort((a, b) => b.percentage - a.percentage)[0];
    if (r.isReliable && best?.language) return best.language;
    if (best?.language && (!hint || hint === 'und')) return best.language;
  } catch { /* ignore */ }
  return hint && hint !== 'und' ? hint : 'en';
}

export interface RunArgs {
  snap: PageSnapshot; lens: Lens; settings: UserSettings; remote: RemoteSettings;
  askConsent: (req: ConsentRequest) => Promise<boolean>; signal?: AbortSignal;
}

/** Wires the pure core engine to Chrome and Firebase, then stores the metadata-only receipt. */
export async function runCheck(a: RunArgs): Promise<CheckResult> {
  const { ai } = await initFirebase();
  const status = await onDeviceStatus();
  const result = await analyze({
    snap: a.snap, lens: a.lens, settings: a.settings,
    remote: { ...a.remote, cloudEnabled: a.remote.cloudEnabled && firebaseConfigured },
    status, online: navigator.onLine,
    runModel: bindRunModel(ai), askConsent: a.askConsent, ensureCloud,
    ...(a.signal ? { signal: a.signal } : {}),
  });
  await recordReceipt(result.receipt);
  return result;
}
