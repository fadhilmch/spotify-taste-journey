import { discoveries, hourHistogram, sessions, skipStats, weekdayHistogram } from './stats';
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
  if (sk.hasFlags) {
    const flagged = events.filter((e) => e.skipped !== null);
    const plays = new Array<number>(24).fill(0);
    const skips = new Array<number>(24).fill(0);
    for (const e of flagged) {
      const d = new Date(e.ts);
      if (Number.isNaN(d.getTime())) continue;
      plays[d.getHours()] += 1;
      if (e.skipped) skips[d.getHours()] += 1;
    }
    // Hours with fewer than 20 flagged plays are left empty: too few to compare.
    const rates = plays.map((n, i) => (n >= 20 ? Math.round((skips[i] / n) * 100) : 0));
    beats.push({
      id: 'habit-skips',
      label: 'Skips',
      title: 'What you skip',
      big: `${Math.round(sk.rate * 100)}%`,
      unit: 'of plays were skipped',
      caption:
        "This uses Spotify's own skipped flag. Bars show the skip share per hour of day; hours with under 20 flagged plays are left empty.",
      values: rates,
      labels: rates.map((_, i) => (i % 6 === 0 ? String(i) : '')),
      peak: rates.some((r) => r > 0) ? argMax(rates) : -1,
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
  return beats;
}
