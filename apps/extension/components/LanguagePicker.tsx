import { useEffect, useState } from 'react';
import { AUTO_LANGUAGE, LANGUAGES, languageCode, languageInfo } from '@satark/core';
import { browserLanguage, effectiveLanguage } from '@/lib/lang';
import { translatorStatus, type TranslatorStatus } from '@/lib/translator';

/** Explanation language with native names, "same as my browser", and an on-device translation check. */
export function LanguagePicker(props: { value: string; onChange: (code: string) => void }) {
  const current = props.value === AUTO_LANGUAGE ? AUTO_LANGUAGE : languageCode(props.value);
  const effective = effectiveLanguage({ outputLanguage: current });
  const info = languageInfo(effective);
  const [status, setStatus] = useState<TranslatorStatus | 'n/a' | null>(null);

  useEffect(() => {
    if (effective === 'en') { setStatus('n/a'); return; }
    setStatus(null);
    void translatorStatus(effective).then(setStatus);
  }, [effective]);

  const browserInfo = languageInfo(browserLanguage());
  const note =
    status === 'n/a' ? 'Verdicts are written in English.'
    : status === null ? 'Checking on-device translation…'
    : status === 'available' ? `On-device verdicts are translated to ${info.name} on this computer. Cloud checks answer in ${info.name} directly.`
    : status === 'downloadable' || status === 'downloading' ? `Chrome can translate to ${info.name} on this computer after a one-time language download (you will be asked on your first verdict). Cloud checks answer in ${info.name} directly.`
    : `This browser cannot translate to ${info.name} on the device. Verdicts from the cloud answer in ${info.name}; on-device verdicts stay in English, with a button to ask the cloud instead.`;

  return (
    <section className="card space-y-2" aria-labelledby="lang-h">
      <h2 id="lang-h" className="font-display text-xl font-semibold">Explanation language</h2>
      <label className="block text-sm text-slate-600" htmlFor="lang">Headlines, explanations and advice use this language. Quotes always stay exactly as written on the page.</label>
      <select id="lang" className="w-full max-w-sm rounded-lg border border-slate-300 bg-white p-2" value={current} onChange={(e) => props.onChange(e.target.value)}>
        <option value={AUTO_LANGUAGE}>Same as my browser ({browserInfo.native})</option>
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code} lang={l.code}>{l.native === l.name ? l.name : `${l.native} — ${l.name}`}</option>
        ))}
      </select>
      <p className="text-sm text-slate-600" role="status">{note}</p>
    </section>
  );
}
