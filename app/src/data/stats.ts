import type {
  ArtistGenre,
  ArtistTotal,
  Chapter,
  ChapterKind,
  Coverage,
  Era,
  GenreMix,
  MonthBucket,
  PlayAggregate,
  PlayEvent,
  TrackTotal,
} from './types';

export const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function monthKeyOfTs(ts: string): string {
  return ts.slice(0, 7);
}

export function monthLabel(key: string): { label: string; short: string } {
  const [y, m] = key.split('-').map(Number);
  return { label: `${MONTH_NAMES[m - 1]} ${y}`, short: MONTH_NAMES[m - 1] };
}

/** Contiguous month buckets from first to last play, minutes rounded. */
export function buildMonths(aggs: PlayAggregate[]): MonthBucket[] {
  if (aggs.length === 0) return [];
  const keys = [...new Set(aggs.map((a) => a.month))].sort();
  const out: MonthBucket[] = [];
  let [y, m] = keys[0].split('-').map(Number);
  const [endY, endM] = keys[keys.length - 1].split('-').map(Number);
  const byMonth = new Map<string, number>();
  for (const a of aggs) byMonth.set(a.month, (byMonth.get(a.month) ?? 0) + a.ms);
  while (y < endY || (y === endY && m <= endM)) {
    const key = `${y}-${String(m).padStart(2, '0')}`;
    const { label, short } = monthLabel(key);
    out.push({ key, label, short, minutes: Math.round((byMonth.get(key) ?? 0) / 60000) });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

export function filterToMonths(aggs: PlayAggregate[], keys: ReadonlySet<string>): PlayAggregate[] {
  return aggs.filter((a) => keys.has(a.month));
}

export function totalMinutes(aggs: PlayAggregate[]): number {
  return Math.round(aggs.reduce((s, a) => s + a.ms, 0) / 60000);
}

export function topArtists(aggs: PlayAggregate[], n: number): ArtistTotal[] {
  const by = new Map<string, number>();
  for (const a of aggs) by.set(a.artist, (by.get(a.artist) ?? 0) + a.ms);
  return [...by.entries()]
    .map(([name, ms]) => ({ name, minutes: Math.round(ms / 60000) }))
    .sort((a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name))
    .slice(0, n);
}

export function topTracks(aggs: PlayAggregate[], n: number): TrackTotal[] {
  const by = new Map<string, TrackTotal & { ms: number }>();
  for (const a of aggs) {
    const key = `${a.artist}${a.track}`;
    const cur = by.get(key) ?? { name: a.track, artist: a.artist, minutes: 0, ms: 0 };
    cur.ms += a.ms;
    by.set(key, cur);
  }
  return [...by.values()]
    .map((t) => ({ name: t.name, artist: t.artist, minutes: Math.round(t.ms / 60000) }))
    .sort((a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name))
    .slice(0, n);
}

/** Consecutive stretches of months led by the same top artist. */
export function artistEras(months: MonthBucket[], aggs: PlayAggregate[]): Era[] {
  const eras: Era[] = [];
  let cur: Era | null = null;
  for (const mo of months) {
    const top = topArtists(
      aggs.filter((a) => a.month === mo.key),
      1,
    )[0];
    if (!top) continue;
    if (cur && cur.artist === top.name) {
      cur.to = mo.key;
      cur.minutes += top.minutes;
    } else {
      if (cur) eras.push(cur);
      cur = { artist: top.name, from: mo.key, to: mo.key, minutes: top.minutes };
    }
  }
  if (cur) eras.push(cur);
  return eras;
}

export function uniqueArtists(aggs: PlayAggregate[]): string[] {
  return [...new Set(aggs.map((a) => a.artist))].sort((a, b) => a.localeCompare(b));
}

/**
 * Genre mix weighted by minutes. Artists with no matched genre contribute to
 * `uncategorized` - never guessed.
 */
export function genreMix(aggs: PlayAggregate[], genres: Record<string, ArtistGenre | undefined>): GenreMix {
  const byGroup = new Map<string, number>();
  let total = 0;
  let matched = 0;
  for (const a of aggs) {
    total += a.ms;
    const g = genres[a.artist];
    if (g && g.groups.length > 0) {
      matched += a.ms;
      byGroup.set(g.groups[0], (byGroup.get(g.groups[0]) ?? 0) + a.ms);
    }
  }
  const slices = [...byGroup.entries()]
    .map(([group, ms]) => ({ group, minutes: Math.round(ms / 60000) }))
    .sort((a, b) => b.minutes - a.minutes || a.group.localeCompare(b.group));
  return {
    slices,
    uncategorized: Math.round((total - matched) / 60000),
    total: Math.round(total / 60000),
  };
}

export function coverage(aggs: PlayAggregate[], genres: Record<string, ArtistGenre | undefined>): Coverage {
  let matched = 0;
  let total = 0;
  for (const a of aggs) {
    total += a.ms;
    const g = genres[a.artist];
    if (g && g.groups.length > 0) matched += a.ms;
  }
  return { matched: Math.round(matched / 60000), total: Math.round(total / 60000) };
}

export function rangeMonthKeys(months: MonthBucket[], range: string): Set<string> {
  const len = range === '4w' ? 1 : range === '6m' ? 6 : range === '1y' ? 12 : months.length;
  return new Set(months.slice(Math.max(0, months.length - len)).map((m) => m.key));
}

export function fmtMinutes(min: number): string {
  if (min >= 60000) return `${(min / 60000).toFixed(1)}k hr`;
  if (min >= 10000) return `${(min / 1000).toFixed(1)}k min`;
  if (min >= 1000) return `${(min / 1000).toFixed(1)}k min`;
  return `${min} min`;
}

/* ---- Deeper stats over per-play events (extended exports) ---- */

function hourOf(ev: PlayEvent): number {
  const d = new Date(ev.ts);
  return Number.isNaN(d.getTime()) ? -1 : d.getHours();
}

/** Minutes per hour of day (0-23), local time. -1 hours are dropped. */
export function hourHistogram(events: PlayEvent[]): number[] {
  const h = new Array<number>(24).fill(0);
  for (const ev of events) {
    const hr = hourOf(ev);
    if (hr >= 0) h[hr] += ev.ms / 60000;
  }
  return h.map((v) => Math.round(v));
}

/** Minutes per weekday, Monday-first. */
export function weekdayHistogram(events: PlayEvent[]): number[] {
  const w = new Array<number>(7).fill(0);
  for (const ev of events) {
    const d = new Date(ev.ts);
    if (Number.isNaN(d.getTime())) continue;
    w[(d.getDay() + 6) % 7] += ev.ms / 60000;
  }
  return w.map((v) => Math.round(v));
}

export interface SkipStats {
  /** False when no play carries how it ended (older exports), so nothing is guessed. */
  hasEnds: boolean;
  /** Share of plays whose recorded ending is the forward button, 0..1. */
  rate: number;
  byArtist: Array<{ artist: string; plays: number; skipRate: number }>;
}

/** A play "moved on" when its recorded ending is the forward button. This is not Spotify's skipped flag. */
export function endedOnForward(e: PlayEvent): boolean {
  return e.reasonEnd === 'fwdbtn';
}

export function skipStats(events: PlayEvent[]): SkipStats {
  const known = events.filter((e) => e.reasonEnd !== null);
  if (known.length === 0) return { hasEnds: false, rate: 0, byArtist: [] };
  let moved = 0;
  const by = new Map<string, { plays: number; skips: number }>();
  for (const e of known) {
    const cur = by.get(e.artist) ?? { plays: 0, skips: 0 };
    cur.plays += 1;
    if (endedOnForward(e)) {
      cur.skips += 1;
      moved += 1;
    }
    by.set(e.artist, cur);
  }
  const byArtist = [...by.entries()]
    .filter(([, v]) => v.plays >= 20)
    .map(([artist, v]) => ({ artist, plays: v.plays, skipRate: v.skips / v.plays }))
    .sort((a, b) => b.skipRate - a.skipRate || b.plays - a.plays || a.artist.localeCompare(b.artist));
  return { hasEnds: true, rate: moved / known.length, byArtist };
}

/** Forward-button share per calendar year; years with under 100 plays that carry an ending are left out. */
export function forwardByYear(events: PlayEvent[]): Array<{ year: string; plays: number; rate: number }> {
  const by = new Map<string, { plays: number; fwd: number }>();
  for (const e of events) {
    if (e.reasonEnd === null) continue;
    const y = e.ts.slice(0, 4);
    const cur = by.get(y) ?? { plays: 0, fwd: 0 };
    cur.plays += 1;
    if (endedOnForward(e)) cur.fwd += 1;
    by.set(y, cur);
  }
  return [...by.entries()]
    .filter(([, v]) => v.plays >= 100)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, v]) => ({ year, plays: v.plays, rate: v.fwd / v.plays }));
}

/**
 * Years where Spotify's own skipped flag is present on 100+ plays but never true, while the same plays
 * do record forward-button endings. The flag and the endings disagree there, so the flag is not used.
 */
export function skipFlagGapYears(events: PlayEvent[]): string[] {
  const by = new Map<string, { flagged: number; flagTrue: number; fwd: number }>();
  for (const e of events) {
    if (e.skipped === null) continue;
    const y = e.ts.slice(0, 4);
    const cur = by.get(y) ?? { flagged: 0, flagTrue: 0, fwd: 0 };
    cur.flagged += 1;
    if (e.skipped) cur.flagTrue += 1;
    if (endedOnForward(e)) cur.fwd += 1;
    by.set(y, cur);
  }
  return [...by.entries()]
    .filter(([, v]) => v.flagged >= 100 && v.flagTrue === 0 && v.fwd > 0)
    .map(([y]) => y)
    .sort();
}

export interface DiscoveryStats {
  /** New artists heard for the first time, per month. */
  byMonth: Array<{ month: string; count: number }>;
  /** Artists first heard in each month, most-played first (capped). */
  byMonthArtists: Array<{ month: string; artists: string[] }>;
  totalArtists: number;
  /** Artists heard in exactly one month. */
  oneMonthWonders: number;
  /** Artists heard in at least three distinct months. */
  keepers: number;
  /** Most recent first-listens. */
  latest: Array<{ artist: string; month: string }>;
}

export function discoveries(aggs: PlayAggregate[]): DiscoveryStats {
  const firstMonth = new Map<string, string>();
  const months = new Map<string, Set<string>>();
  for (const a of aggs) {
    const cur = firstMonth.get(a.artist);
    if (!cur || a.month < cur) firstMonth.set(a.artist, a.month);
    const set = months.get(a.artist) ?? new Set<string>();
    set.add(a.month);
    months.set(a.artist, set);
  }
  const byMonthMap = new Map<string, number>();
  for (const m of firstMonth.values()) byMonthMap.set(m, (byMonthMap.get(m) ?? 0) + 1);
  const byMonth = [...byMonthMap.entries()]
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month));
  let oneMonthWonders = 0;
  let keepers = 0;
  for (const set of months.values()) {
    if (set.size === 1) oneMonthWonders += 1;
    if (set.size >= 3) keepers += 1;
  }
  const latest = [...firstMonth.entries()]
    .map(([artist, month]) => ({ artist, month }))
    .sort((a, b) => b.month.localeCompare(a.month) || a.artist.localeCompare(b.artist))
    .slice(0, 5);
  const totalMs = new Map<string, number>();
  for (const a of aggs) totalMs.set(a.artist, (totalMs.get(a.artist) ?? 0) + a.ms);
  const byMonthArtists = [...byMonthMap.keys()].sort().map((month) => ({
    month,
    artists: [...firstMonth.entries()]
      .filter(([, m]) => m === month)
      .map(([artist]) => artist)
      .sort((a, b) => (totalMs.get(b) ?? 0) - (totalMs.get(a) ?? 0) || a.localeCompare(b))
      .slice(0, 8),
  }));
  return { byMonth, byMonthArtists, totalArtists: firstMonth.size, oneMonthWonders, keepers, latest };
}

export interface SessionStats {
  count: number;
  longestMin: number;
  activeDays: number;
}

/** Gap-based sessions: a new session starts after 30+ minutes of silence. */
export function sessions(events: PlayEvent[], gapMin = 30): SessionStats {
  const times = events
    .map((e) => new Date(e.ts).getTime())
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => a - b);
  if (times.length === 0) return { count: 0, longestMin: 0, activeDays: 0 };
  let count = 1;
  let longest = 0;
  let sessionStart = times[0];
  let prev = times[0];
  const days = new Set<string>();
  for (const t of times) {
    days.add(new Date(t).toDateString());
    if (t - prev > gapMin * 60000) {
      longest = Math.max(longest, prev - sessionStart);
      count += 1;
      sessionStart = t;
    }
    prev = t;
  }
  longest = Math.max(longest, prev - sessionStart);
  return { count, longestMin: Math.round(longest / 60000), activeDays: days.size };
}

export interface MixStats {
  shuffleShare: number | null;
  offlineShare: number | null;
  platforms: Array<{ name: string; share: number }>;
}

function platformName(raw: string): string {
  const p = raw.toLowerCase();
  if (p.includes('android')) return 'Android';
  if (p.includes('ios') || p.includes('iphone') || p.includes('ipad')) return 'iOS';
  if (p.includes('windows')) return 'Windows';
  if (p.includes('mac') || p.includes('os x')) return 'Mac';
  if (p.includes('linux')) return 'Linux';
  if (p.includes('web')) return 'Web player';
  return 'Other';
}

export function mixStats(events: PlayEvent[]): MixStats {
  const shuffled = events.filter((e) => e.shuffle !== null);
  const shuffleShare =
    shuffled.length > 0 ? shuffled.filter((e) => e.shuffle).length / shuffled.length : null;
  const off = events.filter((e) => e.offline !== null);
  const offlineShare = off.length > 0 ? off.filter((e) => e.offline).length / off.length : null;
  const byMs = new Map<string, number>();
  let total = 0;
  for (const e of events) {
    if (!e.platform) continue;
    const name = platformName(e.platform);
    byMs.set(name, (byMs.get(name) ?? 0) + e.ms);
    total += e.ms;
  }
  const platforms =
    total > 0
      ? [...byMs.entries()]
          .map(([name, ms]) => ({ name, share: ms / total }))
          .sort((a, b) => b.share - a.share || a.name.localeCompare(b.name))
      : [];
  return { shuffleShare, offlineShare, platforms };
}

/**
 * Chapters: artist eras with a deterministic story label, the artist's share
 * of listening inside the era window, and its top track there.
 */
export function chapters(months: MonthBucket[], aggs: PlayAggregate[]): Chapter[] {
  const eras = artistEras(months, aggs);
  const monthMin = new Map(months.map((m) => [m.key, m.minutes]));
  const seen = new Set<string>();
  const lastKey = months[months.length - 1]?.key;
  return eras.map((e, i) => {
    const windowMin = months
      .filter((m) => m.key >= e.from && m.key <= e.to)
      .reduce((s, m) => s + (monthMin.get(m.key) ?? 0), 0);
    const share = windowMin > 0 ? e.minutes / windowMin : 0;
    const windowAggs = aggs.filter((a) => a.artist === e.artist && a.month >= e.from && a.month <= e.to);
    const topTrack = topTracks(windowAggs, 1)[0]?.name ?? null;
    let kind: ChapterKind;
    if (i === 0) kind = 'first';
    else if (seen.has(e.artist)) kind = 'comeback';
    else if (share >= 0.45) kind = 'takeover';
    else kind = 'phase';
    seen.add(e.artist);
    return {
      kind,
      artist: e.artist,
      from: e.from,
      to: e.to,
      minutes: e.minutes,
      share,
      topTrack,
      current: e.to === lastKey && i === eras.length - 1,
    };
  });
}
