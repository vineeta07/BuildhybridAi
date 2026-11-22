import type { RouterInput, RouterDecision, SdkMode, ReasonCode } from './types';

export const ON_DEVICE_LANGS = new Set(['en', 'es', 'ja', 'de', 'fr']); // Chrome docs list
export const RADAR_MAX_RATIO = 6; // beyond 6x the budget, send to the cloud instead

export const langSupportedOnDevice = (lang: string) =>
  ON_DEVICE_LANGS.has((lang.split('-')[0] ?? '').toLowerCase());

/** The decision table from SPEC.md, first match wins. Pure: no I/O. */
export function route(i: RouterInput): RouterDecision {
  const ready = i.status === 'available' && !i.simulateNoOnDevice;
  const langOk = langSupportedOnDevice(i.lang);
  const tooLong = i.chars > i.onDeviceMaxChars * RADAR_MAX_RATIO;
  const useRadar = i.chars > i.onDeviceMaxChars;

  const local = (sdkMode: SdkMode, reason: ReasonCode): RouterDecision =>
    ({ sdkMode, reason, redact: false, needsConsent: false, useRadar });
  const cloud = (sdkMode: SdkMode, reason: ReasonCode): RouterDecision =>
    ({ sdkMode, reason, redact: true, needsConsent: true, useRadar: false });
  const none = (reason: ReasonCode): RouterDecision =>
    ({ sdkMode: 'NONE', reason, redact: false, needsConsent: false, useRadar: false });

  const canLocal = ready && langOk && !tooLong;

  if (i.userMode === 'private') return local('ONLY_ON_DEVICE', 'USER_PRIVATE');            // 1
  if (!i.cloudEnabled) return canLocal ? local('ONLY_ON_DEVICE', 'RC_CLOUD_OFF') : none('RC_CLOUD_OFF'); // 2
  if (i.userMode === 'cloud') return i.online ? cloud('ONLY_IN_CLOUD', 'USER_CLOUD') : none('OFFLINE_NO_MODEL'); // 3
  if (i.userMode === 'quality') return cloud('PREFER_IN_CLOUD', 'USER_QUALITY');          // 4
  if (canLocal) {                                                                         // 5, 6
    return i.hasPersonalData
      ? local('ONLY_ON_DEVICE', 'ON_DEVICE_OK')
      : local('PREFER_ON_DEVICE', 'ON_DEVICE_OK_LOW_RISK');
  }
  if (!i.online) return none('OFFLINE_NO_MODEL');                                         // 11
  if (!langOk) return cloud('ONLY_IN_CLOUD', 'LANG_UNSUPPORTED');                         // 8
  if (tooLong) return cloud('ONLY_IN_CLOUD', 'TOO_LONG');                                 // 9
  if (i.status === 'downloadable' || i.status === 'downloading') {                        // 7
    return cloud('ONLY_IN_CLOUD', 'MODEL_NOT_READY');
  }
  return cloud('ONLY_IN_CLOUD', 'NO_ON_DEVICE');                                         // 10
}

export interface LadderContext {
  cloudEnabled: boolean; online: boolean; onDeviceReady: boolean;
  userMode: RouterInput['userMode']; tried: SdkMode[]; schemaRetried: boolean;
}

export type LadderError = 'size' | 'parse' | 'other';

/** Classifies a thrown error for the failure ladder. */
export function classifyError(e: unknown): LadderError {
  const s = String((e as { message?: string })?.message ?? e).toLowerCase();
  if (e instanceof Error && e.name === 'ParseError') return 'parse';
  if (/quota|too large|too long|token|exceed|input.*size|context/.test(s)) return 'size';
  return 'other';
}

const isCloud = (m: SdkMode) => m === 'ONLY_IN_CLOUD' || m === 'PREFER_IN_CLOUD';

/**
 * The failure ladder: given the decision that just failed and why, return the next rung.
 * 'NONE' means fall back to Tier-0. The caller handles the 60% shrink and schema retry flags.
 */
export function nextRung(
  failed: RouterDecision, err: LadderError, ctx: LadderContext,
): RouterDecision & { shrink?: boolean; schemaRetry?: boolean } {
  const none: RouterDecision = { sdkMode: 'NONE', reason: failed.reason, redact: false, needsConsent: false, useRadar: false };
  if (failed.sdkMode === 'NONE') return none;
  const cloudAllowed = ctx.cloudEnabled && ctx.online && ctx.userMode !== 'private';
  const toCloud = (): RouterDecision => ({ sdkMode: 'ONLY_IN_CLOUD', reason: failed.reason, redact: true, needsConsent: true, useRadar: false });
  const toLocal = (): RouterDecision => ({ sdkMode: 'ONLY_ON_DEVICE', reason: failed.reason, redact: false, needsConsent: false, useRadar: true });

  if (err === 'parse' && !ctx.schemaRetried) return { ...failed, schemaRetry: true };

  if (!isCloud(failed.sdkMode)) {
    // ctx.tried already includes the attempt that just failed.
    const triesOfThisMode = ctx.tried.filter((m) => m === failed.sdkMode).length;
    if (err === 'size' && triesOfThisMode < 2) return { ...failed, shrink: true }; // retry once at 60%
    if (cloudAllowed && !ctx.tried.some(isCloud)) return toCloud();
    return none;
  }
  // cloud failed
  if (ctx.onDeviceReady && !ctx.tried.some((m) => !isCloud(m))) return toLocal();
  return none;
}
