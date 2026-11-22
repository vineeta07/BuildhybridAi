import { resolveLanguage, type UserSettings } from '@satark/core';

/** The browser's UI language (e.g. "hi", "pt-BR"). */
export const browserLanguage = () => {
  try { return chrome.i18n.getUILanguage(); } catch { return navigator.language || 'en'; }
};

/** The explanation language to use now: the setting, with "auto" resolved to the browser's language. */
export const effectiveLanguage = (s: Pick<UserSettings, 'outputLanguage'>) => resolveLanguage(s.outputLanguage, browserLanguage());
