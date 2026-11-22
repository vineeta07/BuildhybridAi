import { initializeApp, type FirebaseApp } from 'firebase/app';
import { initializeAppCheck, CustomProvider, setTokenAutoRefreshEnabled, type AppCheck } from 'firebase/app-check';
import { getAI, GoogleAIBackend, type AI } from 'firebase/ai';
import { DEFAULT_REMOTE, type RemoteSettings } from '@satark/core';
import { cachedRemote, getDebugToken, getRemoteCache, setRemoteCache } from './storage';

const env = import.meta.env;
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: env.VITE_FIREBASE_APP_ID as string | undefined,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
};

/** False when the build has no Firebase web config: on-device still works, cloud is off. */
export const firebaseConfigured = Boolean(config.apiKey && config.projectId && config.appId);

let app: FirebaseApp | undefined;
let ai: AI | undefined;
let appCheck: AppCheck | undefined;
let cloudReady: Promise<void> | undefined;

/**
 * Core step: create the app and the AI instance only. Makes no network request, so Private
 * mode and on-device checks send nothing that carries page content.
 */
export async function initFirebase(): Promise<{ app: FirebaseApp; ai: AI }> {
  if (app && ai) return { app, ai };
  app = initializeApp(
    firebaseConfigured
      ? config
      // Placeholder so the hybrid SDK can still run ONLY_ON_DEVICE in an unconfigured build.
      : { apiKey: 'not-configured', projectId: 'not-configured', appId: '1:0:web:0' },
  );

  // reCAPTCHA cannot run inside an extension, so use a CustomProvider. With a debug token set,
  // the SDK exchanges the registered token and never calls getToken. The token is pasted into
  // Options and kept in chrome.storage.local, never committed.
  const debugToken = await getDebugToken();
  if (debugToken) {
    // 'true' makes the SDK log a NEW token to the console, to register in the Firebase console.
    (self as unknown as Record<string, unknown>).FIREBASE_APPCHECK_DEBUG_TOKEN =
      debugToken === 'true' ? true : debugToken;
  }
  appCheck = initializeAppCheck(app, {
    provider: new CustomProvider({
      getToken: async () => {
        throw new Error('No App Check debug token set. Add one in Options > Developer.');
      },
    }),
    // Off until ensureCloud(): no token traffic for on-device-only use.
    isTokenAutoRefreshEnabled: false,
  });

  ai = getAI(app, { backend: new GoogleAIBackend() });
  return { app, ai };
}

/** Cloud step: anonymous sign-in and App Check refresh. Called only before the first cloud route. */
export function ensureCloud(): Promise<void> {
  if (!firebaseConfigured) return Promise.reject(new Error('This build has no Firebase config, so cloud checks are off.'));
  cloudReady ??= (async () => {
    const { app: a } = await initFirebase();
    if (appCheck) setTokenAutoRefreshEnabled(appCheck, true);
    const { getAuth, signInAnonymously } = await import('firebase/auth/web-extension');
    await signInAnonymously(getAuth(a)).catch(() => undefined); // non-fatal: per-user quota only
  })().catch((e) => { cloudReady = undefined; throw e; });
  return cloudReady;
}

const RC_TTL_MS = 12 * 60 * 60 * 1000;

/** Remote Config (data only, never code). Falls back to cached, then baked-in, defaults. */
export async function loadRemote(): Promise<RemoteSettings> {
  const cached = await getRemoteCache();
  if (cached && Date.now() - cached.at < RC_TTL_MS) return { ...DEFAULT_REMOTE, ...cached.values };
  if (!firebaseConfigured) return cachedRemote();
  try {
    const { app: a } = await initFirebase();
    const rc = await import('firebase/remote-config');
    const remote = rc.getRemoteConfig(a);
    remote.settings.minimumFetchIntervalMillis = RC_TTL_MS;
    remote.defaultConfig = {
      cloud_enabled: DEFAULT_REMOTE.cloudEnabled,
      cloud_model: DEFAULT_REMOTE.cloudModel,
      on_device_max_chars: DEFAULT_REMOTE.onDeviceMaxChars,
      cloud_max_chars: DEFAULT_REMOTE.cloudMaxChars,
      tier0_ai_threshold: DEFAULT_REMOTE.tier0AiThreshold,
      scam_phrases_json: JSON.stringify(DEFAULT_REMOTE.scamPhrases),
      min_extension_version: DEFAULT_REMOTE.minExtensionVersion,
    };
    await rc.fetchAndActivate(remote);
    let phrases = DEFAULT_REMOTE.scamPhrases;
    try {
      const p: unknown = JSON.parse(rc.getString(remote, 'scam_phrases_json'));
      if (Array.isArray(p) && p.every((x) => typeof x === 'string')) phrases = p.slice(0, 200);
    } catch { /* keep defaults */ }
    const num = (k: string, d: number) => { const n = rc.getNumber(remote, k); return Number.isFinite(n) && n > 0 ? n : d; };
    const values: RemoteSettings = {
      cloudEnabled: rc.getBoolean(remote, 'cloud_enabled'),
      cloudModel: rc.getString(remote, 'cloud_model').trim(),
      onDeviceMaxChars: num('on_device_max_chars', DEFAULT_REMOTE.onDeviceMaxChars),
      cloudMaxChars: num('cloud_max_chars', DEFAULT_REMOTE.cloudMaxChars),
      tier0AiThreshold: num('tier0_ai_threshold', DEFAULT_REMOTE.tier0AiThreshold),
      scamPhrases: phrases,
      minExtensionVersion: rc.getString(remote, 'min_extension_version') || DEFAULT_REMOTE.minExtensionVersion,
    };
    await setRemoteCache(values);
    return values;
  } catch {
    return cachedRemote();
  }
}
