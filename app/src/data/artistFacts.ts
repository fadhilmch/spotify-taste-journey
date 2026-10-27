import type { PlayAggregate } from './types';

const MIN = 60_000;

export interface ArtistFacts {
  artist: string;
  minutes: number;
  plays: number;
  firstMonth: string;
  lastMonth: string;
  peakYear: string;
  peakYearMinutes: number;
  /** Minutes per month over the whole history, oldest first. */
  monthly: Array<{ month: string; minutes: number }>;
}

/** Facts about one artist, counted from the plays. Null when the artist is not in the data. */
export function artistFacts(aggs: PlayAggregate[], artist: string): ArtistFacts | null {
  const all = new Set<string>();
  const mine = new Map<string, number>();
  let plays = 0;
  for (const a of aggs) {
    all.add(a.month);
    if (a.artist !== artist) continue;
    mine.set(a.month, (mine.get(a.month) ?? 0) + a.ms);
    plays += 1;
  }
  if (mine.size === 0) return null;
  const months = [...all].sort();
  const mineKeys = [...mine.keys()].sort();
  const years = new Map<string, number>();
  for (const [m, ms] of mine) years.set(m.slice(0, 4), (years.get(m.slice(0, 4)) ?? 0) + ms);
  const peak = [...years].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0];
  return {
    artist,
    minutes: Math.round([...mine.values()].reduce((x, y) => x + y, 0) / MIN),
    plays,
    firstMonth: mineKeys[0],
    lastMonth: mineKeys[mineKeys.length - 1],
    peakYear: peak[0],
    peakYearMinutes: Math.round(peak[1] / MIN),
    monthly: months.map((month) => ({ month, minutes: Math.round((mine.get(month) ?? 0) / MIN) })),
  };
}
