import { useCallback, useRef, useState } from 'react';
import {
  hasPersonalData, route,
  type CheckResult, type ConsentRequest, type Lens, type PageSnapshot, type RemoteSettings, type UserSettings,
} from '@satark/core';
import { onDeviceStatus, runCheck } from '@/lib/engine';
import { firebaseConfigured } from '@/lib/config';
import { clearHighlight, highlight } from '@/lib/messaging';

export type CheckState =
  | { s: 'idle' }
  | { s: 'running'; where: 'device' | 'cloud' }
  | { s: 'result'; result: CheckResult }
  | { s: 'error'; message: string };

export function useCheck(opts: {
  settings: UserSettings; remote: RemoteSettings;
  askConsent: (req: ConsentRequest) => Promise<boolean>;
  highlightOnPage: boolean;
}) {
  const [state, setState] = useState<CheckState>({ s: 'idle' });
  const ctrl = useRef<AbortController | null>(null);

  const run = useCallback(async (snap: PageSnapshot, lens: Lens, modeOverride?: UserSettings['mode']) => {
    const settings = modeOverride ? { ...opts.settings, mode: modeOverride } : opts.settings;
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    const status = await onDeviceStatus();
    const preview = route({
      userMode: settings.mode, status, simulateNoOnDevice: settings.simulate, lang: snap.lang,
      chars: snap.text.length, hasPersonalData: hasPersonalData(snap.text), online: navigator.onLine,
      cloudEnabled: opts.remote.cloudEnabled && firebaseConfigured, onDeviceMaxChars: opts.remote.onDeviceMaxChars,
    });
    const cloudy = preview.sdkMode === 'ONLY_IN_CLOUD' || preview.sdkMode === 'PREFER_IN_CLOUD';
    setState({ s: 'running', where: cloudy ? 'cloud' : 'device' });
    if (opts.highlightOnPage) void clearHighlight().catch(() => undefined);
    try {
      const result = await runCheck({
        snap, lens, settings, remote: opts.remote, signal: c.signal,
        askConsent: async (req) => {
          setState({ s: 'running', where: 'cloud' });
          return opts.askConsent(req);
        },
      });
      if (c.signal.aborted) return;
      setState({ s: 'result', result });
      const quotes = result.analysis?.reasons.map((r) => r.quote) ?? [];
      if (opts.highlightOnPage && quotes.length) void highlight(quotes).catch(() => undefined);
    } catch (e) {
      if (c.signal.aborted || (e as Error)?.name === 'AbortError') { setState({ s: 'idle' }); return; }
      setState({ s: 'error', message: String((e as Error)?.message ?? e) });
    }
  }, [opts]);

  const cancel = useCallback(() => { ctrl.current?.abort(); setState({ s: 'idle' }); }, []);
  const reset = useCallback(() => setState({ s: 'idle' }), []);
  return { state, run, cancel, reset };
}
