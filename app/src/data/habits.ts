import {
  discoveries,
  endedOnForward,
  forwardByYear,
  albumStats,
  hourHistogram,
  loopStats,
  sessions,
  skipFlagGapYears,
  skipStats,
  startStats,
  weekdayHistogram,
} from './stats';
import { artistFacts } from './artistFacts';
import { rediscoveries } from './rediscovery';
import type { PlayAggregate, PlayEvent } from './types';

/**
 * Listening habits as story chapters. Counted from play timestamps only,
 * in the time zone of the browser that reads the file.
 */

export interface RiverBand {
  artist: string;
  /** Smoothed minutes per month, one value per month in `months`. */
  minutes: number[];
  total: number;
}
export interface RiverData {
  months: string[];
  bands: RiverBand[];
  /** Names that were a year's most played, in time order; these get labels. */
  leaders: string[];
}

export interface HabitBeat {
  id: string;
  label: string;
  title: string;
  /** Headline shown large, with its unit. */
  big: string;
  unit: string;
  caption: string;
  /** Minutes per bar. */
  values: number[];
  /** One label per bar. */
  labels: string[];
  /** Special chapters that carry an action. */
  kind?: 'returned' | 'artist' | 'origins' | 'share' | 'river';
  river?: RiverData;
  artist?: string;
  /** Index of the highlighted bar; -1 for none. */
  peak: number;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function argMax(v: number[]): number {
  let best = 0;
  for (let i = 1; i < v.length; i += 1) if (v[i] > v[best]) best = i;
  return best;
}
function argMin(v: number[]): number {
  let best = 0;
  for (let i = 1; i < v.length; i += 1) if (v[i] < v[best]) best = i;
  return best;
}
/** "It was 10% in 2018, highest in 2022 at 60%, and 20% in 2025." Plain arithmetic on the bars. */
function arcSentence(years: Array<{ year: string; rate: number }>): string {
  const first = years[0];
  const last = years[years.length - 1];
  const rates = years.map((y) => Math.round(y.rate * 100));
  const top = years[argMax(rates)];
  const p = (r: number) => Math.round(r * 100);
  return top === first || top === last
    ? `It went from ${p(first.rate)}% in ${first.year} to ${p(last.rate)}% in ${last.year}.`
    : `It was ${p(first.rate)}% in ${first.year}, highest in ${top.year} at ${p(top.rate)}%, and ${p(last.rate)}% in ${last.year}.`;
}
const pct = (part: number, whole: number) => Math.round((part / whole) * 100);
const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;

export function buildHabitBeats(events: PlayEvent[], aggs: PlayAggregate[] = []): HabitBeat[] {
  const hours = hourHistogram(events);
  const hoursTotal = hours.reduce((a, b) => a + b, 0);
  if (hoursTotal === 0) return [];
  const days = weekdayHistogram(events);
  const daysTotal = days.reduce((a, b) => a + b, 0);

  const hp = argMax(hours);
  const hq = argMin(hours);
  const beats: HabitBeat[] = [
    {
      id: 'habit-hours',
      label: 'Hours',
      title: 'When you listen',
      big: hh(hp),
      unit: 'is your busiest hour',
      caption: `${pct(hours[hp], hoursTotal)}% of your minutes fall in the hour from ${hh(hp)}. The quietest hour is ${hh(hq)}, with ${pct(hours[hq], hoursTotal)}%. Times use your browser's time zone.`,
      values: hours,
      labels: hours.map((_, i) => (i % 6 === 0 ? String(i) : '')),
      peak: hp,
    },
  ];
  if (daysTotal > 0) {
    const dp = argMax(days);
    const dq = argMin(days);
    beats.push({
      id: 'habit-days',
      label: 'Days',
      title: 'Which days',
      big: DAYS[dp],
      unit: 'is your busiest day',
      caption: `${pct(days[dp], daysTotal)}% of your minutes are on a ${DAYS[dp]}. The quietest day is ${DAYS[dq]}, with ${pct(days[dq], daysTotal)}%.`,
      values: days,
      labels: DAYS.map((d) => d.slice(0, 3)),
      peak: dp,
    });
  }
  const sk = skipStats(events);
  if (sk.hasEnds) {
    const byYear = forwardByYear(events);
    const gap = skipFlagGapYears(events);
    const gapNote =
      gap.length > 0
        ? ` Spotify's own skipped flag reads zero for ${gap.length > 1 ? `${gap[0]} to ${gap[gap.length - 1]}` : gap[0]} in this file, even though forward-button endings are recorded then, so the flag is not used here.`
        : '';
    const pctOf = (r: number): number => Math.round(r * 100);
    if (byYear.length >= 2) {
      const first = byYear[0];
      const last = byYear[byYear.length - 1];
      const rates = byYear.map((y) => pctOf(y.rate));
      const top = byYear[argMax(rates)];
      const arcText =
        top === first || top === last
          ? `It went from ${pctOf(first.rate)}% in ${first.year} to ${pctOf(last.rate)}% in ${last.year}.`
          : `It was ${pctOf(first.rate)}% in ${first.year}, highest in ${top.year} at ${pctOf(top.rate)}%, and ${pctOf(last.rate)}% in ${last.year}.`;
      beats.push({
        id: 'habit-skips',
        label: 'Forward',
        title: 'When you press forward',
        big: `${pctOf(sk.rate)}%`,
        unit: 'of plays ended on the forward button',
        caption: `A play counts when its recorded ending is the forward button; that includes moving on from a track you had already heard most of. ${arcText} Bars show each year, from 100 plays up.${gapNote}`,
        values: rates,
        labels: byYear.map((y) => y.year.slice(2)),
        peak: argMax(rates),
      });
    } else {
      const plays = new Array<number>(24).fill(0);
      const moved = new Array<number>(24).fill(0);
      for (const e of events) {
        if (e.reasonEnd === null) continue;
        const d = new Date(e.ts);
        if (Number.isNaN(d.getTime())) continue;
        plays[d.getHours()] += 1;
        if (endedOnForward(e)) moved[d.getHours()] += 1;
      }
      // Hours with fewer than 20 plays are left empty: too few to compare.
      const rates = plays.map((n, i) => (n >= 20 ? pctOf(moved[i] / n) : 0));
      beats.push({
        id: 'habit-skips',
        label: 'Forward',
        title: 'When you press forward',
        big: `${pctOf(sk.rate)}%`,
        unit: 'of plays ended on the forward button',
        caption: `A play counts when its recorded ending is the forward button. Bars show that share per hour of day; hours with under 20 plays are left empty.${gapNote}`,
        values: rates,
        labels: rates.map((_, i) => (i % 6 === 0 ? String(i) : '')),
        peak: rates.some((r) => r > 0) ? argMax(rates) : -1,
      });
    }
  }
  const st = startStats(events);
  if (st.hasStarts) {
    const p = (r: number) => Math.round(r * 100);
    const barYears = st.byYear.length >= 2;
    const rates = st.byYear.map((y) => p(y.rate));
    beats.push({
      id: 'habit-picks',
      label: 'Starts',
      title: 'How a track starts',
      big: `${p(st.chosen)}%`,
      unit: 'of plays began with you choosing, pressing play or going back',
      caption:
        `${p(st.carried)}% carried on by themselves from the previous track and ${p(st.forward)}% began after you pressed forward. ${barYears ? `${arcSentence(st.byYear)} Bars show the chosen share for each year, from 100 plays up.` : ''}`.trim(),
      values: barYears ? rates : [],
      labels: barYears ? st.byYear.map((y) => y.year.slice(2)) : [],
      peak: barYears ? argMax(rates) : -1,
    });
  }
  if (aggs.length > 0) {
    const dis = discoveries(aggs);
    const years = [...new Set(dis.byMonth.map((m) => m.month.slice(0, 4)))].sort();
    const perYear = years.map((y) =>
      dis.byMonth.filter((m) => m.month.startsWith(y)).reduce((a, m) => a + m.count, 0),
    );
    beats.push({
      id: 'habit-new',
      label: 'New names',
      title: 'How often you find someone new',
      big: dis.totalArtists.toLocaleString('en-US'),
      unit: 'artists in total',
      caption: `${dis.oneMonthWonders.toLocaleString('en-US')} were heard in a single month only, and ${dis.keepers.toLocaleString('en-US')} in three months or more. Bars show artists first heard in each year; the first and last years may be partly covered.`,
      values: perYear,
      labels: years.map((y) => y.slice(2)),
      peak: argMax(perYear),
    });
  }
  const ses = sessions(events);
  if (ses.count > 0) {
    beats.push({
      id: 'habit-sessions',
      label: 'Sessions',
      title: 'How you sit down with music',
      big: ses.count.toLocaleString('en-US'),
      unit: 'listening sessions',
      caption: `A session ends after 30 minutes without a play. Your longest ran ${ses.longestMin.toLocaleString('en-US')} minutes, across ${ses.activeDays.toLocaleString('en-US')} days with any listening.`,
      values: [],
      labels: [],
      peak: -1,
    });
  }
  const lp = loopStats(events);
  if (lp.runs > 0 && lp.longest) {
    const barYears = lp.byYear.length >= 2;
    const vals = lp.byYear.map((y) => y.runs);
    beats.push({
      id: 'habit-loops',
      label: 'On loop',
      title: 'Songs on loop',
      big: lp.runs.toLocaleString('en-US'),
      unit: 'times one track played 5 or more times in a row',
      caption: `Plays count as a run when each starts within 30 minutes of the last. The longest was ${lp.longest.count} plays of "${lp.longest.track}" by ${lp.longest.artist}, ending in ${lp.longest.endMonth}.${barYears ? ' Bars show runs by the year they began.' : ''}`,
      values: barYears ? vals : [],
      labels: barYears ? lp.byYear.map((y) => y.year.slice(2)) : [],
      peak: barYears ? argMax(vals) : -1,
    });
  }
  const al = albumStats(events);
  if (al.wide > 0) {
    const barYears = al.byYear.length >= 2;
    const vals = al.byYear.map((y) => y.wide);
    const topNames = al.top.map((t) => `"${t.album}" by ${t.artist}`).join(', ');
    beats.push({
      id: 'habit-albums',
      label: 'Albums',
      title: 'Albums you went into',
      big: al.wide.toLocaleString('en-US'),
      unit: 'albums where you played 8 or more different tracks',
      caption: `Of ${al.albums.toLocaleString('en-US')} albums in total. Most played of these: ${topNames}. This counts different tracks played, not whether you heard an album in order.${barYears ? ' Bars show, for each year, albums with 8+ different tracks played that year.' : ''}`,
      values: barYears ? vals : [],
      labels: barYears ? al.byYear.map((y) => y.year.slice(2)) : [],
      peak: barYears ? argMax(vals) : -1,
    });
  }
  const river = buildRiverBeat(aggs);
  if (river) beats.push(river);
  return beats;
}

/** Chapter for names that were played a lot and then went quiet (counted from plays). */
export function buildReturnedBeat(aggs: PlayAggregate[]): HabitBeat | null {
  const list = rediscoveries(aggs);
  if (list.length === 0) return null;
  const top = list.slice(0, 3).map((r) => `${r.artist} (peak ${r.peakYear})`);
  return {
    id: 'habit-returned',
    kind: 'returned',
    label: 'Left behind',
    title: 'Names you left behind',
    big: String(list.length),
    unit: 'artists gone quiet for a year or more',
    caption: `Each had at least 120 minutes and no plays for 12 months or more. The biggest: ${top.join(', ')}. This is arithmetic on plays, not a statement about why.`,
    values: [],
    labels: [],
    peak: -1,
  };
}

/** Chapter for one artist, opened from the library. Minutes per year, from plays. */
export function buildArtistBeat(aggs: PlayAggregate[], artist: string): HabitBeat | null {
  const f = artistFacts(aggs, artist);
  if (!f) return null;
  const years = [...new Set(f.monthly.map((m) => m.month.slice(0, 4)))].sort();
  const values = years.map((y) =>
    f.monthly.filter((m) => m.month.startsWith(y)).reduce((a, m) => a + m.minutes, 0),
  );
  return {
    id: `artist-${artist}`,
    kind: 'artist',
    artist,
    label: artist,
    title: artist,
    big: String(Math.round(f.minutes / 60)),
    unit: `h in total, ${f.firstMonth} to ${f.lastMonth}`,
    caption: `Biggest year ${f.peakYear}, ${f.peakYearMinutes.toLocaleString('en-US')} minutes. Bars show minutes per year; the first and last years may be partly covered.`,
    values,
    labels: years.map((y) => y.slice(2)),
    peak: argMax(values),
  };
}

export const ORIGINS_BEAT: HabitBeat = {
  id: 'step-origins',
  kind: 'origins',
  label: 'Origins',
  title: 'Where your artists come from',
  big: 'Optional',
  unit: 'a lookup that you choose to start',
  caption: '',
  values: [],
  labels: [],
  peak: -1,
};

export const SHARE_BEAT: HabitBeat = {
  id: 'step-share',
  kind: 'share',
  label: 'Your card',
  title: 'Your card',
  big: 'Share',
  unit: 'you choose what goes on it',
  caption:
    'The card starts from the chapter you were on. You pick what is shown before anything leaves this device.',
  values: [],
  labels: [],
  peak: -1,
};

function smooth3(v: number[]): number[] {
  return v.map((_, i) => {
    const a = v[Math.max(0, i - 1)];
    const b = v[i];
    const c = v[Math.min(v.length - 1, i + 1)];
    return (a + b * 2 + c) / 4;
  });
}

/**
 * Chapter: the top artists' months as one flowing river, oldest at the top. Band width is
 * minutes per month (smoothed over three months); the pale halo behind is everything else.
 */
export function buildRiverBeat(aggs: PlayAggregate[]): HabitBeat | null {
  if (aggs.length === 0) return null;
  const months = [...new Set(aggs.map((a) => a.month))].sort();
  if (months.length < 12) return null;
  const idx = new Map(months.map((m, i) => [m, i]));
  const per = new Map<string, number[]>();
  const all = new Array<number>(months.length).fill(0);
  for (const a of aggs) {
    const i = idx.get(a.month)!;
    all[i] += a.ms / 60000;
    let row = per.get(a.artist);
    if (!row) {
      row = new Array<number>(months.length).fill(0);
      per.set(a.artist, row);
    }
    row[i] += a.ms / 60000;
  }
  const all2 = [...per.entries()].map(([artist, minutes]) => ({
    artist,
    minutes,
    total: minutes.reduce((t, v) => t + v, 0),
  }));
  const years = [...new Set(months.map((m) => m.slice(0, 4)))];
  const chosen = new Map<string, boolean>();
  for (const yr of years) {
    const ranked = all2
      .map((r) => ({
        r,
        v: r.minutes.reduce((t, x, i) => (months[i].startsWith(yr) ? t + x : t), 0),
      }))
      .sort((x, y) => y.v - x.v);
    chosen.set(ranked[0].r.artist, true);
    if (ranked[1] && !chosen.has(ranked[1].r.artist)) chosen.set(ranked[1].r.artist, false);
  }
  const ranked = all2.filter((r) => chosen.has(r.artist));
  const leaders = ranked.filter((r) => chosen.get(r.artist)).length;
  const grand = all.reduce((t, v) => t + v, 0);
  if (ranked.length < 3 || grand <= 0) return null;
  const mid = (b: { minutes: number[] }) => {
    const t = b.minutes.reduce((acc, v) => acc + v, 0);
    return b.minutes.reduce((acc, v, i) => acc + v * i, 0) / t;
  };
  ranked.sort((x, y) => mid(x) - mid(y));
  const lastMonth = months[months.length - 1];
  const partialNote = lastMonth.endsWith('-12')
    ? ''
    : ` ${lastMonth.slice(0, 4)} is a partial year that ends in ${lastMonth}.`;
  const share = ranked.reduce((t, r) => t + r.total, 0) / grand;
  return {
    id: 'habit-river',
    kind: 'river',
    label: 'Your river',
    title: 'Your listening, one river',
    big: `${leaders} artists`,
    unit: `took turns as your most played, year after year`,
    caption: `The river follows each year's top two artists (${ranked.length} in all). Time runs from the top (${months[0]}) to now (${months[months.length - 1]}). Width is minutes per month, smoothed over three months. Together they are ${Math.round(share * 100)}% of all your minutes; everyone else is not drawn.${partialNote}`,
    values: [],
    labels: [],
    peak: -1,
    river: {
      months,
      bands: ranked.map((b) => ({ artist: b.artist, minutes: smooth3(b.minutes), total: b.total })),
      leaders: ranked.filter((r) => chosen.get(r.artist)).map((r) => r.artist),
    },
  };
}
