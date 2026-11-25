import { describe, expect, it } from 'vitest';
import {
  DEMO_GENRES,
  DEMO_MONTH_COUNT,
  buildDemoAggregates,
  buildDemoEvents,
  demoMonthKeys,
} from '../data/demoData';
import { buildNarrative } from '../data/narrative';
import { buildCountryMapBeat, buildHabitBeats, buildReturnedBeat } from '../data/habits';
import { storyActs } from '../data/acts';
import { discoveries } from '../data/stats';
import { rediscoveries } from '../data/rediscovery';
import { normalizeArtistName } from '../data/genreService';
import type { PlayAggregate } from '../data/types';

const aggs = buildDemoAggregates();
const events = buildDemoEvents();
const story = buildNarrative(aggs)!;

/** Leader share per year-run, from the aggregates (same rule as the narrative). */
function runShares(
  data: PlayAggregate[],
): Array<{ artist: string; from: number; to: number; share: number }> {
  const years = [...new Set(data.map((a) => a.month.slice(0, 4)))].sort();
  const per = new Map<string, Map<string, number>>();
  for (const a of data) {
    const y = a.month.slice(0, 4);
    if (!per.has(y)) per.set(y, new Map());
    per.get(y)!.set(a.artist, (per.get(y)!.get(a.artist) ?? 0) + a.ms);
  }
  const leader = (y: string) => [...per.get(y)!].sort((a, b) => b[1] - a[1])[0][0];
  const runs: Array<{ artist: string; from: number; to: number }> = [];
  years.forEach((y, i) => {
    const l = leader(y);
    const last = runs[runs.length - 1];
    if (last && last.artist === l) last.to = i;
    else runs.push({ artist: l, from: i, to: i });
  });
  return runs.map((r) => {
    let mine = 0;
    let all = 0;
    for (let i = r.from; i <= r.to; i++) {
      mine += per.get(years[i])!.get(r.artist) ?? 0;
      for (const v of per.get(years[i])!.values()) all += v;
    }
    return { ...r, share: mine / all };
  });
}

describe('demo history spans ten years', () => {
  it('runs from 2016-06 to 2026-10, 125 months', () => {
    const keys = demoMonthKeys();
    expect(DEMO_MONTH_COUNT).toBe(125);
    expect(keys).toHaveLength(125);
    expect(keys[0]).toBe('2016-06');
    expect(keys[124]).toBe('2026-10');
    const months = [...new Set(aggs.map((a) => a.month))].sort();
    expect(months[0]).toBe('2016-06');
    expect(months[months.length - 1]).toBe('2026-10');
  });

  it('is deterministic and uses invented names with a long tail', () => {
    expect(buildDemoAggregates()).toEqual(aggs);
    expect(buildDemoEvents()).toEqual(events);
    const artists = new Set(aggs.map((a) => a.artist));
    expect(artists.size).toBeGreaterThanOrEqual(90);
    const countries = new Set(Object.values(DEMO_GENRES).map((g) => g.origin?.country));
    expect(countries.size).toBeGreaterThanOrEqual(8);
    expect(events.length).toBeLessThan(40000);
    expect(events.length).toBeGreaterThan(10000);
  });
});

describe('Story year chapters', () => {
  it('has many beats, in all three leader-share bands', () => {
    expect(story.beats.length).toBeGreaterThanOrEqual(8);
    const shares = runShares(aggs).map((r) => r.share);
    expect(shares.some((s) => s >= 0.25)).toBe(true);
    expect(shares.some((s) => s >= 0.1 && s < 0.25)).toBe(true);
    expect(shares.some((s) => s < 0.1)).toBe(true);
  });

  it('includes a comeback, a quiet year and constants', () => {
    const kinds = story.beats.map((b) => b.kind);
    expect(kinds).toContain('return');
    expect(kinds).toContain('quiet');
    expect(kinds).toContain('constants');
  });
});

describe('habit chapters', () => {
  const beats = buildHabitBeats(events, aggs);
  const ids = beats.map((b) => b.id);

  it('has the river, hours, forward, loops and new-names chapters', () => {
    for (const id of ['habit-river', 'habit-hours', 'habit-skips', 'habit-loops', 'habit-new']) {
      expect(ids).toContain(id);
    }
  });

  it('has a clear busiest hour and a forward arc that rises and falls', () => {
    const hours = beats.find((b) => b.id === 'habit-hours')!;
    const sorted = [...hours.values].sort((a, b) => b - a);
    expect(sorted[0]).toBeGreaterThan(sorted[1] * 1.1);
    const skips = beats.find((b) => b.id === 'habit-skips')!;
    expect(skips.values.length).toBeGreaterThanOrEqual(10);
    const top = skips.peak;
    expect(top).toBeGreaterThan(0);
    expect(top).toBeLessThan(skips.values.length - 1);
  });

  it('has a discovery spike: 30+ new names, at least 3x the usual month', () => {
    const d = discoveries(aggs);
    const first = [...new Set(aggs.map((a) => a.month))].sort()[0];
    const counts = d.byMonth.filter((m) => m.month !== first).map((m) => m.count);
    const sorted = [...counts].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const max = Math.max(...counts);
    expect(max).toBeGreaterThanOrEqual(30);
    expect(max).toBeGreaterThanOrEqual(3 * median);
    expect(beats.find((b) => b.id === 'habit-new')!.big).toBe(String(max));
  });

  it('has artists that went quiet', () => {
    expect(rediscoveries(aggs).length).toBeGreaterThanOrEqual(2);
    expect(buildReturnedBeat(aggs)).not.toBeNull();
  });
});

describe('storyActs with demo origins', () => {
  it('fills the prologue and all three acts', () => {
    const origins: Record<string, { country: string | null; area: string | null }> = {};
    for (const [artist, g] of Object.entries(DEMO_GENRES)) {
      if (g.origin?.country) origins[normalizeArtistName(artist)] = g.origin;
    }
    const extras = [...buildHabitBeats(events, aggs)];
    const map = buildCountryMapBeat(aggs, origins, 'demo');
    expect(map).not.toBeNull();
    extras.push(map!);
    const acts = new Set(storyActs(story.beats, extras).map((i) => i.act));
    for (const act of ['prologue', 'past', 'habits', 'origins']) expect(acts.has(act as never)).toBe(true);
  });
});
