import { describe, expect, it } from 'vitest';
import { buildNarrative } from '../data/narrative';
import type { PlayAggregate } from '../data/types';

const H = 3_600_000;
const agg = (month: string, artist: string, hours: number): PlayAggregate => ({
  month,
  artist,
  track: 't',
  ms: hours * H,
});

describe('buildNarrative', () => {
  it('returns null without plays', () => {
    expect(buildNarrative([])).toBeNull();
  });

  it('flags partial first and last years and compares them per month', () => {
    const n = buildNarrative([
      agg('2020-07', 'A', 6),
      agg('2020-12', 'A', 6),
      agg('2021-01', 'B', 24),
      agg('2021-12', 'B', 12),
      agg('2022-01', 'B', 5),
      agg('2022-03', 'C', 1),
    ])!;
    expect(n.years.map((y) => [y.year, y.span, y.partial])).toEqual([
      ['2020', 6, true],
      ['2021', 12, false],
      ['2022', 3, true],
    ]);
    expect(n.years[0].hoursPerMonth).toBeCloseTo(2);
    expect(n.beats[0].caption).toMatch(/2020 starts in Jul 2020/);
    expect(n.beats[0].caption).toMatch(/never as full-year totals/);
    const last = n.beats[n.beats.length - 1].caption;
    expect(last).toBeTruthy();
  });

  it('builds a chapter per leader run and marks a returning leader', () => {
    const n = buildNarrative([
      agg('2018-01', 'Alpha', 50),
      agg('2018-12', 'Beta', 5),
      agg('2019-01', 'Beta', 40),
      agg('2019-12', 'Alpha', 3),
      agg('2020-01', 'Alpha', 60),
      agg('2020-12', 'Beta', 5),
    ])!;
    const kinds = n.beats.map((b) => b.kind);
    expect(kinds[0]).toBe('open');
    expect(kinds).toContain('return');
    const back = n.beats.find((b) => b.kind === 'return')!;
    expect(back.title).toMatch(/Alpha is back on top/);
    expect(back.caption).toMatch(/It had 3\.0 h in 2019/);
    expect(n.series['Alpha']).toEqual([50, 3, 60]);
  });

  it('states numbers from the plays only', () => {
    const n = buildNarrative([agg('2019-01', 'Solo', 10), agg('2020-01', 'Solo', 20)])!;
    expect(n.totalHours).toBeCloseTo(30);
    for (const b of n.beats) expect(b.caption).not.toMatch(/because|due to|since you/i);
  });
});
