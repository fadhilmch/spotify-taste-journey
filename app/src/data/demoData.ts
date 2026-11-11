import type { ArtistGenre, PlayAggregate, PlayEvent } from './types';

/**
 * Fictional demo dataset so the app is fully explorable before a real export
 * lands. Every artist, track and listening figure below is invented. One demo
 * artist deliberately has no genre mapping, so the "Uncategorized" bucket and
 * the coverage readout behave the way they will with real data.
 */

interface DemoArtist {
  name: string;
  /** Fictional origin, same shape as MusicBrainz data. null = no origin on record. */
  origin: { country: string | null; area: string | null } | null;
  group: string | null; // null = stays uncategorized
  tags: string[];
  peak: number; // month index (0 = May 2024)
  spread: number;
  tracks: string[];
}

/** First month index the artist is heard - staggered so discoveries spread out. */
function introIndex(a: DemoArtist): number {
  return Math.max(0, Math.round(a.peak - 2.2 * a.spread));
}

export const DEMO_MONTH_START = { year: 2024, month: 4 }; // May 2024, 0-based month
export const DEMO_MONTH_COUNT = 30; // through Oct 2026

const DEMO_ARTISTS: DemoArtist[] = [
  {
    name: 'Senja Radio',
    origin: { country: 'ID', area: 'Jakarta, Indonesia' },
    group: 'Folk & acoustic',
    tags: ['indie folk', 'acoustic'],
    peak: 2,
    spread: 3.5,
    tracks: ['Kopi Pagi', 'Senja Drive', 'Golden Hour, Slow'],
  },
  {
    name: 'Monochrome Club',
    origin: { country: 'GB', area: 'Manchester, United Kingdom' },
    group: 'Rock',
    tags: ['indie rock', 'alternative rock'],
    peak: 6,
    spread: 4,
    tracks: ['Velvet Static', 'Rooftop Letters', 'Grey Avenue'],
  },
  {
    name: 'Kota Lights',
    origin: { country: 'ID', area: 'Bandung, Indonesia' },
    group: 'Electronic',
    tags: ['synth-pop', 'electropop'],
    peak: 11,
    spread: 3.5,
    tracks: ['Neon Sahur', 'City of Sparks', 'Midnight Commute'],
  },
  {
    name: 'Pantai Ensemble',
    origin: { country: 'ID', area: 'Yogyakarta, Indonesia' },
    group: 'Folk & acoustic',
    tags: ['acoustic', 'folk'],
    peak: 15,
    spread: 3,
    tracks: ['Kartika', 'Tide Lines', 'Salt & Strings'],
  },
  {
    name: 'Voltage Park',
    origin: { country: 'US', area: 'Austin, United States' },
    group: 'Rock',
    tags: ['rock', 'hard rock'],
    peak: 19,
    spread: 3.5,
    tracks: ['Overdrive', 'Midnight Sprint', 'Redline'],
  },
  {
    name: 'Arunika',
    origin: { country: 'ID', area: 'Surabaya, Indonesia' },
    group: 'Folk & acoustic',
    tags: ['singer-songwriter', 'acoustic'],
    peak: 23,
    spread: 3,
    tracks: ['Paper Boats', 'First Light', 'Harbor'],
  },
  {
    name: 'DJ Rantai',
    origin: { country: 'ID', area: 'Jakarta, Indonesia' },
    group: 'Electronic',
    tags: ['house', 'dance'],
    peak: 26,
    spread: 2.5,
    tracks: ['Bassline Carousel', 'Final Drop', 'Chain Reaction'],
  },
  {
    name: 'June Harbor',
    origin: { country: 'SE', area: 'Stockholm, Sweden' },
    group: 'Ambient & classical',
    tags: ['ambient', 'piano'],
    peak: 29,
    spread: 2.5,
    tracks: ['Tea at Dawn', 'Wool Sweater', 'Quiet Season'],
  },
  {
    name: 'Lost Cartographer',
    origin: { country: null, area: null },
    group: null,
    tags: [],
    peak: 14,
    spread: 9,
    tracks: ['Unmapped', 'No Signal'],
  },
];

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function demoMonthKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < DEMO_MONTH_COUNT; i++) {
    const y = DEMO_MONTH_START.year + Math.floor((DEMO_MONTH_START.month + i) / 12);
    const m = ((DEMO_MONTH_START.month + i) % 12) + 1;
    keys.push(`${y}-${String(m).padStart(2, '0')}`);
  }
  return keys;
}

const TRACK_SPLIT = [0.52, 0.31, 0.17];

/** Deterministic fictional aggregates, same shape as a parsed export. */
export function buildDemoAggregates(): PlayAggregate[] {
  const keys = demoMonthKeys();
  const rnd = mulberry32(20261021);
  const monthlyTotals = keys.map((_, i) => {
    const base = 1750 + 620 * Math.sin(i / 4.6) + 340 * Math.sin(i / 2.1 + 1.4);
    return Math.max(640, Math.round(base + (rnd() - 0.5) * 520));
  });
  const rnd2 = mulberry32(42);
  const aggs: PlayAggregate[] = [];
  const artistMonthMs = new Map<string, number>();
  let sum = 0;
  for (const a of DEMO_ARTISTS) {
    keys.forEach((key, i) => {
      if (i < introIndex(a)) return;
      const g = Math.exp(-((i - a.peak) ** 2) / (2 * a.spread * a.spread));
      const jitter = 0.75 + rnd2() * 0.5;
      const ms = Math.round((monthlyTotals[i] * 0.62 * g * jitter + monthlyTotals[i] * 0.02) * 60000);
      artistMonthMs.set(`${a.name}${key}`, ms);
      sum += ms;
    });
  }
  const targetShare = 0.78;
  const grandTotal = monthlyTotals.reduce((s, v) => s + v, 0) * 60000;
  const scale = (grandTotal * targetShare) / sum;
  for (const a of DEMO_ARTISTS) {
    a.tracks.forEach((track, ti) => {
      keys.forEach((key, ki) => {
        if (ki < introIndex(a)) return;
        const ms = Math.round(
          (artistMonthMs.get(`${a.name}${key}`) ?? 0) * scale * (TRACK_SPLIT[ti] ?? 0.05),
        );
        if (ms > 0) aggs.push({ month: key, artist: a.name, track, ms });
      });
    });
  }
  return aggs;
}

export const DEMO_GENRES: Record<string, ArtistGenre> = Object.fromEntries(
  DEMO_ARTISTS.filter((a) => a.group).map((a) => [
    a.name,
    {
      groups: [a.group as string],
      tags: a.tags,
      source: 'demo' as const,
      matchedName: a.name,
      origin: a.origin ?? undefined,
    },
  ]),
);

/** Fictional start reasons: mostly carried on, some chosen, some after a forward press. */
function demoStart(r: number): string {
  if (r < 0.55) return 'trackdone';
  if (r < 0.8) return 'fwdbtn';
  if (r < 0.95) return 'clickrow';
  return 'playbtn';
}

const DEMO_PLATFORMS = ['android', 'android', 'ios', 'windows', 'mac'];

/**
 * Fictional per-play events that match the demo aggregates in spirit (not
 * row-for-row): evening-heavy hours, some skips, mostly shuffle, a phone-first
 * platform mix. Deterministic via the same seeded generator.
 */
export function buildDemoEvents(): PlayEvent[] {
  const keys = demoMonthKeys();
  const rnd = mulberry32(777);
  const events: PlayEvent[] = [];
  for (const a of DEMO_ARTISTS) {
    keys.forEach((key, i) => {
      if (i < introIndex(a)) return;
      const g = Math.exp(-((i - a.peak) ** 2) / (2 * a.spread * a.spread));
      const plays = Math.round(g * 34 + rnd() * 6);
      const y = Number(key.slice(0, 4));
      const m = Number(key.slice(5, 7));
      for (let p = 0; p < plays; p++) {
        const day = 1 + Math.floor(rnd() * 28);
        // Weekday rhythm: Fridays and Saturdays listen heaviest, midweek lighter.
        const wd = new Date(Date.UTC(y, m - 1, day)).getUTCDay();
        const wdWeight = wd === 5 || wd === 6 ? 1 : wd === 0 ? 0.9 : 0.62;
        if (rnd() > wdWeight) continue;
        // Evening-heavy: 60% between 17-23, else spread across the day.
        const hour = rnd() < 0.6 ? 17 + Math.floor(rnd() * 7) : 7 + Math.floor(rnd() * 10);
        const minute = Math.floor(rnd() * 60);
        const ts = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00Z`;
        const skipped = rnd() < 0.09;
        const ms = skipped ? 5000 + Math.floor(rnd() * 25000) : 120000 + Math.floor(rnd() * 120000);
        events.push({
          ts,
          artist: a.name,
          track: a.tracks[Math.floor(rnd() * a.tracks.length)],
          ms,
          skipped,
          reasonEnd: skipped ? 'fwdbtn' : 'trackdone',
          reasonStart: demoStart(rnd()),
          album: null,
          shuffle: rnd() < 0.55,
          offline: rnd() < 0.06,
          platform: DEMO_PLATFORMS[Math.floor(rnd() * DEMO_PLATFORMS.length)],
        });
      }
    });
  }
  events.sort((x, y) => (x.ts < y.ts ? -1 : 1));
  return events;
}
