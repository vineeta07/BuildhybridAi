import type { Msg, PageSnapshot, SnapshotReply } from '@satark/core';

/** Typed message helpers so a wrong shape fails to compile. */
export const send = <R = unknown>(msg: Msg): Promise<R> => chrome.runtime.sendMessage(msg);

export type SnapshotError = 'navigated' | 'unreadable' | 'no_tab' | 'unknown';

export class SnapshotFailure extends Error {
  constructor(public kind: SnapshotError, message: string) { super(message); }
}

export async function activeTabId(): Promise<number | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab?.id;
}

const UNREADABLE = /(chrome|edge|about|devtools|chrome-extension|view-source):|chromewebstore|chrome\.google\.com\/webstore|cannot be scripted|extensions gallery|Cannot access a chrome/i;

export async function requestSnapshot(): Promise<PageSnapshot> {
  const tabId = await activeTabId();
  if (tabId == null) throw new SnapshotFailure('no_tab', 'No active tab.');
  const reply = await send<SnapshotReply | undefined>({ t: 'GET_SNAPSHOT', tabId });
  if (!reply) throw new SnapshotFailure('unknown', 'No reply from the page.');
  if ('error' in reply) {
    const e = reply.error;
    if (/must request permission|activeTab|Cannot access contents of the page|host permission/i.test(e) && !UNREADABLE.test(e)) {
      throw new SnapshotFailure('navigated', e);
    }
    if (UNREADABLE.test(e) || /pdf|Frame with ID 0 was removed|No tab with id/i.test(e)) {
      throw new SnapshotFailure('unreadable', e);
    }
    throw new SnapshotFailure('unknown', e);
  }
  return reply;
}

export const highlight = (quotes: string[]) => send<boolean>({ t: 'HIGHLIGHT', quotes });
export const clearHighlight = () => send<boolean>({ t: 'CLEAR_HIGHLIGHT' });
