import { TIER0_LABEL, type Tier0Result } from '@satark/core';
import { Alert, Bolt, Octagon } from './Icons';

const STYLE = {
  red: 'bg-danger-bg text-danger',
  amber: 'bg-caution-bg text-caution',
  neutral: 'bg-slate-100 text-slate-700',
} as const;

export function Tier0Chip({ r, expanded = false }: { r: Tier0Result; expanded?: boolean }) {
  const Icon = r.level === 'red' ? Octagon : r.level === 'amber' ? Alert : Bolt;
  return (
    <div className={`rounded-lg px-3 py-2 text-sm ${STYLE[r.level]}`}>
      <div className="flex items-center gap-2 font-medium"><Icon width={16} height={16} />{TIER0_LABEL[r.level]}</div>
      {(expanded || r.level !== 'neutral') && r.findings.length > 0 && (
        <ul className="mt-1 list-disc pl-6">
          {r.findings.map((f) => <li key={f.id}>{f.label}</li>)}
        </ul>
      )}
    </div>
  );
}
