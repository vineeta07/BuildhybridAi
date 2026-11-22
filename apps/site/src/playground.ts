import {
  DEFAULT_SCAM_PHRASES, EMPTY_SIGNALS, SAMPLE_SCAM_SMS, TIER0_LABEL, describeRedactions, redact, suggestLens, tier0,
} from '@satark/core/pure';

/**
 * Hosted playground: the same core code as the extension, running entirely in this tab.
 * It shows the instant quick check and exactly what Satark would send on the cloud route.
 * No network requests and no AI here; the AI check runs in the extension.
 * Everything is rendered with textContent, never innerHTML.
 */
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const input = $<HTMLTextAreaElement>('pg-text');
const out = $<HTMLElement>('pg-out');

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, cls?: string) {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  if (cls) e.className = cls;
  return e;
}

function run() {
  const text = input.value.trim().slice(0, 40_000);
  out.replaceChildren();
  if (!text) { out.append(el('p', 'Paste some text first.', 'muted')); return; }
  const phrases = tier0({ url: '', title: '', text, signals: EMPTY_SIGNALS, phrases: DEFAULT_SCAM_PHRASES });
  const r = redact(text);
  const lens = suggestLens('', '', text);

  const chip = el('div', undefined, `chip chip-${phrases.level}`);
  chip.append(el('strong', TIER0_LABEL[phrases.level]));
  if (phrases.findings.length) {
    const ul = el('ul');
    for (const f of phrases.findings) ul.append(el('li', f.label));
    chip.append(ul);
  }
  out.append(el('h2', 'Quick check'), chip,
    el('p', `Satark would use the ${lens === 'scam' ? 'Scams' : 'Fine print'} lens for this text.`, 'muted'));

  out.append(el('h2', 'What the cloud would see'));
  out.append(el('p', `Hidden before sending: ${describeRedactions(r.counts as Record<string, number>)}. On the on-device route, nothing is sent at all.`));
  out.append(el('pre', r.text, 'payload'));
}

$('pg-run').addEventListener('click', run);
$('pg-sample').addEventListener('click', () => {
  input.value = `${SAMPLE_SCAM_SMS}\nCall our officer on 9876543210 or pay to demo.officer@okdemo. Card 4111 1111 1111 1111.`;
  run();
});
