import { DEFAULT_REMOTE, type RemoteSettings, type RunModel } from '@satark/core';
import { firebaseConfigured } from './config';
import { cachedRemote, getRemoteCache, setRemoteCache } from './storage';

/**
 * Lazy door to Firebase. The SDK (about 180 kB) is loaded only when a check, a Remote Config
 * refresh or sync actually needs it, so the side panel and Options open fast.
 */
const sdk = () => import('./firebase');

export const initFirebase = async () => (await sdk()).initFirebase();
export const ensureCloud = async () => (await sdk()).ensureCloud();

/** The model call, bound to this extension's Firebase app. */
export async function getRunModel(): Promise<RunModel> {
  const [{ ai }, adapter] = await Promise.all([initFirebase(), import('@satark/core/ai')]);
  return adapter.bindRunModel(ai);
}

const RC_TTL_MS = 12 * 60 * 60 * 1000;

/** Remote Config with a 12-hour cache. Falls back to the cached, then the baked-in, values. */
export async function loadRemote(): Promise<RemoteSettings> {
  const cached = await getRemoteCache();
  if (cached && Date.now() - cached.at < RC_TTL_MS) return { ...DEFAULT_REMOTE, ...cached.values };
  if (!firebaseConfigured || !navigator.onLine) return cachedRemote();
  try {
    const values = await (await sdk()).fetchRemoteValues(RC_TTL_MS);
    await setRemoteCache(values);
    return values;
  } catch {
    return cachedRemote();
  }
}
