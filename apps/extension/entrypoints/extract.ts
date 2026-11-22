import { defineUnlistedScript } from 'wxt/utils/define-unlisted-script';
import type { Msg, PageSignals, PageSnapshot } from '@satark/core/pure';

/**
 * Injected on demand (activeTab + scripting) after a user gesture; never listed in the
 * manifest. Extracts visible text and signals, and highlights verified quotes.
 * No AI, no Firebase, no network requests.
 */
export default defineUnlistedScript(() => {
  const w = window as unknown as { __satark?: boolean };
  if (w.__satark) return;
  w.__satark = true;
  chrome.runtime.onMessage.addListener((msg: Msg, _s, send) => {
    if (msg.t === 'EXTRACT') send(extract());
    else if (msg.t === 'HIGHLIGHT') send(highlight(msg.quotes));
    else if (msg.t === 'CLEAR_HIGHLIGHT') { CSS.highlights?.delete('satark'); send(true); }
    return undefined;
  });
});

const SKIP = /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|SVG|CANVAS|IFRAME)$/;

function extract(): PageSnapshot {
  return {
    origin: 'page', url: location.href, title: document.title,
    lang: document.documentElement.lang || 'und',
    text: visibleText(document.body).slice(0, 40_000),
    signals: collectSignals(),
  };
}

function isVisible(el: Element): boolean {
  const e = el as Element & { checkVisibility?: (o?: object) => boolean };
  if (typeof e.checkVisibility === 'function') return e.checkVisibility({ visibilityProperty: true, opacityProperty: true });
  const s = getComputedStyle(el);
  return s.display !== 'none' && s.visibility !== 'hidden';
}

function visibleText(root: Element | null): string {
  if (!root) return '';
  const out: string[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      const el = n.parentElement;
      if (!el || SKIP.test(el.tagName.toUpperCase())) return NodeFilter.FILTER_REJECT;
      if (!isVisible(el)) return NodeFilter.FILTER_REJECT;
      return n.nodeValue?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    },
  });
  let total = 0;
  for (let n = walker.nextNode(); n && total < 45_000; n = walker.nextNode()) {
    const v = n.nodeValue!.replace(/\s+/g, ' ').trim();
    out.push(v); total += v.length + 1;
  }
  return out.join('\n');
}

const DOMAINISH = /^(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+(?:\.[a-z0-9-]+)+)(?:\/\S*)?$/i;
const regDomain = (h: string) => h.toLowerCase().replace(/^www\./, '').split('.').slice(-2).join('.');

function countLinkHostMismatches(): number {
  let n = 0;
  for (const a of Array.from(document.querySelectorAll('a[href]')).slice(0, 2000)) {
    const text = (a.textContent ?? '').trim();
    const m = DOMAINISH.exec(text);
    if (!m?.[1]) continue;
    try {
      const href = new URL((a as HTMLAnchorElement).href, location.href);
      if (!/^https?:$/.test(href.protocol)) continue;
      if (regDomain(m[1]) !== regDomain(href.hostname)) n++;
    } catch { /* bad URL */ }
  }
  return n;
}

function collectSignals(): PageSignals {
  const host = location.hostname;
  const has = (sel: string) => { try { return document.querySelector(sel) !== null; } catch { return false; } };
  const bodyText = (document.body?.innerText ?? '').slice(0, 20_000);
  return {
    isHttps: location.protocol === 'https:',
    hasPasswordField: has('input[type=password]'),
    hasOtpField: has('input[autocomplete=one-time-code], input[name*=otp i], input[id*=otp i]'),
    hasCardField: has('input[autocomplete^=cc-], input[name*=card i]'),
    hasCountdownLike: /(expires in|only \d+ left|offer ends|hurry|ends in \d)/i.test(bodyText),
    hostIsIp: /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':'),
    hostHasPunycode: host.includes('xn--'),
    subdomainDepth: Math.max(0, host.split('.').length - 2),
    externalFormAction: Array.from(document.forms).some((f) => {
      const action = f.getAttribute('action');
      if (!action) return false;
      try { return regDomain(new URL(action, location.href).hostname) !== regDomain(host); } catch { return false; }
    }),
    linkHostMismatches: countLinkHostMismatches(),
  };
}

const normChar = (c: string) => c.replace(/[“”‘’"'`]/g, '').toLowerCase();

/**
 * Highlights each quote with the CSS Custom Highlight API, even when it spans several text
 * nodes: builds one normalized string with a char -> (node, offset) map.
 */
function highlight(quotes: string[]): boolean {
  if (!('highlights' in CSS)) return false;
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      const el = n.parentElement;
      return el && !SKIP.test(el.tagName.toUpperCase()) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n as Text);

  // Build the haystack: whitespace collapsed to one space, quotes stripped, lowercased.
  let hay = '';
  const map: { node: Text; offset: number }[] = [];
  let lastSpace = true;
  for (const node of nodes) {
    const d = node.data;
    for (let i = 0; i < d.length; i++) {
      const ch = d[i]!;
      if (/\s/.test(ch)) {
        if (lastSpace) continue;
        hay += ' '; map.push({ node, offset: i }); lastSpace = true;
        continue;
      }
      const c = normChar(ch);
      if (!c) continue;
      for (const cc of c) { hay += cc; map.push({ node, offset: i }); }
      lastSpace = false;
    }
    if (!lastSpace) { hay += ' '; map.push({ node, offset: d.length }); lastSpace = true; }
  }

  const ranges: Range[] = [];
  for (const q of quotes) {
    const needle = q.normalize('NFKC').replace(/[“”‘’"'`…]/g, '').replace(/\.{3}/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (needle.length < 4) continue;
    const at = hay.indexOf(needle);
    if (at < 0) continue;
    const start = map[at]!, end = map[at + needle.length - 1]!;
    try {
      const r = new Range();
      r.setStart(start.node, start.offset);
      r.setEnd(end.node, Math.min(end.offset + 1, end.node.length));
      ranges.push(r);
    } catch { /* node changed */ }
  }
  CSS.highlights.set('satark', new Highlight(...ranges));
  ranges[0]?.startContainer.parentElement?.scrollIntoView({
    block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
  });
  return ranges.length > 0;
}
