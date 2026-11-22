export type Lens = 'scam' | 'fineprint';
export type VerdictLevel = 'safe' | 'caution' | 'danger';
export type UserMode = 'private' | 'smart' | 'quality' | 'cloud';
export type Source = 'on-device' | 'cloud' | 'none';
export type OnDeviceStatus = 'available' | 'downloadable' | 'downloading' | 'unavailable';
export type SdkMode =
  | 'PREFER_ON_DEVICE' | 'ONLY_ON_DEVICE' | 'PREFER_IN_CLOUD' | 'ONLY_IN_CLOUD';

export const SCAM_CATEGORIES = [
  'urgency_threat', 'impersonation', 'credential_request', 'advance_fee',
  'too_good_to_be_true', 'risky_payment', 'secrecy_pressure', 'link_mismatch',
] as const;
export const FINEPRINT_CATEGORIES = [
  'auto_renewal', 'fees_penalties', 'data_sharing', 'arbitration_waiver',
  'unilateral_change', 'liability_limit', 'lock_in',
] as const;
export const CATEGORIES = [...SCAM_CATEGORIES, ...FINEPRINT_CATEGORIES, 'other'] as const;
export type Category = (typeof CATEGORIES)[number];
export const SEVERITIES = ['low', 'medium', 'high'] as const;
export type Severity = (typeof SEVERITIES)[number];
export const VERDICTS = ['safe', 'caution', 'danger'] as const;

export interface PageSignals {
  isHttps: boolean; hasPasswordField: boolean; hasOtpField: boolean; hasCardField: boolean;
  hasCountdownLike: boolean; hostIsIp: boolean; hostHasPunycode: boolean;
  subdomainDepth: number; externalFormAction: boolean; linkHostMismatches: number;
}

export interface PageSnapshot {
  origin: 'page' | 'selection' | 'paste';
  url: string; title: string;
  lang: string;              // from chrome.i18n.detectLanguage, e.g. 'en', 'hi'
  text: string;              // visible text, hard cap 40_000 characters
  signals: PageSignals;
}

export interface Reason {
  category: Category; severity: Severity;
  explanation: string; quote: string; verified?: boolean;
}
export interface Analysis {
  verdict: VerdictLevel; headline: string; summary: string;
  reasons: Reason[]; advice: string[];
}

export type ReasonCode =
  | 'USER_PRIVATE' | 'RC_CLOUD_OFF' | 'USER_CLOUD' | 'USER_QUALITY'
  | 'ON_DEVICE_OK_LOW_RISK' | 'ON_DEVICE_OK' | 'MODEL_NOT_READY'
  | 'LANG_UNSUPPORTED' | 'TOO_LONG' | 'NO_ON_DEVICE' | 'OFFLINE_NO_MODEL';

export interface RouterInput {
  userMode: UserMode; status: OnDeviceStatus; simulateNoOnDevice: boolean;
  lang: string; chars: number; hasPersonalData: boolean;
  online: boolean; cloudEnabled: boolean; onDeviceMaxChars: number;
}
export interface RouterDecision {
  sdkMode: SdkMode | 'NONE'; redact: boolean; needsConsent: boolean;
  reason: ReasonCode; useRadar: boolean;
}

export interface Attempt { sdkMode: SdkMode; ok: boolean; error?: string }

export interface Receipt {
  id: string; at: number; lens: Lens; requestedMode: UserMode;
  origin: PageSnapshot['origin']; site?: string;
  decision: RouterDecision; actualSource: Source; model: string; latencyMs: number;
  inputChars: number; charsSentToCloud: number; redactions: Record<string, number>;
  consent: boolean; partial: boolean; simulated: boolean;
  attempts: Attempt[];
  verifiedQuotes: number; droppedQuotes: number;
}

export type Tier0Level = 'red' | 'amber' | 'neutral';
export interface Tier0Finding { id: string; label: string; points: number }
export interface Tier0Result {
  score: number; level: Tier0Level; findings: Tier0Finding[]; suggestedLens: Lens;
}

export type LimitedCause =
  | 'route_none' | 'consent_declined' | 'all_attempts_failed' | 'private_unavailable';

/** What the side panel renders after a check. */
export interface CheckResult {
  kind: 'full' | 'limited';
  analysis?: Analysis;        // present when kind === 'full'
  tier0: Tier0Result;
  receipt: Receipt;
  partialNote?: string;       // "Checked the 14 most relevant of 212 paragraphs"
  evidenceUnverified?: boolean;
  limitedCause?: LimitedCause;
}

export interface RemoteSettings {
  cloudEnabled: boolean;
  cloudModel: string;
  onDeviceMaxChars: number;
  cloudMaxChars: number;
  tier0AiThreshold: number;
  scamPhrases: string[];
  minExtensionVersion: string;
}

export interface UserSettings {
  mode: UserMode;
  simulate: boolean;
  outputLanguage: string;
  keepSiteNames: boolean;
}

export type Msg =
  | { t: 'GET_SNAPSHOT'; tabId: number }                    // panel -> service worker
  | { t: 'EXTRACT' }                                         // service worker -> content
  | { t: 'SNAPSHOT'; snapshot: PageSnapshot }                // content -> service worker -> panel
  | { t: 'CHECK_REQUESTED'; lens?: Lens }                    // service worker -> panel
  | { t: 'SELECTION'; text: string; url: string }            // context menu -> panel
  | { t: 'HIGHLIGHT'; quotes: string[] }                     // panel -> service worker -> content
  | { t: 'CLEAR_HIGHLIGHT' };

export type SnapshotReply = PageSnapshot | { error: string };
