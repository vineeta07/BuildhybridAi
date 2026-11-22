import type { RemoteSettings, UserSettings } from './types';

export const DEFAULT_SCAM_PHRASES = [
  'digital arrest', 'kyc', 'verify within 24 hours', 'customs duty', 'do not tell anyone',
  'anydesk', 'teamviewer', 'account will be blocked', 'account will be suspended',
  'share the otp', 'lottery', 'you have won', 'work from home', 'registration fee',
  'refund pending', 'electricity will be disconnected', 'guaranteed returns',
];

export const DEFAULT_REMOTE: RemoteSettings = {
  cloudEnabled: true,
  cloudModel: '',
  onDeviceMaxChars: 9000,
  cloudMaxChars: 60000,
  tier0AiThreshold: 40,
  scamPhrases: DEFAULT_SCAM_PHRASES,
  minExtensionVersion: '0.1.0',
};

export const DEFAULT_SETTINGS: UserSettings = {
  mode: 'smart',
  simulate: false,
  outputLanguage: 'English',
  keepSiteNames: false,
  sync: false,
};

export const DEFAULT_CLOUD_MODEL = 'gemini-2.5-flash-lite';
export const ON_DEVICE_MODEL_NAME = 'Gemini Nano (Chrome)';
export const MAX_TEXT_CHARS = 40_000;
