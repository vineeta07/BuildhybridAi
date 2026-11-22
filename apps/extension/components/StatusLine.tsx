import type { OnDeviceStatus } from '@satark/core';

export function statusWords(status: OnDeviceStatus | 'checking', simulate: boolean, progress?: number): { text: string; color: string } {
  if (simulate) return { text: 'Simulating: no on-device AI (cloud fallback on)', color: 'bg-caution' };
  if (progress !== undefined && progress < 1) return { text: `Downloading ${Math.round(progress * 100)}%`, color: 'bg-caution' };
  switch (status) {
    case 'available': return { text: 'On-device AI ready', color: 'bg-safe' };
    case 'downloading': return { text: 'On-device AI downloading', color: 'bg-caution' };
    case 'downloadable': return { text: 'On-device AI can be downloaded', color: 'bg-slate-400' };
    case 'checking': return { text: 'Checking on-device AI…', color: 'bg-slate-300' };
    default: return { text: 'Not available on this laptop, cloud fallback on', color: 'bg-slate-400' };
  }
}

export function StatusDot(props: { status: OnDeviceStatus | 'checking'; simulate: boolean; progress?: number }) {
  const { text, color } = statusWords(props.status, props.simulate, props.progress);
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-slate-600">
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${color}`} aria-hidden="true" />
      {text}
    </span>
  );
}
