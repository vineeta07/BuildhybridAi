import {
  DEFAULT_REMOTE, DEFAULT_SETTINGS, EMPTY_COUNTERS, addToCounters, pushReceipt,
  type Counters, type Receipt, type RemoteSettings, type UserSettings,
} from '@satark/core';

/** Typed chrome.storage wrappers. Page text is never written here. */
interface LocalShape {
  settings: UserSettings;
  debugToken: string;
  receipts: Receipt[];
  counters: Counters;
  onboarded: boolean;
  remoteCache: { at: number; values: RemoteSettings };
  guardian: boolean;
}

async function getLocal<K extends keyof LocalShape>(key: K): Promise<LocalShape[K] | undefined> {
  const r = await chrome.storage.local.get(key);
  return r[key] as LocalShape[K] | undefined;
}
const setLocal = <K extends keyof LocalShape>(key: K, value: LocalShape[K]) =>
  chrome.storage.local.set({ [key]: value });

export async function getSettings(): Promise<UserSettings> {
  return { ...DEFAULT_SETTINGS, ...(await getLocal('settings')) };
}
export async function saveSettings(patch: Partial<UserSettings>): Promise<UserSettings> {
  const next = { ...(await getSettings()), ...patch };
  await setLocal('settings', next);
  return next;
}

export const getDebugToken = async () => (await getLocal('debugToken')) ?? '';
export const setDebugToken = (t: string) => setLocal('debugToken', t.trim());

export const getReceipts = async () => (await getLocal('receipts')) ?? [];
export const getCounters = async () => ({ ...EMPTY_COUNTERS, ...(await getLocal('counters')) });

export async function recordReceipt(r: Receipt) {
  const [list, c] = await Promise.all([getReceipts(), getCounters()]);
  await chrome.storage.local.set({ receipts: pushReceipt(list, r), counters: addToCounters(c, r) });
}

export const clearReceipts = () => chrome.storage.local.set({ receipts: [], counters: EMPTY_COUNTERS });

export async function clearAllData() {
  const token = await getDebugToken(); // keep the developer token unless asked
  await chrome.storage.local.clear();
  await chrome.storage.session.clear();
  if (token) await setDebugToken(token);
}

export const isOnboarded = async () => (await getLocal('onboarded')) === true;
export const setOnboarded = () => setLocal('onboarded', true);

export const getRemoteCache = () => getLocal('remoteCache');
export const setRemoteCache = (values: RemoteSettings) => setLocal('remoteCache', { at: Date.now(), values });
export const cachedRemote = async (): Promise<RemoteSettings> =>
  ({ ...DEFAULT_REMOTE, ...(await getRemoteCache())?.values });

export const getGuardian = async () => (await getLocal('guardian')) === true;
export const setGuardian = (on: boolean) => setLocal('guardian', on);

/** Session-only: whether the user ticked "Remember for this session" on the consent sheet. */
export const getConsentRemembered = async () =>
  (await chrome.storage.session.get('consentRemembered')).consentRemembered === true;
export const setConsentRemembered = (on: boolean) => chrome.storage.session.set({ consentRemembered: on });

export function onLocalChange(keys: (keyof LocalShape)[], fn: () => void): () => void {
  const l = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === 'local' && keys.some((k) => k in changes)) fn();
  };
  chrome.storage.onChanged.addListener(l);
  return () => chrome.storage.onChanged.removeListener(l);
}
