import { initializeApp, type FirebaseApp } from 'firebase/app';
import { initializeAppCheck, CustomProvider, setTokenAutoRefreshEnabled, type AppCheck } from 'firebase/app-check';
import { getAI, GoogleAIBackend, type AI } from 'firebase/ai';
import { DEFAULT_REMOTE, type RemoteSettings } from '@satark/core';
import { getDebugToken } from './storage';

import { EXCHANGE_URL, config, firebaseConfigured } from './config';

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

  // reCAPTCHA cannot run inside an extension, so use a CustomProvider backed by our Cloud
  // Function. With a debug token set (development), the SDK uses it instead and never calls
  // getToken. The debug token is pasted into Options and kept in chrome.storage.local.
  const debugToken = await getDebugToken();
  if (debugToken) {
    // 'true' makes the SDK log a NEW token to the console, to register in the Firebase console.
    (self as unknown as Record<string, unknown>).FIREBASE_APPCHECK_DEBUG_TOKEN =
      debugToken === 'true' ? true : debugToken;
  }
  appCheck = initializeAppCheck(app, {
    provider: new CustomProvider({
      getToken: () => exchangeAppCheckToken(),
    }),
    // Off until ensureCloud(): no token traffic for on-device-only use.
    isTokenAutoRefreshEnabled: false,
  });

  ai = getAI(app, { backend: new GoogleAIBackend() });
  return { app, ai };
}

/**
 * Production attestation: sign in anonymously, send the Firebase ID token to the exchange
 * function, and get a short-lived App Check token back. The request carries no page content.
 */
async function exchangeAppCheckToken(): Promise<{ token: string; expireTimeMillis: number }> {
  if (!EXCHANGE_URL) throw new Error('No App Check setup in this build. Add a debug token in Options > Developer.');
  const { app: a } = await initFirebase();
  const { getAuth, signInAnonymously } = await import('firebase/auth/web-extension');
  const auth = getAuth(a);
  const user = auth.currentUser ?? (await signInAnonymously(auth)).user;
  const res = await fetch(EXCHANGE_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await user.getIdToken()}` },
  });
  if (res.status === 429) throw new Error('Too many cloud checks for now. Try again later.');
  if (!res.ok) throw new Error(`App Check exchange failed (${res.status}).`);
  const body = (await res.json()) as { token?: string; ttlMillis?: number };
  if (!body.token || !body.ttlMillis) throw new Error('App Check exchange returned no token.');
  return { token: body.token, expireTimeMillis: Date.now() + body.ttlMillis };
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


/** Fetches Remote Config values (data only, never code). Throws on failure; see cloud.ts. */
export async function fetchRemoteValues(ttlMs: number): Promise<RemoteSettings> {
  const { app: a } = await initFirebase();
  const rc = await import('firebase/remote-config');
  const remote = rc.getRemoteConfig(a);
  remote.settings.minimumFetchIntervalMillis = ttlMs;
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
  return {
    cloudEnabled: rc.getBoolean(remote, 'cloud_enabled'),
    cloudModel: rc.getString(remote, 'cloud_model').trim(),
    onDeviceMaxChars: num('on_device_max_chars', DEFAULT_REMOTE.onDeviceMaxChars),
    cloudMaxChars: num('cloud_max_chars', DEFAULT_REMOTE.cloudMaxChars),
    tier0AiThreshold: num('tier0_ai_threshold', DEFAULT_REMOTE.tier0AiThreshold),
    scamPhrases: phrases,
    minExtensionVersion: rc.getString(remote, 'min_extension_version') || DEFAULT_REMOTE.minExtensionVersion,
  };
}
