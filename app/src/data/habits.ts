import {
  discoveries,
  endedOnForward,
  forwardByYear,
  hourHistogram,
  sessions,
  skipFlagGapYears,
  skipStats,
  weekdayHistogram,
} from './stats';
import { artistFacts } from './artistFacts';
import { rediscoveries } from './rediscovery';
import type { PlayAggregate, PlayEvent } from './types';

/**
 * Listening habits as story chapters. Counted from play timestamps only,
 * in the time zone of the browser that reads the file.
 */

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
  kind?: 'returned' | 'artist' | 'origins' | 'share';
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
