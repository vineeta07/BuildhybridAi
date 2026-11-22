import type { Analysis, CheckResult } from './types';

export interface Language { code: string; name: string; native: string; rtl?: boolean }

/**
 * Explanation languages. `code` is BCP 47 (what the Translator API takes), `name` is the English
 * name used in the cloud prompt, `native` is what people see in the picker.
 * Whether Chrome can translate a pair on-device is checked at runtime with
 * Translator.availability(); when it cannot, the cloud route can answer in the language instead.
 */
export const LANGUAGES: Language[] = [
  { code: 'en', name: 'English', native: 'English' },
  // India
  { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు' },
  { code: 'mr', name: 'Marathi', native: 'मराठी' },
  { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'ml', name: 'Malayalam', native: 'മലയാളം' },
  { code: 'pa', name: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
  { code: 'or', name: 'Odia', native: 'ଓଡ଼ିଆ' },
  { code: 'as', name: 'Assamese', native: 'অসমীয়া' },
  { code: 'ur', name: 'Urdu', native: 'اردو', rtl: true },
  { code: 'ne', name: 'Nepali', native: 'नेपाली' },
  { code: 'si', name: 'Sinhala', native: 'සිංහල' },
  // Rest of Asia and the Middle East
  { code: 'zh', name: 'Chinese (Simplified)', native: '简体中文' },
  { code: 'zh-Hant', name: 'Chinese (Traditional)', native: '繁體中文' },
  { code: 'ja', name: 'Japanese', native: '日本語' },
  { code: 'ko', name: 'Korean', native: '한국어' },
  { code: 'th', name: 'Thai', native: 'ไทย' },
  { code: 'vi', name: 'Vietnamese', native: 'Tiếng Việt' },
  { code: 'id', name: 'Indonesian', native: 'Bahasa Indonesia' },
  { code: 'ms', name: 'Malay', native: 'Bahasa Melayu' },
  { code: 'fil', name: 'Filipino', native: 'Filipino' },
  { code: 'ar', name: 'Arabic', native: 'العربية', rtl: true },
  { code: 'fa', name: 'Persian', native: 'فارسی', rtl: true },
  { code: 'he', name: 'Hebrew', native: 'עברית', rtl: true },
  { code: 'tr', name: 'Turkish', native: 'Türkçe' },
  // Europe and the Americas
  { code: 'es', name: 'Spanish', native: 'Español' },
  { code: 'pt', name: 'Portuguese', native: 'Português' },
  { code: 'fr', name: 'French', native: 'Français' },
  { code: 'de', name: 'German', native: 'Deutsch' },
  { code: 'it', name: 'Italian', native: 'Italiano' },
  { code: 'nl', name: 'Dutch', native: 'Nederlands' },
  { code: 'pl', name: 'Polish', native: 'Polski' },
  { code: 'ru', name: 'Russian', native: 'Русский' },
  { code: 'uk', name: 'Ukrainian', native: 'Українська' },
  { code: 'cs', name: 'Czech', native: 'Čeština' },
  { code: 'sk', name: 'Slovak', native: 'Slovenčina' },
  { code: 'sl', name: 'Slovenian', native: 'Slovenščina' },
  { code: 'hr', name: 'Croatian', native: 'Hrvatski' },
  { code: 'sr', name: 'Serbian', native: 'Српски' },
  { code: 'bg', name: 'Bulgarian', native: 'Български' },
  { code: 'ro', name: 'Romanian', native: 'Română' },
  { code: 'hu', name: 'Hungarian', native: 'Magyar' },
  { code: 'el', name: 'Greek', native: 'Ελληνικά' },
  { code: 'sv', name: 'Swedish', native: 'Svenska' },
  { code: 'da', name: 'Danish', native: 'Dansk' },
  { code: 'no', name: 'Norwegian', native: 'Norsk' },
  { code: 'fi', name: 'Finnish', native: 'Suomi' },
  { code: 'lt', name: 'Lithuanian', native: 'Lietuvių' },
  { code: 'lv', name: 'Latvian', native: 'Latviešu' },
  { code: 'et', name: 'Estonian', native: 'Eesti' },
  // Africa
  { code: 'sw', name: 'Swahili', native: 'Kiswahili' },
  { code: 'am', name: 'Amharic', native: 'አማርኛ' },
  { code: 'yo', name: 'Yoruba', native: 'Yorùbá' },
  { code: 'zu', name: 'Zulu', native: 'isiZulu' },
  { code: 'af', name: 'Afrikaans', native: 'Afrikaans' },
];

/** The setting value meaning "use the browser's own language". */
export const AUTO_LANGUAGE = 'auto';

const BY_CODE = new Map(LANGUAGES.map((l) => [l.code.toLowerCase(), l]));
const BY_NAME = new Map(LANGUAGES.map((l) => [l.name.toLowerCase(), l]));
const ALIASES: Record<string, string> = {
  iw: 'he', tl: 'fil', nb: 'no', nn: 'no', in: 'id', 'zh-cn': 'zh', 'zh-sg': 'zh', 'zh-hans': 'zh',
  'zh-tw': 'zh-Hant', 'zh-hk': 'zh-Hant', 'zh-mo': 'zh-Hant', 'chinese': 'zh',
};

/**
 * Accepts a code ("hi", "pt-BR", "zh-TW"), an English name ("Hindi", older settings) or an
 * alias, and returns a supported code. Unknown values fall back to English.
 */
export function languageCode(value: string): string {
  const v = value.trim().toLowerCase();
  if (!v) return 'en';
  const alias = ALIASES[v];
  if (alias) return alias;
  const exact = BY_CODE.get(v) ?? BY_NAME.get(v);
  if (exact) return exact.code;
  const base = v.split(/[-_]/)[0]!;
  const aliasBase = ALIASES[base];
  if (aliasBase) return aliasBase;
  return BY_CODE.get(base)?.code ?? 'en';
}

export const languageInfo = (value: string): Language => BY_CODE.get(languageCode(value).toLowerCase())!;
export const languageName = (value: string) => languageInfo(value).name;
export const isRtl = (value: string) => languageInfo(value).rtl === true;

/** Resolves the setting ("auto" or a language) against the browser UI language. */
export function resolveLanguage(setting: string, browserLanguage: string): string {
  return setting === AUTO_LANGUAGE ? languageCode(browserLanguage) : languageCode(setting);
}

/**
 * On-device verdicts are written in English; cloud verdicts already come back in the chosen
 * language (the prompt asks for it). So only non-cloud full results need a local translation.
 */
export function needsLocalTranslation(r: CheckResult, outputLanguage: string): boolean {
  return r.kind === 'full' && !!r.analysis && languageCode(outputLanguage) !== 'en' && r.receipt.actualSource !== 'cloud';
}

/** The strings to translate, in a fixed order. Quotes are excluded: evidence stays verbatim. */
export function translatableStrings(a: Analysis): string[] {
  return [a.headline, a.summary, ...a.reasons.map((r) => r.explanation), ...a.advice];
}

/** Puts translated strings back in the same order. Falls back to the original for any gap. */
export function applyTranslations(a: Analysis, t: string[]): Analysis {
  let i = 0;
  const next = (orig: string) => { const v = t[i++]; return typeof v === 'string' && v.trim() ? v : orig; };
  const headline = next(a.headline);
  const summary = next(a.summary);
  const reasons = a.reasons.map((r) => ({ ...r, explanation: next(r.explanation) }));
  const advice = a.advice.map((x) => next(x));
  return { ...a, headline, summary, reasons, advice };
}
