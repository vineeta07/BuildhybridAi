import { onRequest } from 'firebase-functions/v2/https';
import { defineString } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getAppCheck } from 'firebase-admin/app-check';
import { getFirestore } from 'firebase-admin/firestore';
import { TOKEN_TTL_MS, claimsAcceptable, originAllowed, takeQuota, type Quota } from './policy.js';

initializeApp();

/** The Firebase Web App ID the tokens are minted for (Project settings > Your apps). */
const APP_ID = defineString('SATARK_WEB_APP_ID');
/** Comma list of allowed extension origins, e.g. "chrome-extension://<id>,moz-extension://*". */
const ALLOWED_ORIGINS = defineString('SATARK_ALLOWED_ORIGINS');

/**
 * Production App Check for the extension (reCAPTCHA cannot run in an extension).
 * The extension signs in anonymously, sends its Firebase ID token here, and gets back a
 * short-lived App Check token. Each user is rate limited. No page content ever reaches this
 * function: the request body is empty.
 *
 * Do NOT enforce App Check on Authentication, or the extension could never sign in to get here.
 */
export const appCheckExchange = onRequest(
  { region: 'us-central1', maxInstances: 10, concurrency: 40, memory: '256MiB', timeoutSeconds: 10 },
  async (req, res) => {
    const origin = req.get('origin');
    const allowed = originAllowed(origin, ALLOWED_ORIGINS.value());
    if (allowed && origin) {
      res.set('Access-Control-Allow-Origin', origin);
      res.set('Vary', 'Origin');
    }
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.set('Access-Control-Allow-Methods', 'POST');
    if (req.method === 'OPTIONS') { res.status(allowed ? 204 : 403).end(); return; }
    if (req.method !== 'POST') { res.status(405).json({ error: 'method' }); return; }
    if (!allowed) { res.status(403).json({ error: 'origin' }); return; }

    const m = /^Bearer (.+)$/.exec(req.get('authorization') ?? '');
    if (!m?.[1]) { res.status(401).json({ error: 'no_token' }); return; }

    let uid: string;
    try {
      const claims = await getAuth().verifyIdToken(m[1], true);
      if (!claimsAcceptable(claims, Math.floor(Date.now() / 1000))) { res.status(401).json({ error: 'claims' }); return; }
      uid = claims.uid;
    } catch {
      res.status(401).json({ error: 'bad_token' });
      return;
    }

    const ref = getFirestore().collection('appCheckQuota').doc(uid);
    const verdict = await getFirestore().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const v = takeQuota(snap.exists ? (snap.data() as Quota) : undefined, Date.now());
      if (v.allowed) tx.set(ref, v.next);
      return v;
    });
    if (!verdict.allowed) {
      res.set('Retry-After', String(verdict.retryAfterSec));
      res.status(429).json({ error: 'rate_limited', retryAfterSec: verdict.retryAfterSec });
      return;
    }

    try {
      const t = await getAppCheck().createToken(APP_ID.value(), { ttlMillis: TOKEN_TTL_MS });
      res.status(200).json({ token: t.token, ttlMillis: t.ttlMillis });
    } catch (e) {
      logger.error('createToken failed', { message: (e as Error).message });
      res.status(500).json({ error: 'mint_failed' });
    }
  },
);
