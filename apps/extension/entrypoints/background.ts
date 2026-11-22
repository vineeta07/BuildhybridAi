import { defineBackground } from 'wxt/utils/define-background';
import { DEFAULT_REMOTE, tier0, type Msg, type PageSnapshot, type RemoteSettings } from '@satark/core/pure';

const EXTRACT_FILE = '/extract.js';

export default defineBackground(() => {
  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
      id: 'check-selection', title: 'Check selection with Satark', contexts: ['selection'],
    });
  });

  // Every handler opens the panel FIRST and without awaiting: sidePanel.open needs the gesture.
  // The request is handed over through storage.session so the panel cannot miss it.
  chrome.action.onClicked.addListener((tab) => {
    if (tab.id == null) return;
    void chrome.sidePanel.open({ tabId: tab.id });
    void chrome.storage.session.set({ pending: { t: 'CHECK_REQUESTED' } satisfies Msg, pendingAt: Date.now() });
  });

  chrome.commands.onCommand.addListener((command, tab) => {
    if (command !== 'check-page' || tab?.id == null) return;
    void chrome.sidePanel.open({ tabId: tab.id });
    void chrome.storage.session.set({ pending: { t: 'CHECK_REQUESTED' } satisfies Msg, pendingAt: Date.now() });
  });

  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== 'check-selection' || tab?.id == null) return;
    void chrome.sidePanel.open({ tabId: tab.id });
    void chrome.storage.session.set({
      pending: { t: 'SELECTION', text: (info.selectionText ?? '').slice(0, 40_000), url: tab.url ?? '' } satisfies Msg,
      pendingAt: Date.now(),
    });
  });

  chrome.runtime.onMessage.addListener((msg: Msg, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id) return; // only our own pages
    if (msg.t === 'GET_SNAPSHOT') {
      getSnapshot(msg.tabId).then(sendResponse, (e) => sendResponse({ error: String((e as Error)?.message ?? e) }));
      return true; // keep the channel open for the async reply
    }
    if (msg.t === 'HIGHLIGHT' || msg.t === 'CLEAR_HIGHLIGHT') {
      withActiveTab(async (tabId) => {
        if (msg.t === 'HIGHLIGHT') {
          await chrome.scripting.insertCSS({
            target: { tabId }, css: '::highlight(satark){background:#ffd54f;color:#111}',
          });
        }
        await chrome.tabs.sendMessage(tabId, msg);
      }).then(() => sendResponse(true), () => sendResponse(false));
      return true;
    }
    return undefined;
  });

  // Guardian mode (optional host permission): a Tier-0 badge on every page. No AI, no network.
  chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
    if (info.status !== 'complete' || !tab.url || !/^https?:/.test(tab.url)) return;
    void guardianBadge(tabId);
  });
});

async function getSnapshot(tabId: number): Promise<PageSnapshot> {
  await chrome.scripting.executeScript({ target: { tabId }, files: [EXTRACT_FILE] });
  const snap: PageSnapshot | undefined = await chrome.tabs.sendMessage(tabId, { t: 'EXTRACT' } satisfies Msg);
  if (!snap) throw new Error('The page did not answer.');
  return snap;
}

async function withActiveTab(fn: (tabId: number) => Promise<void>) {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (tab?.id != null) await fn(tab.id);
}

async function guardianBadge(tabId: number) {
  const { guardian, remoteCache } = await chrome.storage.local.get(['guardian', 'remoteCache']);
  if (guardian !== true) return;
  const granted = await chrome.permissions.contains({ origins: ['<all_urls>'] });
  if (!granted) return;
  try {
    const snap = await getSnapshot(tabId);
    const remote = { ...DEFAULT_REMOTE, ...(remoteCache as { values?: RemoteSettings } | undefined)?.values };
    const r = tier0({ url: snap.url, title: snap.title, text: snap.text, signals: snap.signals, phrases: remote.scamPhrases });
    const text = r.level === 'red' ? '!' : r.level === 'amber' ? '?' : '';
    await chrome.action.setBadgeText({ tabId, text });
    await chrome.action.setBadgeBackgroundColor({ tabId, color: r.level === 'red' ? '#B91C1C' : '#B45309' });
    await chrome.action.setTitle({
      tabId,
      title: r.level === 'neutral' ? 'Check this page with Satark' : `Satark quick check: ${r.findings.map((f) => f.label).join('; ')}`,
    });
  } catch { /* unreadable page: no badge */ }
}
