import { describe, expect, it } from 'vitest';
import { radar, partialNote } from '../src/radar';

const paras = Array.from({ length: 200 }, (_, i) =>
  i % 17 === 0 ? `Clause ${i}: this plan will automatically renew and a late fee and penalty interest apply.` : `Paragraph ${i} about ordinary matters and nothing special at all here.`);
const text = paras.join('\n\n');

describe('clause radar', () => {
  it('returns short text unchanged', () => {
    expect(radar('short text', 'fineprint', 9000)).toMatchObject({ text: 'short text', partial: false });
  });
  it('never exceeds the budget', () => {
    for (const b of [200, 1000, 3000, 9000]) expect(radar(text, 'fineprint', b).text.length).toBeLessThanOrEqual(b);
  });
  it('keeps the most relevant paragraphs in original order', () => {
    const r = radar(text, 'fineprint', 1000);
    expect(r.partial).toBe(true);
    const nums = [...r.text.matchAll(/(Clause|Paragraph) (\d+)/g)].map((m) => Number(m[2]));
    expect(nums).toEqual([...nums].sort((a, b) => a - b));
    expect(r.text).toContain('Clause 0:');
    expect(r.text).toContain('Clause 17:');
    expect(partialNote(r)).toMatch(/^Checked the \d+ most relevant of 200 paragraphs$/);
  });
  it('handles one giant paragraph', () => {
    const r = radar('x'.repeat(5000), 'scam', 1000);
    expect(r.text.length).toBe(1000);
  });
});
