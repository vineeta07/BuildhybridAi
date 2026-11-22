/**
 * Build-time Firebase settings. No Firebase imports here, so UI code can read these flags
 * without loading the SDK.
 */
const env = import.meta.env;
export const config = {
  apiKey: env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: env.VITE_FIREBASE_APP_ID as string | undefined,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
};

/** HTTPS URL of the appCheckExchange Cloud Function (functions/src/index.ts). Public, not a secret. */
export const EXCHANGE_URL = (env.VITE_APPCHECK_EXCHANGE_URL as string | undefined)?.trim() ?? '';
export const productionAppCheck = Boolean(EXCHANGE_URL);

/** False when the build has no Firebase web config: on-device still works, cloud is off. */
export const firebaseConfigured = Boolean(config.apiKey && config.projectId && config.appId);

