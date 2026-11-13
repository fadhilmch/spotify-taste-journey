import type { PlayAggregate } from './types';

/**
 * Rediscovery, listening eras and exploration. Arithmetic on plays only:
 * nothing here says why listening changed.
 */

const MIN = 60_000;

export interface Rediscovery {
  artist: string;
  minutes: number;
  /** Year with the most minutes for this artist. */
  peakYear: string;
  /** Last month (YYYY-MM) with any play. */
  lastMonth: string;
  /** Whole months between the last play and the end of the history. */
  monthsSince: number;
}

function monthIndex(key: string): number {
  const [y, m] = key.split('-').map(Number);
  return y * 12 + (m - 1);
}

/**
 * Artists that were heavily played and then went quiet.
 * `quietMonths`: how long without a play counts as quiet, `minMinutes`: how much listening counts as heavy.
 */
export function rediscoveries(aggs: PlayAggregate[], quietMonths = 12, minMinutes = 120): Rediscovery[] {
  if (aggs.length === 0) return [];
  let end = 0;
  const by = new Map<string, { ms: number; last: string; years: Map<string, number> }>();
  for (const a of aggs) {
    end = Math.max(end, monthIndex(a.month));
    let e = by.get(a.artist);
    if (!e) by.set(a.artist, (e = { ms: 0, last: a.month, years: new Map() }));
    e.ms += a.ms;
    if (a.month > e.last) e.last = a.month;
    const y = a.month.slice(0, 4);
    e.years.set(y, (e.years.get(y) ?? 0) + a.ms);
  }
  const out: Rediscovery[] = [];
  for (const [artist, e] of by) {
    const since = end - monthIndex(e.last);
    if (since < quietMonths || e.ms / MIN < minMinutes) continue;
    const peak = [...e.years].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0][0];
    out.push({
      artist,
      minutes: Math.round(e.ms / MIN),
      peakYear: peak,
      lastMonth: e.last,
      monthsSince: since,
    });
  }
  return out.sort((a, b) => b.minutes - a.minutes || (a.artist < b.artist ? -1 : 1));
}

export interface YearEra {
  year: string;
  top: string[];
  /** Of this year's top artists, how many were also in the previous year's top. */
  carried: number;
  /** Of this year's top artists, how many had never been played before this year. */
  fresh: number;
}

/** Top artists per year and how much of that list carries over from the year before. */
export function yearEras(aggs: PlayAggregate[], topN = 5): YearEra[] {
  const perYear = new Map<string, Map<string, number>>();
  const firstYear = new Map<string, string>();
  for (const a of [...aggs].sort((x, y) => (x.month < y.month ? -1 : x.month > y.month ? 1 : 0))) {
    const y = a.month.slice(0, 4);
    let m = perYear.get(y);
    if (!m) perYear.set(y, (m = new Map()));
    m.set(a.artist, (m.get(a.artist) ?? 0) + a.ms);
    if (!firstYear.has(a.artist)) firstYear.set(a.artist, y);
  }
  const years = [...perYear.keys()].sort();
  const tops = years.map((y) =>
    [...perYear.get(y)!]
      .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
      .slice(0, topN)
      .map(([n]) => n),
  );
  return years.map((year, i) => ({
    year,
    top: tops[i],
    carried: i === 0 ? 0 : tops[i].filter((n) => tops[i - 1].includes(n)).length,
    fresh: tops[i].filter((n) => firstYear.get(n) === year && i > 0).length,
  }));
}

export interface ExplorationYear {
  year: string;
  /** Share (0..1) of the year's minutes spent on artists first played that year. */
  newShare: number;
  newArtists: number;
}

/** Exploring versus returning: the first year on record is skipped, since everything is new there. */
export function exploration(aggs: PlayAggregate[]): ExplorationYear[] {
  const seen = new Set<string>();
  const years = [...new Set(aggs.map((a) => a.month.slice(0, 4)))].sort();
  const out: ExplorationYear[] = [];
  years.forEach((year, i) => {
    const rows = aggs.filter((a) => a.month.startsWith(year));
    const before = new Set(seen);
    let total = 0;
    let fresh = 0;
    const freshNames = new Set<string>();
    for (const r of rows) {
      total += r.ms;
      if (!before.has(r.artist)) {
        fresh += r.ms;
        freshNames.add(r.artist);
      }
      seen.add(r.artist);
    }
    if (i > 0 && total > 0) out.push({ year, newShare: fresh / total, newArtists: freshNames.size });
  });
  return out;
}

export interface ConcentrationYear {
  year: string;
  /** Distinct artists played that year. */
  artists: number;
  /** Fewest top artists whose minutes add up to at least half of the year. */
  half: number;
  /** Shares (0..1) of the year's minutes for the most-played artists, largest first. Capped at `maxDots`. */
  shares: number[];
  /** True when the data covers fewer than 12 months of that year. */
  partial: boolean;
}

/**
 * Narrow or wide: how many artists it takes to make up half of each year's minutes.
 * `half` and `artists` are counted over every artist; `shares` is only the largest
 * `maxDots` of them, for drawing. Plain arithmetic on the plays.
 */
export function concentration(aggs: PlayAggregate[], maxDots = 110): ConcentrationYear[] {
  const byYear = new Map<string, { minutes: Map<string, number>; months: Set<string> }>();
  for (const a of aggs) {
    const y = a.month.slice(0, 4);
    let e = byYear.get(y);
    if (!e) {
      e = { minutes: new Map(), months: new Set() };
      byYear.set(y, e);
    }
    e.minutes.set(a.artist, (e.minutes.get(a.artist) ?? 0) + a.ms);
    e.months.add(a.month);
  }
  const out: ConcentrationYear[] = [];
  for (const year of [...byYear.keys()].sort()) {
    const e = byYear.get(year)!;
    const sorted = [...e.minutes.values()].sort((a, b) => b - a);
    const total = sorted.reduce((s, v) => s + v, 0);
    if (total <= 0) continue;
    let run = 0;
    let half = 0;
    for (const v of sorted) {
      run += v;
      half += 1;
      if (run * 2 >= total) break;
    }
    out.push({
      year,
      artists: sorted.length,
      half,
      shares: sorted.slice(0, maxDots).map((v) => v / total),
      partial: e.months.size < 12,
    });
  }
  return out;
}
