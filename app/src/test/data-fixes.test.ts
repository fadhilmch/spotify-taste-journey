import { describe, expect, it } from 'vitest';
import { buildRiverBeat, buildCountryMapBeat } from '../data/habits';
import { artistEras, buildMonths, chapters, fmtMinutes, topTracks } from '../data/stats';
import type { Chapter, Era, MonthBucket, PlayAggregate } from '../data/types';

describe('fmtMinutes', () => {
  it('pins outputs', () => {
    const out = [0, 59.6, 999, 1000, 12345, 60000, 123456].map(fmtMinutes);
    expect(out).toEqual(['0 min', '60 min', '999 min', '1.0k min', '12.3k min', '1.0k hr', '2.1k hr']);
  });
});

// Reference copies of the original (per-month / per-era filter) implementations.
function topArtistsRef(aggs: PlayAggregate[]) {
  const by = new Map<string, number>();
  for (const a of aggs) by.set(a.artist, (by.get(a.artist) ?? 0) + a.ms);
  return [...by.entries()]
    .map(([name, ms]) => ({ name, minutes: Math.round(ms / 60000) }))
    .sort((a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name))[0];
}
function artistErasRef(months: MonthBucket[], aggs: PlayAggregate[]): Era[] {
  const eras: Era[] = [];
  let cur: Era | null = null;
  for (const mo of months) {
    const top = topArtistsRef(aggs.filter((a) => a.month === mo.key));
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
function chaptersRef(months: MonthBucket[], aggs: PlayAggregate[]): Chapter[] {
  const eras = artistErasRef(months, aggs);
  const monthMin = new Map(months.map((m) => [m.key, m.minutes]));
  const seen = new Set<string>();
  const lastKey = months[months.length - 1]?.key;
  return eras.map((e, i) => {
    const windowMin = months
      .filter((m) => m.key >= e.from && m.key <= e.to)
      .reduce((s, m) => s + (monthMin.get(m.key) ?? 0), 0);
    const share = windowMin > 0 ? e.minutes / windowMin : 0;
    const topTrack =
      topTracks(
        aggs.filter((a) => a.artist === e.artist && a.month >= e.from && a.month <= e.to),
        1,
      )[0]?.name ?? null;
    let kind: Chapter['kind'];
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

function fixture(n: number, nMonths: number, nArtists: number): PlayAggregate[] {
  let seed = 12345;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const out: PlayAggregate[] = [];
  for (let i = 0; i < n; i += 1) {
    const m = Math.floor(rnd() * nMonths);
    // leave a gap month to exercise empty months
    const mm = m === 7 ? 8 : m;
    out.push({
      month: `${2022 + Math.floor(mm / 12)}-${String((mm % 12) + 1).padStart(2, '0')}`,
      artist: `Artist ${(Math.floor(rnd() * rnd() * nArtists) + 5 * Math.floor(mm / 12)) % nArtists}`,
      track: `Track ${Math.floor(rnd() * 20)}`,
      ms: Math.floor(rnd() * 600000) + 1000,
    });
  }
  return out;
}

describe('single-pass artistEras / chapters', () => {
  const data = fixture(2000, 30, 40);
  const months = buildMonths(data);
  it('artistEras matches the reference implementation', () => {
    const got = artistEras(months, data);
    expect(got.length).toBeGreaterThan(3);
    expect(got).toEqual(artistErasRef(months, data));
  });
  it('chapters matches the reference implementation', () => {
    expect(chapters(months, data)).toEqual(chaptersRef(months, data));
  });
  it('handles empty input', () => {
    expect(artistEras([], [])).toEqual([]);
    expect(chapters([], [])).toEqual([]);
  });
});

describe('buildRiverBeat linear yearly ranking', () => {
  it('picks the same leaders and runners-up as a naive per-year ranking', () => {
    const data = fixture(2000, 30, 40);
    const b = buildRiverBeat(data)!;
    const months = [...new Set(data.map((a) => a.month))].sort();
    const per = new Map<string, number[]>();
    for (const a of data) {
      const row = per.get(a.artist) ?? new Array<number>(months.length).fill(0);
      row[months.indexOf(a.month)] += a.ms / 60000;
      per.set(a.artist, row);
    }
    const all = [...per.entries()];
    const chosen = new Map<string, boolean>();
    for (const yr of [...new Set(months.map((m) => m.slice(0, 4)))]) {
      const ranked = all
        .map(([artist, row]) => ({
          artist,
          v: row.reduce((t, x, i) => (months[i].startsWith(yr) ? t + x : t), 0),
        }))
        .sort((x, y) => y.v - x.v);
      chosen.set(ranked[0].artist, true);
      if (ranked[1] && !chosen.has(ranked[1].artist)) chosen.set(ranked[1].artist, false);
    }
    expect(b.river!.bands.map((x) => x.artist).sort()).toEqual([...chosen.keys()].sort());
    expect(b.river!.leaders.sort()).toEqual(
      [...chosen]
        .filter(([, l]) => l)
        .map(([a]) => a)
        .sort(),
    );
    expect(b.big).toBe(`${b.river!.leaders.length} artists`);
    expect(b.caption).toContain(
      `${b.river!.bands.length} bands, ${b.river!.leaders.length} of them a year's most played`,
    );
  });
});

describe('buildCountryMapBeat source label', () => {
  const MIN = 60000;
  const aggs: PlayAggregate[] = [
    { month: '2026-01', artist: 'Alpha', track: 't', ms: 50 * MIN },
    { month: '2026-12', artist: 'Beta', track: 't', ms: 30 * MIN },
  ];
  const origins = { alpha: { country: 'US', area: null }, beta: { country: 'ID', area: null } };
  it('names the source', () => {
    expect(buildCountryMapBeat(aggs, origins)!.caption).toContain('from the MusicBrainz file you added');
    expect(buildCountryMapBeat(aggs, origins, 'lookup')!.caption).toContain(
      'from the MusicBrainz lookup you ran',
    );
    expect(buildCountryMapBeat(aggs, origins, 'demo')!.caption).toContain('from invented demo origins');
  });
});
