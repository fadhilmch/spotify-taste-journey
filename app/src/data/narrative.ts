import { MONTH_NAMES } from './stats';
import type { PlayAggregate } from './types';

/**
 * Story flow: a handful of beats computed from the listening history.
 * Every number is arithmetic on the plays; nothing explains WHY listening
 * changed. Years are compared per month whenever a year is only partly
 * covered by the history.
 */

export type BeatKind = 'open' | 'rise' | 'lead' | 'return' | 'quiet' | 'constants';

export interface NarrativeYear {
  year: string;
  hours: number;
  /** Months of the year that the history covers (12 for a full year). */
  span: number;
  partial: boolean;
  hoursPerMonth: number;
}

export interface StoryBeat {
  id: string;
  kind: BeatKind;
  label: string;
  title: string;
  /** Headline figure shown large, with its unit. */
  big: number;
  unit: string;
  caption: string;
  /** Index range into `years` highlighted on the chart. */
  from: number;
  to: number;
  /** Up to 3 artists whose yearly hours are drawn as lines. */
  artists: string[];
}

export interface Narrative {
  years: NarrativeYear[];
  /** Hours per year for every featured artist, aligned with `years`. */
  series: Record<string, number[]>;
  beats: StoryBeat[];
  totalHours: number;
  firstLabel: string;
  lastLabel: string;
}

const HOUR = 3_600_000;

function monthName(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

function fmtOne(n: number): string {
  return n < 10 ? n.toFixed(1) : fmt(n);
}

export function buildNarrative(aggs: PlayAggregate[]): Narrative | null {
  if (aggs.length === 0) return null;
  const monthKeys = [...new Set(aggs.map((a) => a.month))].sort();
  const firstKey = monthKeys[0];
  const lastKey = monthKeys[monthKeys.length - 1];
  const firstYear = Number(firstKey.slice(0, 4));
  const lastYear = Number(lastKey.slice(0, 4));
  const firstMonth = Number(firstKey.slice(5, 7));
  const lastMonth = Number(lastKey.slice(5, 7));

  const yearList: string[] = [];
  for (let y = firstYear; y <= lastYear; y += 1) yearList.push(String(y));

  const perYearMs = new Map<string, number>();
  const perYearArtist = new Map<string, Map<string, number>>();
  const firstHeard = new Map<string, string>();
  for (const a of aggs) {
    const y = a.month.slice(0, 4);
    perYearMs.set(y, (perYearMs.get(y) ?? 0) + a.ms);
    let m = perYearArtist.get(y);
    if (!m) perYearArtist.set(y, (m = new Map()));
    m.set(a.artist, (m.get(a.artist) ?? 0) + a.ms);
    const f = firstHeard.get(a.artist);
    if (f === undefined || a.month < f) firstHeard.set(a.artist, a.month);
  }

  const years: NarrativeYear[] = yearList.map((y) => {
    const yn = Number(y);
    const startM = yn === firstYear ? firstMonth : 1;
    const endM = yn === lastYear ? lastMonth : 12;
    const span = endM - startM + 1;
    const hours = (perYearMs.get(y) ?? 0) / HOUR;
    return { year: y, hours, span, partial: span < 12, hoursPerMonth: hours / span };
  });

  const yearHours = (y: string, artist: string) => (perYearArtist.get(y)?.get(artist) ?? 0) / HOUR;
  const leaderOf = (y: string): string => {
    let best = '';
    let bestMs = -1;
    for (const [a, ms] of perYearArtist.get(y) ?? []) {
      if (ms > bestMs) {
        best = a;
        bestMs = ms;
      }
    }
    return best;
  };
  const topFive = (y: string): string[] =>
    [...(perYearArtist.get(y) ?? [])]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([a]) => a);

  const leaders = yearList.map(leaderOf);
  const totalHours = years.reduce((s, y) => s + y.hours, 0);

  // Quietest full year: lowest hours per month, and nobody stands out.
  const fullYears = years.filter((y) => !y.partial);
  let quietYear: string | null = null;
  if (fullYears.length >= 3) {
    const q = [...fullYears].sort((a, b) => a.hoursPerMonth - b.hoursPerMonth)[0];
    const sorted = fullYears.map((y) => y.hoursPerMonth).sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const lead = yearHours(q.year, leaderOf(q.year));
    if (q.hoursPerMonth <= median * 0.75 && lead / q.hours < 0.05) quietYear = q.year;
  }

  const beats: StoryBeat[] = [];

  const partialFirst = years[0].partial;
  const partialLast = years[years.length - 1].partial;
  const partialBits: string[] = [];
  if (partialFirst) partialBits.push(`${years[0].year} starts in ${monthName(firstKey)}`);
  if (partialLast) partialBits.push(`${years[years.length - 1].year} ends in ${monthName(lastKey)}`);
  beats.push({
    id: 'open',
    kind: 'open',
    label: 'Start',
    title: `${monthName(firstKey)} to ${monthName(lastKey)}`,
    big: Math.round(totalHours),
    unit: 'hours listened',
    caption:
      `${fmt(totalHours)} hours across ${years.length} years of history.` +
      (partialBits.length > 0
        ? ` ${partialBits.join(' and ')}, so those years are compared per month, never as full-year totals.`
        : '') +
      ' The bars show hours per month for each year. Everything that follows is counted from your plays.',
    from: 0,
    to: years.length - 1,
    artists: [],
  });

  // One chapter per run of years led by the same artist.
  interface Run {
    artist: string;
    from: number;
    to: number;
  }
  const runs: Run[] = [];
  leaders.forEach((a, i) => {
    const last = runs[runs.length - 1];
    if (last && last.artist === a) last.to = i;
    else runs.push({ artist: a, from: i, to: i });
  });

  runs.forEach((run, ri) => {
    const first = years[run.from];
    const lastY = years[run.to];
    if (run.from === 0 && run.to === 0 && first.partial) return; // the opening covers it
    const prev = ri > 0 ? runs[ri - 1] : null;
    const ledBefore = runs.slice(0, ri).some((r) => r.artist === run.artist);
    const heardKey = firstHeard.get(run.artist) ?? '';
    const heardYear = Number(heardKey.slice(0, 4));
    const isNew = !ledBefore && heardYear === Number(first.year);
    const recentlyHeard = !ledBefore && heardYear >= Number(first.year) - 1;
    const hours = yearList.slice(run.from, run.to + 1).reduce((s, y) => s + yearHours(y, run.artist), 0);
    const share = hours / years.slice(run.from, run.to + 1).reduce((s, y) => s + y.hours, 0);
    const span =
      run.from === run.to
        ? first.year
        : `${first.year}${run.to - run.from === 1 ? ' and ' : ' to '}${lastY.year}`;
    const quiet = run.from === run.to && quietYear === first.year;

    let kind: BeatKind = ledBefore ? 'return' : isNew ? 'rise' : 'lead';
    let title: string;
    const bits: string[] = [];
    if (quiet) {
      kind = 'quiet';
      title = `${first.year}: the quietest stretch`;
      bits.push(
        `${fmt(first.hours)} hours, the lowest of your full years at ${fmtOne(first.hoursPerMonth)} h a month.`,
        `No artist stood out: the leader, ${run.artist}, had ${fmtOne(hours)} h.`,
      );
    } else {
      title =
        kind === 'rise'
          ? `${span}: a new name takes the lead`
          : kind === 'return'
            ? `${span}: ${run.artist} is back on top`
            : `${span}: ${run.artist} leads`;
      if (recentlyHeard) bits.push(`${run.artist} was first played in ${monthName(heardKey)}.`);
      bits.push(
        `${run.artist} led with ${fmtOne(hours)} h, ${Math.round(share * 100)}% of ${
          run.from === run.to ? 'the year' : 'those years'
        }.`,
      );
      if (prev && !quiet) {
        const prevPeak = Math.max(
          ...yearList.slice(prev.from, prev.to + 1).map((y) => yearHours(y, prev.artist)),
        );
        const prevNow = yearHours(lastY.year, prev.artist);
        if (kind !== 'return' || prevPeak > 0)
          bits.push(
            `${prev.artist}, who led before, went from ${fmtOne(prevPeak)} h to ${fmtOne(prevNow)} h${lastY.partial ? ' so far' : ''}.`,
          );
      }
      if (ledBefore) {
        const earlier = runs
          .slice(0, ri)
          .filter((r) => r.artist === run.artist)
          .pop()!;
        const gap = run.from - earlier.to - 1;
        const dip = yearHours(years[run.from - 1].year, run.artist);
        bits.push(
          `It had ${fmtOne(dip)} h in ${years[run.from - 1].year}${gap > 1 ? ` and was away from the top for ${gap} years` : ''}.`,
        );
      }
    }
    const partialYears = years.slice(run.from, run.to + 1).filter((y) => y.partial);
    for (const py of partialYears) {
      const prior = years[years.indexOf(py) - 1];
      bits.push(
        `${py.year} covers only ${py.span} months, so compare by month: ${fmtOne(py.hoursPerMonth)} h a month` +
          (prior && !prior.partial ? ` against ${fmtOne(prior.hoursPerMonth)} in ${prior.year}.` : '.'),
      );
    }
    const featured = [run.artist];
    if (prev && prev.artist !== run.artist) featured.push(prev.artist);
    beats.push({
      id: `run-${first.year}-${run.artist}`,
      kind,
      label: run.from === run.to ? first.year : `${first.year.slice(2)}-${lastY.year.slice(2)}`,
      title,
      big: Math.round(quiet ? first.hoursPerMonth : hours),
      unit: quiet ? 'h per month' : `h by ${run.artist}`,
      caption: bits.join(' '),
      from: run.from,
      to: run.to,
      artists: quiet ? [] : featured,
    });
  });

  // Constants: artists that kept reaching your top five.
  const counts = new Map<string, number>();
  for (const y of yearList) for (const a of topFive(y)) counts.set(a, (counts.get(a) ?? 0) + 1);
  const steady = [...counts]
    .filter(([, c]) => c >= 3)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (steady.length > 0) {
    const top = steady.slice(0, 3);
    beats.push({
      id: 'constants',
      kind: 'constants',
      label: 'Constants',
      title: 'Names that kept coming back',
      big: top[0][1],
      unit: `years in the top five for ${top[0][0]}`,
      caption: `${top.map(([a, c]) => `${a} reached your top five in ${c} of ${years.length} years`).join('; ')}.`,
      from: 0,
      to: years.length - 1,
      artists: top.map(([a]) => a),
    });
  }

  const series: Record<string, number[]> = {};
  for (const b of beats)
    for (const a of b.artists)
      if (!series[a]) series[a] = yearList.map((y) => Math.round(yearHours(y, a) * 10) / 10);

  return {
    years,
    series,
    beats,
    totalHours,
    firstLabel: monthName(firstKey),
    lastLabel: monthName(lastKey),
  };
}
