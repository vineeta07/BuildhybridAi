import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { EMPTY_SIGNALS, tier0 } from '../src/tier0';
import { DEFAULT_SCAM_PHRASES } from '../src/defaults';

const data = JSON.parse(readFileSync(fileURLToPath(new URL('../../../eval/samples.json', import.meta.url)), 'utf8')) as {
  samples: { id: string; lens: string; label: string; text: string }[];
};

describe('eval samples', () => {
  it('has the planned mix of 30 samples', () => {
    const count = (l: string) => data.samples.filter((s) => s.label === l).length;
    expect(data.samples).toHaveLength(30);
    expect([count('scam'), count('benign'), count('risky'), count('ordinary')]).toEqual([12, 8, 6, 4]);
    expect(new Set(data.samples.map((s) => s.id)).size).toBe(30);
  });
  it('Tier-0 raises at least one phrase flag on most scam samples (sanity check, not the AI eval)', () => {
    const scams = data.samples.filter((s) => s.label === 'scam');
    const flagged = scams.filter((s) => tier0({ url: '', title: '', text: s.text, signals: EMPTY_SIGNALS, phrases: DEFAULT_SCAM_PHRASES }).score > 0);
    expect(flagged.length).toBeGreaterThanOrEqual(8);
  });
});
