import { describe, expect, it } from 'vitest';
import { buildNarrative } from '../data/narrative';
import { buildHabitBeats } from '../data/habits';
import type { PlayAggregate, PlayEvent } from '../data/types';

const H = 3_600_000;
const agg = (month: string, artist: string, hours: number): PlayAggregate => ({
  month,
  artist,
  track: 't',
  ms: hours * H,
});

/** Full year 2021 led by `lead` with the given share (100 h total), plus an opening and closing full year. */
function fixture(share: number, leadArtist = 'Lead'): PlayAggregate[] {
  return [
    agg('2020-01', 'Old', 60),
    agg('2020-02', 'Other', 40),
    agg('2021-01', leadArtist, share * 100),
    ...Array.from({ length: 20 }, (_, i) => agg('2021-02', `Filler${i}`, ((1 - share) * 100) / 20)),
    agg('2022-12', 'Z', 1),
  ];
}
const titleOf = (aggs: PlayAggregate[], artist: string) =>
  buildNarrative(aggs)!.beats.find((b) => b.id === `run-2021-${artist}`)!;

describe('year-run titles by leader share', () => {
  it('lead: wide open, leads, takes over', () => {
    // Lead is not the first leader, and was not first heard in 2021 -> kind lead.
    const mk = (share: number) => [agg('2019-05', 'Lead', 0.1), agg('2019-05', 'Big', 5), ...fixture(share)];
    expect(titleOf(mk(0.05), 'Lead').title).toBe('2021: a wide-open year');
    expect(titleOf(mk(0.15), 'Lead').title).toBe('2021: Lead leads');
    expect(titleOf(mk(0.3), 'Lead').title).toBe('2021: Lead takes over');
  });

  it('rise: new name edges ahead, takes the lead, arrives and takes over', () => {
    expect(titleOf(fixture(0.05), 'Lead').title).toBe('2021: a new name edges ahead');
    expect(titleOf(fixture(0.15), 'Lead').title).toBe('2021: a new name takes the lead');
    expect(titleOf(fixture(0.3), 'Lead').title).toBe('2021: Lead arrives and takes over');
  });

  it('return: edges back ahead below 10%, back on top above', () => {
    const mk = (share: number) => [
      agg('2020-01', 'Lead', 100),
      agg('2021-01', 'Mid', 100),
      agg('2022-01', 'Lead', share * 100),
      ...Array.from({ length: 20 }, (_, i) => agg('2022-02', `F${i}`, ((1 - share) * 100) / 20)),
    ];
    const t = (share: number) =>
      buildNarrative(mk(share))!.beats.find((b) => b.id === 'run-2022-Lead')!.title;
    expect(t(0.05)).toBe('2022: Lead edges back ahead');
    expect(t(0.15)).toBe('2022: Lead is back on top');
    expect(t(0.3)).toBe('2022: Lead is back on top');
  });

  it('wide-open caption opens with the no-dominance sentence', () => {
    const b = titleOf(fixture(0.05), 'Lead');
    expect(b.caption).toContain('No single name dominated. Lead edged ahead with 5.0 h, 5% of the year.');
    expect(titleOf(fixture(0.3), 'Lead').caption).not.toContain('No single name dominated');
  });

  it('puts the busiest-year sentence only in the run holding the busiest full year', () => {
    const n = buildNarrative([agg('2020-01', 'A', 12), agg('2021-01', 'B', 600), agg('2022-01', 'C', 120)])!;
    const runs = n.beats.filter((b) => b.id.startsWith('run-'));
    const withBusiest = runs.filter((b) => b.caption.includes('Your busiest year'));
    expect(withBusiest.map((b) => b.id)).toEqual(['run-2021-B']);
    expect(withBusiest[0].caption).toContain('Your busiest year: 50 h a month.');
  });

  it('names the year when the run spans several', () => {
    const n = buildNarrative([agg('2020-01', 'A', 100), agg('2021-01', 'A', 600), agg('2022-01', 'B', 10)])!;
    const run = n.beats.find((b) => b.id === 'run-2020-A')!;
    expect(run.caption).toContain('2021 was your busiest year: 50 h a month.');
  });

  it('never calls a partial year the busiest', () => {
    const n = buildNarrative([agg('2020-07', 'A', 5000), agg('2021-01', 'B', 12), agg('2022-01', 'B', 12)])!;
    expect(n.beats.some((b) => b.caption.includes('busiest year'))).toBe(true);
    expect(n.beats.find((b) => b.id.startsWith('run-2020'))?.caption ?? '').not.toContain('busiest year');
  });

  it('open caption drops the boilerplate', () => {
    const open = buildNarrative(fixture(0.3))!.beats[0];
    expect(open.caption).not.toContain('Everything that follows');
    expect(open.caption).not.toContain('The bars show');
  });
});

describe('discovery spike chapter', () => {
  const base = (): PlayAggregate[] => {
    const out: PlayAggregate[] = [agg('2020-01', 'Seed', 1)];
    for (let m = 2; m <= 12; m += 1) out.push(agg(`2020-${String(m).padStart(2, '0')}`, `N${m}`, 1));
    return out;
  };
  const ev = [{ ts: '2020-01-01T10:00:00Z' }] as unknown as PlayEvent[];
  const newBeat = (aggs: PlayAggregate[]) => buildHabitBeats(ev, aggs).find((b) => b.id === 'habit-new')!;

  it('turns a big month into a spike chapter', () => {
    const aggs = [...base(), ...Array.from({ length: 30 }, (_, i) => agg('2021-10', `Burst${i}`, 1))];
    const b = newBeat(aggs);
    expect(b.title).toBe('October 2021: 30 new names in one month');
    expect(b.big).toBe('30');
    expect(b.unit).toBe('artists heard for the first time that month');
    expect(b.caption).toContain('most in any month of your history');
    expect(b.peak).toBe(1);
  });

  it('keeps the plain chapter when no month stands out', () => {
    const aggs = [...base(), ...Array.from({ length: 5 }, (_, i) => agg('2021-10', `Few${i}`, 1))];
    const b = newBeat(aggs);
    expect(b.title).toBe('How often you find someone new');
    expect(b.caption).not.toContain('Bars show');
  });

  it('does not count the first month of history as a spike', () => {
    const aggs = Array.from({ length: 40 }, (_, i) => agg('2020-01', `A${i}`, 1));
    expect(newBeat(aggs).title).toBe('How often you find someone new');
  });
});
