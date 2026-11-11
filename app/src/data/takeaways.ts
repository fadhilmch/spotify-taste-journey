import { exploration, rediscoveries } from './rediscovery';
import { artistEras, fmtMinutes, genreMix, monthLabel, topArtists, topTracks, totalMinutes } from './stats';
import type { ArtistGenre, MonthBucket, PlayAggregate, View } from './types';

/**
 * One finding per page and one question that leads to the next page.
 * Everything is arithmetic on plays. Nothing here says why listening changed.
 */

export interface Takeaway {
  /** The finding, in a sentence. Null when the data cannot support one. */
  lead: string | null;
}

export interface NextStep {
  to: View;
  /** The question this page leaves open. */
  question: string;
  /** Label of the button that goes to the next page. */
  action: string;
}

/** The order of the story: each page ends by pointing at the next. */
export const NEXT_STEP: Partial<Record<View, NextStep>> = {
  flow: {
    to: 'rediscover',
    question: 'That was the whole arc. Which artists did you leave behind, and which ones came back?',
    action: 'Rediscover',
  },
  rediscover: {
    to: 'journey',
    question: 'When did those shifts happen? Follow your listening month by month.',
    action: 'Month by month',
  },
  journey: {
    to: 'story',
    question: 'Those are the months. Now the habits behind them: how you start, loop and finish plays.',
    action: 'Habits',
  },
  story: {
    to: 'map',
    question: 'You know how you listen. Where do the artists you play come from?',
    action: 'World',
  },
  map: {
    to: 'genres',
    question: 'From places to sounds. How does your mix of genres move over time?',
    action: 'Spectrum',
  },
  genres: {
    to: 'artists',
    question: 'Behind every group are names. Who carries most of your listening?',
    action: 'Artists',
  },
  artists: {
    to: 'tracks',
    question: 'Artists are the headline. Which single tracks do you keep coming back to?',
    action: 'Tracks',
  },
  tracks: {
    to: 'share',
    question: 'You have the whole story now. Turn a piece of it into a card.',
    action: 'Share',
  },
};

const pct = (x: number) => `${Math.round(x * 100)}%`;
const plural = (n: number, one: string, many: string) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

function concentration(aggs: PlayAggregate[], n: number): { share: number; count: number } | null {
  const total = totalMinutes(aggs);
  if (total <= 0) return null;
  const top = topArtists(aggs, n);
  const sum = top.reduce((s, t) => s + t.minutes, 0);
  return { share: sum / total, count: top.length };
}

export function takeaway(
  view: View,
  aggs: PlayAggregate[],
  months: MonthBucket[],
  genres: Record<string, ArtistGenre | undefined> = {},
): Takeaway {
  if (aggs.length === 0) return { lead: null };
  switch (view) {
    case 'rediscover': {
      const quiet = rediscoveries(aggs);
      const ex = exploration(aggs);
      const parts: string[] = [];
      if (quiet.length > 0) {
        const q = quiet[0];
        parts.push(
          `${plural(quiet.length, 'artist', 'artists')} you played for hours went quiet for a year or more. ${q.artist} is the biggest, with the most listening in ${q.peakYear}.`,
        );
      }
      if (ex.length > 1 && Math.max(...ex.map((e) => e.newShare)) >= 0.05) {
        const hi = ex.reduce((a, b) => (b.newShare > a.newShare ? b : a));
        parts.push(
          `${hi.year} was the most exploratory year: ${pct(hi.newShare)} of its minutes went to artists new that year.`,
        );
      }
      return { lead: parts.length ? parts.join(' ') : null };
    }
    case 'journey': {
      if (months.length === 0) return { lead: null };
      const peak = months.reduce((a, b) => (b.minutes > a.minutes ? b : a));
      const lead = topArtists(
        aggs.filter((a) => a.month === peak.key),
        1,
      )[0];
      return {
        lead: `${monthLabel(peak.key).label} was your biggest month, ${fmtMinutes(peak.minutes)}${lead ? `, led by ${lead.name}` : ''}.`,
      };
    }
    case 'story': {
      if (months.length === 0) return { lead: null };
      const eras = artistEras(months, aggs);
      if (eras.length === 0) return { lead: null };
      const span = (e: { from: string; to: string }) => {
        const [fy, fm] = e.from.split('-').map(Number);
        const [ty, tm] = e.to.split('-').map(Number);
        return (ty - fy) * 12 + (tm - fm) + 1;
      };
      const longest = eras.reduce((a, b) => (span(b) > span(a) ? b : a));
      const n = span(longest);
      return {
        lead:
          n > 1
            ? `${longest.artist} held the top spot for ${n} months in a row, your longest stretch.`
            : `No artist stayed on top for more than one month in a row.`,
      };
    }
    case 'artists': {
      const c = concentration(aggs, 10);
      const top = topArtists(aggs, 1)[0];
      if (!c || !top) return { lead: null };
      if (c.count >= 10) {
        return {
          lead: `Your top ${c.count} artists make up ${pct(c.share)} of the minutes in this range. ${top.name} is first with ${fmtMinutes(top.minutes)}.`,
        };
      }
      const total = totalMinutes(aggs);
      return {
        lead: `${top.name} is first with ${fmtMinutes(top.minutes)}, ${pct(top.minutes / total)} of the minutes in this range.`,
      };
    }
    case 'genres': {
      const mix = genreMix(aggs, genres);
      const placed = mix.total - mix.uncategorized;
      if (mix.slices.length === 0 || mix.total <= 0 || placed / mix.total < 0.5) return { lead: null };
      const top = mix.slices[0];
      return {
        lead: `${top.group} is your biggest group, ${pct(top.minutes / placed)} of the minutes with a genre. ${pct(mix.uncategorized / mix.total)} of listening has no genre yet.`,
      };
    }
    case 'tracks': {
      const total = totalMinutes(aggs);
      if (total <= 0) return { lead: null };
      const all = topTracks(aggs, Number.MAX_SAFE_INTEGER);
      let run = 0;
      let k = 0;
      for (const t of all) {
        run += t.minutes;
        k++;
        if (run >= total / 2) break;
      }
      const t1 = all[0];
      return {
        lead: `Half of your listening in this range sits in ${plural(k, 'track', 'tracks')} out of ${all.length.toLocaleString()}. The most played is ${t1.name} by ${t1.artist}.`,
      };
    }
    default:
      return { lead: null };
  }
}
