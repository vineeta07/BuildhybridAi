import { buildPrompt } from './prompts';
import { parseAnalysis } from './parse';
import { partialNote as radarNote, radar } from './radar';
import { hasPersonalData, redact } from './redact';
import { classifyError, nextRung, route } from './router';
import { newId } from './receipts';
import { tier0 } from './tier0';
import { verifyReasons } from './verify';
import { hostOf } from './domain';
import { ON_DEVICE_MODEL_NAME } from './defaults';
import type { RunModel, RunResult } from './ai-adapter';
import type {
  Analysis, Attempt, CheckResult, Lens, LimitedCause, OnDeviceStatus, PageSnapshot, Receipt,
  RemoteSettings, RouterDecision, SdkMode, Tier0Result, UserSettings,
} from './types';

export interface ConsentRequest {
  decision: RouterDecision;
  redactedText: string;
  counts: Record<string, number>;
  chars: number;
}

export interface AnalyzeArgs {
  snap: PageSnapshot;
  lens: Lens;
  settings: UserSettings;
  remote: RemoteSettings;
  status: OnDeviceStatus;
  online: boolean;
  runModel: RunModel;
  /** Shows the consent sheet. Resolves true for "Send redacted text". */
  askConsent: (req: ConsentRequest) => Promise<boolean>;
  /** Called right before the first cloud-capable call (lazy App Check + anonymous auth). */
  ensureCloud?: () => Promise<void>;
  signal?: AbortSignal;
  now?: () => number;
}

const isCloudMode = (m: SdkMode) => m === 'ONLY_IN_CLOUD' || m === 'PREFER_IN_CLOUD';
const MAX_ROUNDS = 5;

/**
 * The single path to any model. Order: tier0 -> router -> (radar) -> redact -> consent ->
 * model call -> parse -> verify -> receipt. Page text is never put in the receipt.
 */
export async function analyze(a: AnalyzeArgs): Promise<CheckResult> {
  const now = a.now ?? Date.now;
  const t0 = tier0({ url: a.snap.url, title: a.snap.title, text: a.snap.text, signals: a.snap.signals, phrases: a.remote.scamPhrases });
  const personal = hasPersonalData(a.snap.text);
  const first = route({
    userMode: a.settings.mode, status: a.status, simulateNoOnDevice: a.settings.simulate,
    lang: a.snap.lang, chars: a.snap.text.length, hasPersonalData: personal,
    online: a.online, cloudEnabled: a.remote.cloudEnabled, onDeviceMaxChars: a.remote.onDeviceMaxChars,
  });
  const ready = a.status === 'available' && !a.settings.simulate;
  const base = { a, t0, now };

  if (first.sdkMode === 'NONE') return limited(base, first, [], 'route_none');
  // Private mode (or cloud kill switch) with no usable model: never touch the network.
  if (!isCloudMode(first.sdkMode) && first.sdkMode === 'ONLY_ON_DEVICE' && !ready) {
    return limited(base, first, [], 'private_unavailable');
  }

  const attempts: Attempt[] = [];
  const tried: SdkMode[] = [];
  let current: RouterDecision = first;
  let shrink = 1;
  let strictJson = false;
  let schemaRetried = false;
  let consentGiven = false;
  let cloudReady = false;

  for (let round = 0; round < MAX_ROUNDS && current.sdkMode !== 'NONE'; round++) {
    if (a.signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    const mode = current.sdkMode;

    // 1. Choose the text to send.
    let sent: string;
    let partial: ReturnType<typeof radar> | undefined;
    if (isCloudMode(mode)) {
      sent = a.snap.text.slice(0, Math.floor(a.remote.cloudMaxChars * shrink));
    } else {
      const budget = Math.floor(a.remote.onDeviceMaxChars * shrink);
      const r = radar(a.snap.text, a.lens, budget);
      sent = r.text;
      if (r.partial) partial = r;
    }

    // 2. Redact and ask for consent before anything can leave the device.
    let redactions: Record<string, number> = {};
    if (current.redact) {
      const r = redact(sent);
      sent = r.text;
      redactions = r.counts as Record<string, number>;
      if (current.needsConsent && !consentGiven) {
        const ok = await a.askConsent({ decision: current, redactedText: sent, counts: redactions, chars: sent.length });
        if (!ok) return limited(base, current, attempts, 'consent_declined');
        consentGiven = true;
      }
    }

    try {
      if (mode !== 'ONLY_ON_DEVICE' && !cloudReady && a.ensureCloud) {
        await a.ensureCloud();
        cloudReady = true;
      }
      const prompt = buildPrompt(a.lens, a.snap, sent, {
        cloud: isCloudMode(mode), outputLanguage: a.settings.outputLanguage, strictJson,
      });
      tried.push(mode);
      const run = await a.runModel(mode, prompt, a.remote.cloudModel || undefined);
      const parsed = parseAnalysis(run.json); // throws ParseError
      attempts.push({ sdkMode: mode, ok: true });
      return full(base, { decision: current, run, parsed, sent, redactions, consent: consentGiven, attempts, partial });
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') throw e;
      attempts.push({ sdkMode: mode, ok: false, error: shortError(e) });
      const next = nextRung(current, classifyError(e), {
        cloudEnabled: a.remote.cloudEnabled, online: a.online, onDeviceReady: ready,
        userMode: a.settings.mode, tried, schemaRetried,
      });
      if (next.schemaRetry) { schemaRetried = true; strictJson = true; }
      if (next.shrink) shrink *= 0.6;
      const { shrink: _s, schemaRetry: _r, ...decision } = next;
      current = decision;
    }
  }
  return limited(base, first, attempts, 'all_attempts_failed');
}

const shortError = (e: unknown) => String((e as Error)?.message ?? e).slice(0, 200);

interface Base { a: AnalyzeArgs; t0: Tier0Result; now: () => number }

function receiptBase(b: Base, decision: RouterDecision): Omit<Receipt, 'actualSource' | 'model' | 'latencyMs' | 'charsSentToCloud' | 'redactions' | 'consent' | 'partial' | 'attempts' | 'verifiedQuotes' | 'droppedQuotes'> {
  return {
    id: newId(), at: b.now(), lens: b.a.lens, requestedMode: b.a.settings.mode,
    origin: b.a.snap.origin,
    ...(b.a.settings.keepSiteNames && b.a.snap.url ? { site: hostOf(b.a.snap.url) } : {}),
    decision, inputChars: b.a.snap.text.length,
    // Only when the demo switch actually changed the route (the model was really available).
    simulated: b.a.settings.simulate && b.a.status === 'available' && decision.reason === 'NO_ON_DEVICE',
  };
}

function limited(b: Base, decision: RouterDecision, attempts: Attempt[], cause: LimitedCause): CheckResult {
  const receipt: Receipt = {
    ...receiptBase(b, decision),
    actualSource: 'none', model: '', latencyMs: 0, charsSentToCloud: 0, redactions: {},
    consent: false, partial: false, attempts, verifiedQuotes: 0, droppedQuotes: 0,
  };
  return { kind: 'limited', tier0: b.t0, receipt, limitedCause: cause };
}

interface FullArgs {
  decision: RouterDecision; run: RunResult; parsed: Analysis; sent: string;
  redactions: Record<string, number>; consent: boolean; attempts: Attempt[];
  partial?: ReturnType<typeof radar>;
}

function full(b: Base, f: FullArgs): CheckResult {
  const { kept, dropped } = verifyReasons(f.parsed.reasons, f.sent);
  let analysis: Analysis = { ...f.parsed, reasons: kept };
  let evidenceUnverified = false;
  if (analysis.verdict === 'danger' && kept.length === 0) {
    analysis = { ...analysis, verdict: 'caution' };
    evidenceUnverified = true;
  }
  const source = f.run.source === 'none' ? (isCloudMode(f.decision.sdkMode as SdkMode) ? 'cloud' : 'on-device') : f.run.source;
  const receipt: Receipt = {
    ...receiptBase(b, f.decision),
    actualSource: source,
    model: source === 'on-device' ? ON_DEVICE_MODEL_NAME : f.run.model,
    latencyMs: f.run.latencyMs,
    charsSentToCloud: source === 'cloud' ? f.sent.length : 0,
    redactions: source === 'cloud' ? f.redactions : {},
    consent: f.consent, partial: !!f.partial, attempts: f.attempts,
    verifiedQuotes: kept.length, droppedQuotes: dropped,
  };
  return {
    kind: 'full', analysis, tier0: b.t0, receipt,
    ...(f.partial ? { partialNote: radarNote(f.partial) } : {}),
    ...(evidenceUnverified ? { evidenceUnverified } : {}),
  };
}
