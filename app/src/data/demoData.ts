import type { ArtistGenre, PlayAggregate, PlayEvent } from './types';

/**
 * Fictional demo dataset so the app is fully explorable before a real export
 * lands: ten invented years of listening (June 2016 to October 2026). Every
 * artist, track, album and listening figure below is invented. One demo artist
 * deliberately has no genre or origin, so the "Uncategorized" bucket and the
 * "no origin" share behave the way they will with real data. A long tail of
 * generated names gives the history the many-small-artists shape of a real one.
 */

interface DemoArtist {
  name: string;
  /** Fictional origin, same shape as MusicBrainz data. null = no origin on record. */
  origin: { country: string | null; area: string | null } | null;
  group: string | null; // null = stays uncategorized
  tags: string[];
  /** Hours per month in each calendar year, 2016 to 2026. 0 = not listened to that year. */
  levels: number[];
  /** First month heard (YYYY-MM); defaults to the January of the first year with a level. */
  start?: string;
  tracks: string[];
  albums: string[];
}

export const DEMO_MONTH_START = { year: 2016, month: 5 }; // June 2016, 0-based month
export const DEMO_MONTH_COUNT = 125; // through Oct 2026
const FIRST_YEAR = 2016;

//                                   2016  17    18    19    20   21    22    23    24    25    26
const DEMO_ARTISTS: DemoArtist[] = [
  {
    name: 'Senja Radio',
    origin: { country: 'ID', area: 'Jakarta, Indonesia' },
    group: 'Folk & acoustic',
    tags: ['indie folk', 'acoustic'],
    levels: [22, 24, 15, 7, 0.8, 4.2, 3.5, 4.5, 3, 3, 2.5],
    tracks: ['Kopi Pagi', 'Senja Drive', 'Golden Hour, Slow', 'Hujan di Kota'],
    albums: ['Kopi Pagi', 'Slow Weather'],
  },
  {
    name: 'Monochrome Club',
    origin: { country: 'GB', area: 'Manchester, United Kingdom' },
    group: 'Rock',
    tags: ['indie rock', 'alternative rock'],
    levels: [6, 9, 17, 13, 0.8, 3.5, 14.5, 9, 5, 3.5, 5],
    tracks: ['Velvet Static', 'Rooftop Letters', 'Grey Avenue', 'Last Train Out', 'Paper Skyline'],
    albums: ['Velvet Static', 'Grey Avenue'],
  },
  {
    name: 'Kota Lights',
    origin: { country: 'ID', area: 'Bandung, Indonesia' },
    group: 'Electronic',
    tags: ['synth-pop', 'electropop'],
    levels: [0, 6, 10, 26, 0.8, 4.3, 4, 6, 6, 9, 6],
    start: '2017-03',
    tracks: ['Neon Sahur', 'City of Sparks', 'Midnight Commute', 'Glass Boulevard'],
    albums: ['Neon Sahur', 'City of Sparks'],
  },
  {
    name: 'Pantai Ensemble',
    origin: { country: 'ID', area: 'Yogyakarta, Indonesia' },
    group: 'Folk & acoustic',
    tags: ['acoustic', 'folk'],
    levels: [0, 4, 8, 6, 1.0, 3.2, 2, 0, 0, 0, 0],
    start: '2017-08',
    tracks: ['Kartika', 'Tide Lines', 'Salt & Strings'],
    albums: ['Tide Lines'],
  },
  {
    name: 'Voltage Park',
    origin: { country: 'US', area: 'Austin, United States' },
    group: 'Rock',
    tags: ['rock', 'hard rock'],
    levels: [0, 0, 0, 4, 0.8, 4.3, 6, 3, 1.5, 0, 0],
    start: '2019-05',
    tracks: ['Overdrive', 'Midnight Sprint', 'Redline', 'Gravel Heart'],
    albums: ['Overdrive', 'Redline'],
  },
  {
    name: 'Arunika',
    origin: { country: 'ID', area: 'Surabaya, Indonesia' },
    group: 'Folk & acoustic',
    tags: ['singer-songwriter', 'acoustic'],
    levels: [0, 0, 0, 0, 0, 4, 8, 28, 29, 12, 4],
    start: '2021-09',
    tracks: ['Paper Boats', 'First Light', 'Harbor', 'Lantern Season', 'Small Hours'],
    albums: ['Paper Boats', 'First Light'],
  },
  {
    name: 'DJ Rantai',
    origin: { country: 'ID', area: 'Jakarta, Indonesia' },
    group: 'Electronic',
    tags: ['house', 'dance'],
    levels: [0, 0, 6, 10, 0.8, 4.3, 5, 7, 5, 2, 0],
    start: '2018-04',
    tracks: ['Bassline Carousel', 'Final Drop', 'Chain Reaction'],
    albums: ['Chain Reaction'],
  },
  {
    name: 'June Harbor',
    origin: { country: 'SE', area: 'Stockholm, Sweden' },
    group: 'Ambient & classical',
    tags: ['ambient', 'piano'],
    levels: [0, 0, 0, 0, 0, 0, 0, 2, 6, 18, 11],
    start: '2023-09',
    tracks: ['Tea at Dawn', 'Wool Sweater', 'Quiet Season', 'Snow on the Pier'],
    albums: ['Tea at Dawn', 'Quiet Season'],
  },
  {
    name: 'Lost Cartographer',
    origin: { country: null, area: null },
    group: null,
    tags: [],
    levels: [3, 3, 3, 3, 0.8, 3.8, 3, 3, 3, 3, 3],
    tracks: ['Unmapped', 'No Signal'],
    albums: [],
  },
  {
    name: 'Ayo Kelani',
    origin: { country: 'NG', area: 'Lagos, Nigeria' },
    group: 'Latin & world',
    tags: ['afrobeats', 'highlife'],
    levels: [0, 0, 0, 0, 0, 4.3, 6.5, 6, 8, 5, 6],
    start: '2021-06',
    tracks: ['Lagos Sunday', 'Palm Wine Light', 'Okada Dreams', 'Slow Burn Season'],
    albums: ['Lagos Sunday', 'Palm Wine Light'],
  },
  {
    name: 'Hoshizora Line',
    origin: { country: 'JP', area: 'Osaka, Japan' },
    group: 'Pop',
    tags: ['city pop', 'j-pop'],
    levels: [0, 0, 0, 0, 0.8, 4.1, 7, 3, 2, 1, 3],
    start: '2020-02',
    tracks: ['Last Train Pink', 'Night Window', 'Soda Summer'],
    albums: ['Night Window'],
  },
  {
    name: 'Mar e Sal',
    origin: { country: 'BR', area: 'Salvador, Brazil' },
    group: 'Latin & world',
    tags: ['bossa nova', 'mpb'],
    levels: [0, 0, 0, 0, 0, 0, 3, 6, 9, 7, 5],
    start: '2022-05',
    tracks: ['Maré Alta', 'Sal na Pele', 'Domingo Azul', 'Janela Aberta'],
    albums: ['Maré Alta', 'Domingo Azul'],
  },
  {
    name: 'Minseo Rae',
    origin: { country: 'KR', area: 'Seoul, South Korea' },
    group: 'Pop',
    tags: ['k-pop', 'dream pop'],
    levels: [0, 0, 0, 0, 0, 0, 0, 0, 2, 6, 19],
    start: '2024-10',
    tracks: ['Moonlit Bus', 'Cherry Static', 'Window Seat', 'Afterglow 3AM', 'Paper Crown'],
    albums: ['Moonlit Bus', 'Window Seat'],
  },
  {
    name: 'Maison Brume',
    origin: { country: 'FR', area: 'Lyon, France' },
    group: 'Jazz',
    tags: ['nu jazz', 'lounge'],
    levels: [0, 0, 3, 4, 0.8, 3.8, 2, 2, 3, 4, 3],
    start: '2018-09',
    tracks: ['Brume du Matin', 'Rue Calme', 'Cafe Noir'],
    albums: ['Brume du Matin'],
  },
  {
    name: 'Brick & Verse',
    origin: { country: 'US', area: 'Atlanta, United States' },
    group: 'Hip-hop',
    tags: ['hip hop', 'boom bap'],
    levels: [0, 0, 0, 0, 0, 0, 0, 0, 4, 8, 6],
    start: '2024-03',
    tracks: ['Concrete Lullaby', 'Fourth Floor', 'Stoop Philosophy', 'Late Rent'],
    albums: ['Concrete Lullaby'],
  },
  {
    name: 'Saffron Hollow',
    origin: { country: 'GB', area: 'Bristol, United Kingdom' },
    group: 'R&B & soul',
    tags: ['neo soul', 'r&b'],
    levels: [0, 0, 0, 5, 0.8, 4.2, 3, 4, 3, 2, 3],
    start: '2019-09',
    tracks: ['Amber Hours', 'Slow Orbit', 'Honey Static'],
    albums: ['Amber Hours'],
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

/** The month that 34 new names arrive at once. */
const SPIKE_MONTH = '2020-04';

/** A long tail of invented small artists: deterministic syllable combinations. */
interface DemoFiller {
  name: string;
  track: string;
  /** Month index of the first play, and how many months it lasts. */
  start: number;
  life: number;
  /** Total minutes over the lifespan. */
  minutes: number;
}

const SYL = [
  'ba',
  'ko',
  'ri',
  'sel',
  'mu',
  'ta',
  'vel',
  'no',
  'dra',
  'fi',
  'lu',
  'pen',
  'ar',
  'zo',
  'ke',
  'shi',
  'wen',
  'ha',
  'jo',
  'mir',
  'tul',
  'ne',
  'qua',
  'be',
  'sor',
  'in',
  'pa',
  'del',
  'yu',
  'gra',
];
const SUFFIX = [
  'Quartet',
  'Club',
  'Collective',
  'Duo',
  'Choir',
  'Parade',
  'Trio',
  'Sound',
  'Orchestra',
  'Set',
];
const TRACK_A = ['Slow', 'Blue', 'Paper', 'Late', 'Open', 'Small', 'Quiet', 'Salt', 'Gold', 'Far'];
const TRACK_B = [
  'Window',
  'Rain',
  'Letter',
  'Static',
  'Garden',
  'Signal',
  'Harbor',
  'Morning',
  'Orbit',
  'Tape',
];

function cap(s: string): string {
  return s[0].toUpperCase() + s.slice(1);
}

let fillerCache: DemoFiller[] | null = null;
function demoFillers(): DemoFiller[] {
  if (fillerCache) return fillerCache;
  const keys = demoMonthKeys();
  const spike = keys.indexOf(SPIKE_MONTH);
  const rnd = mulberry32(8675309);
  const used = new Set(DEMO_ARTISTS.map((a) => a.name));
  const names: string[] = [];
  while (names.length < 85) {
    const n = 2 + Math.floor(rnd() * 2);
    let w = '';
    for (let i = 0; i < n; i++) w += SYL[Math.floor(rnd() * SYL.length)];
    const name = `${cap(w)} ${SUFFIX[Math.floor(rnd() * SUFFIX.length)]}`;
    if (used.has(name)) continue;
    used.add(name);
    names.push(name);
  }
  // Month counts of first listens, to keep ordinary months to a few new names at most.
  const startsPer = new Map<number, number>();
  const out: DemoFiller[] = names.map((name, i) => {
    const track = `${TRACK_A[Math.floor(rnd() * TRACK_A.length)]} ${TRACK_B[Math.floor(rnd() * TRACK_B.length)]}`;
    if (i < 34) {
      startsPer.set(spike, (startsPer.get(spike) ?? 0) + 1);
      return { name, track, start: spike, life: 7 + Math.floor(rnd() * 6), minutes: 330 + rnd() * 190 };
    }
    let start = 0;
    for (let tries = 0; tries < 20; tries++) {
      start = i < 40 ? 0 : 1 + Math.floor(rnd() * (keys.length - 4));
      if (start !== spike && (startsPer.get(start) ?? 0) < 2) break;
    }
    startsPer.set(start, (startsPer.get(start) ?? 0) + 1);
    const life = 2 + Math.floor(rnd() * 10);
    return {
      name,
      track,
      start,
      life: Math.min(life, keys.length - start),
      minutes: 25 + rnd() * rnd() * 200,
    };
  });
  fillerCache = out;
  return out;
}

const TRACK_SPLIT = [0.4, 0.28, 0.2, 0.12, 0.08];

/** Hours per month for one artist in month index i (a month before the year ends leans toward next year). */
function levelAt(a: DemoArtist, key: string): number {
  const y = Number(key.slice(0, 4));
  const m = Number(key.slice(5, 7));
  const cur = a.levels[y - FIRST_YEAR] ?? 0;
  const next = a.levels[y + 1 - FIRST_YEAR];
  if (next === undefined || m < 11) return cur;
  return cur + (next - cur) * (m === 11 ? 0.25 : 0.5);
}

let aggCache: PlayAggregate[] | null = null;

/** Deterministic fictional aggregates, same shape as a parsed export. */
export function buildDemoAggregates(): PlayAggregate[] {
  if (aggCache) return aggCache.map((r) => ({ ...r }));
  const keys = demoMonthKeys();
  const rnd = mulberry32(20261021);
  const monthFactor = keys.map(() => 0.92 + rnd() * 0.16);
  const aggs: PlayAggregate[] = [];
  for (const a of DEMO_ARTISTS) {
    const firstYear = a.levels.findIndex((v) => v > 0);
    const startKey = a.start ?? `${FIRST_YEAR + firstYear}-01`;
    const first = keys.indexOf(startKey < keys[0] ? keys[0] : startKey);
    keys.forEach((key, i) => {
      if (i < first) return;
      const lvl = levelAt(a, key);
      if (lvl <= 0) return;
      const ramp = i - first < 3 && first > 0 ? [0.4, 0.7, 0.9][i - first] : 1;
      const minutes = lvl * 60 * monthFactor[i] * ramp * (0.8 + rnd() * 0.4);
      const n = a.tracks.length;
      const norm = TRACK_SPLIT.slice(0, n).reduce((s, v) => s + v, 0);
      a.tracks.forEach((track, ti) => {
        const ms = Math.round((minutes * 60000 * TRACK_SPLIT[ti] * (0.85 + rnd() * 0.3)) / norm);
        if (ms > 0) aggs.push({ month: key, artist: a.name, track, ms });
      });
    });
  }
  for (const f of demoFillers()) {
    for (let k = 0; k < f.life; k++) {
      const i = f.start + k;
      if (i >= keys.length) break;
      const ms = Math.round((f.minutes / f.life) * 60000 * (0.6 + rnd() * 0.8));
      aggs.push({ month: keys[i], artist: f.name, track: f.track, ms });
    }
  }
  aggs.sort((x, y) => (x.month < y.month ? -1 : x.month > y.month ? 1 : 0));
  aggCache = aggs;
  return aggs.map((r) => ({ ...r }));
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

/** Forward-button share of plays per year, 2016 to 2026: it climbs, peaks in 2024, then eases. */
const FWD_RATE = [0.17, 0.2, 0.28, 0.36, 0.3, 0.24, 0.35, 0.45, 0.52, 0.4, 0.33];
/** Share of plays begun by choosing (click, play button) per year. */
const CHOSEN_RATE = [0.32, 0.3, 0.26, 0.22, 0.28, 0.3, 0.24, 0.2, 0.18, 0.22, 0.25];
/** Relative weight of each hour of the day; 21:00 is clearly the busiest. */
const HOUR_WEIGHT = [
  0.6, 0.3, 0.15, 0.1, 0.1, 0.2, 0.6, 1.2, 1.4, 1, 0.9, 1, 1.3, 1.1, 1, 1, 1.2, 1.6, 2.2, 3, 3.6, 5, 3.2, 1.4,
];
/** Years with songs on repeat, and how many loops each. */
const LOOPS: Record<number, number> = { 2017: 3, 2019: 4, 2022: 5, 2023: 2, 2025: 4 };
const DEMO_PLATFORMS = ['android', 'android', 'ios', 'windows', 'mac'];
const EVENT_TARGET = 30000;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Fictional per-play events that match the demo aggregates in spirit (not
 * row-for-row): the same artists and months, evening-heavy hours, a forward
 * share that changes by year, some tracks on repeat and a phone-first platform
 * mix. Deterministic via the same seeded generator.
 */
export function buildDemoEvents(): PlayEvent[] {
  const aggs = buildDemoAggregates();
  const albumOf = new Map<string, string>();
  for (const a of DEMO_ARTISTS)
    a.tracks.forEach((t, i) => {
      if (a.albums.length > 0) albumOf.set(`${a.name}\u0000${t}`, a.albums[i % a.albums.length]);
    });
  const rnd = mulberry32(777);
  const byMonth = new Map<string, PlayAggregate[]>();
  let totalMs = 0;
  for (const r of aggs) {
    let list = byMonth.get(r.month);
    if (!list) byMonth.set(r.month, (list = []));
    list.push(r);
    totalMs += r.ms;
  }
  const hourTotal = HOUR_WEIGHT.reduce((s, v) => s + v, 0);
  const pickHour = (): number => {
    let x = rnd() * hourTotal;
    for (let h = 0; h < 24; h++) {
      x -= HOUR_WEIGHT[h];
      if (x <= 0) return h;
    }
    return 21;
  };
  const events: PlayEvent[] = [];
  const mk = (
    y: number,
    m: number,
    day: number,
    hour: number,
    minute: number,
    artist: string,
    track: string,
    fwd: boolean,
    startReason: string,
    ms: number,
  ): PlayEvent => ({
    ts: `${y}-${pad(m)}-${pad(day)}T${pad(hour)}:${pad(minute)}`,
    artist,
    track,
    ms,
    skipped: fwd && rnd() < 0.9,
    reasonEnd: fwd ? 'fwdbtn' : 'trackdone',
    reasonStart: startReason,
    album: albumOf.get(`${artist}\u0000${track}`) ?? null,
    shuffle: rnd() < 0.55,
    offline: rnd() < 0.06,
    platform: DEMO_PLATFORMS[Math.floor(rnd() * DEMO_PLATFORMS.length)],
  });
  const reasonStart = (yi: number, fwdRate: number): string => {
    const r = rnd();
    const chosen = CHOSEN_RATE[yi];
    if (r < chosen) return r < chosen * 0.7 ? 'clickrow' : 'playbtn';
    if (r < chosen + fwdRate * 0.85) return 'fwdbtn';
    return 'trackdone';
  };
  const monthly = [...byMonth.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
  const loopHours = new Set<string>();
  const loops: PlayEvent[] = [];
  for (const [key, rows] of monthly) {
    const y = Number(key.slice(0, 4));
    const m = Number(key.slice(5, 7));
    const yi = y - FIRST_YEAR;
    const monthMs = rows.reduce((s, r) => s + r.ms, 0);
    const n = Math.round((monthMs / totalMs) * EVENT_TARGET);
    const cum: number[] = [];
    let acc = 0;
    for (const r of rows) cum.push((acc += r.ms));
    for (let p = 0; p < n; p++) {
      const x = rnd() * acc;
      let lo = 0;
      let hi = cum.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (cum[mid] < x) lo = mid + 1;
        else hi = mid;
      }
      const row = rows[lo];
      const day = 1 + Math.floor(rnd() * 28);
      // Weekday rhythm: Fridays and Saturdays listen heaviest, midweek lighter.
      const wd = new Date(Date.UTC(y, m - 1, day)).getUTCDay();
      const wdWeight = wd === 5 || wd === 6 ? 1 : wd === 0 ? 0.9 : 0.62;
      if (rnd() > wdWeight) continue;
      const rate = Math.min(0.9, FWD_RATE[yi] + (row.artist === 'Voltage Park' ? 0.12 : 0));
      const fwd = rnd() < rate;
      const ms = fwd ? 4000 + Math.floor(rnd() * 28000) : 120000 + Math.floor(rnd() * 130000);
      events.push(
        mk(
          y,
          m,
          day,
          pickHour(),
          Math.floor(rnd() * 60),
          row.artist,
          row.track,
          fwd,
          reasonStart(yi, rate),
          ms,
        ),
      );
    }
    // Songs on repeat: one track, 5 to 8 plays a few minutes apart, late in the evening.
    if (m === 3 + ((y * 7) % 8) && LOOPS[y]) {
      const heavy = [...rows].sort((a, b) => b.ms - a.ms).slice(0, 6);
      for (let l = 0; l < LOOPS[y]; l++) {
        const row = heavy[Math.floor(rnd() * heavy.length)];
        const day = 2 + l * 6;
        const hour = 22;
        const count = 5 + Math.floor(rnd() * 4);
        const first = Math.floor(rnd() * 20);
        loopHours.add(`${y}-${pad(m)}-${pad(day)}T${pad(hour)}`);
        for (let c = 0; c < count; c++)
          loops.push(
            mk(
              y,
              m,
              day,
              hour,
              first + c * 3,
              row.artist,
              row.track,
              false,
              c === 0 ? 'clickrow' : 'trackdone',
              190000,
            ),
          );
      }
    }
  }
  // Keep other plays out of the hour where a loop runs, so the run stays unbroken.
  const kept = events.filter((e) => !loopHours.has(e.ts.slice(0, 13)));
  kept.push(...loops);
  kept.sort((x, y) => (x.ts < y.ts ? -1 : x.ts > y.ts ? 1 : 0));
  return kept;
}
