import { hourHistogram, weekdayHistogram } from './stats';
import type { PlayEvent } from './types';

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
  /** Index of the busiest bar. */
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

export function buildHabitBeats(events: PlayEvent[]): HabitBeat[] {
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
  return beats;
}
