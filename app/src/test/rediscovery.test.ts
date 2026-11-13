import { describe, expect, it } from 'vitest';
import { concentration, exploration, rediscoveries, yearEras } from '../data/rediscovery';
import type { PlayAggregate } from '../data/types';

const mk = (month: string, artist: string, minutes: number): PlayAggregate => ({
  month,
  artist,
  track: 't',
  ms: minutes * 60_000,
});

const aggs = [
  mk('2019-03', 'Old', 300),
  mk('2019-04', 'Old', 100),
  mk('2020-01', 'Steady', 200),
  mk('2021-01', 'Steady', 200),
  mk('2021-02', 'Brief', 10),
  mk('2022-06', 'Steady', 50),
  mk('2022-06', 'New', 80),
];

describe('rediscoveries', () => {
  it('lists heavy artists that went quiet, with the peak year and months since', () => {
    const r = rediscoveries(aggs, 12, 120);
    expect(r.map((x) => x.artist)).toEqual(['Old']);
    expect(r[0]).toMatchObject({ minutes: 400, peakYear: '2019', lastMonth: '2019-04', monthsSince: 38 });
  });
  it('ignores light listening and returns nothing for no data', () => {
    expect(rediscoveries(aggs, 12, 1000)).toEqual([]);
    expect(rediscoveries([])).toEqual([]);
  });
});

describe('yearEras', () => {
  it('counts carry-over and fresh names against earlier years', () => {
    const e = yearEras(aggs, 2);
    expect(e.map((x) => x.year)).toEqual(['2019', '2020', '2021', '2022']);
    expect(e[2]).toMatchObject({ carried: 1 });
    expect(e[3].fresh).toBe(1);
  });
});

describe('exploration', () => {
  it('skips the first year and measures minutes on newly heard artists', () => {
    const x = exploration(aggs);
    expect(x[0].year).toBe('2020');
    expect(x[0].newShare).toBe(1);
    expect(x.find((y) => y.year === '2022')).toMatchObject({ newArtists: 1 });
    expect(x.find((y) => y.year === '2022')!.newShare).toBeCloseTo(80 / 130);
  });
});

describe('concentration', () => {
  const c = (month: string, artist: string, minutes: number) => mk(month, artist, minutes);
  it('counts the fewest artists that reach half of a year, over every artist', () => {
    const data = [c('2020-01', 'A', 50), c('2020-02', 'B', 30), c('2020-03', 'C', 20)];
    const y = concentration(data)[0];
    expect(y).toMatchObject({ year: '2020', artists: 3, half: 1 });
    expect(y.shares).toEqual([0.5, 0.3, 0.2]);
  });
  it('caps drawn shares but not the counts, and flags partial years', () => {
    const data = Array.from({ length: 10 }, (_, i) => c('2021-01', `X${i}`, 10));
    const y = concentration(data, 4)[0];
    expect(y.shares).toHaveLength(4);
    expect(y).toMatchObject({ artists: 10, half: 5, partial: true });
  });
  it('merges the same artist across months and skips empty input', () => {
    expect(concentration([])).toEqual([]);
    const y = concentration([c('2022-01', 'A', 10), c('2022-02', 'A', 10), c('2022-03', 'B', 5)])[0];
    expect(y).toMatchObject({ artists: 2, half: 1 });
  });
  it('marks a year with all twelve months as not partial', () => {
    const data = Array.from({ length: 12 }, (_, i) => c(`2023-${String(i + 1).padStart(2, '0')}`, 'A', 1));
    expect(concentration(data)[0].partial).toBe(false);
  });
});

describe('narrow and wide chapter', () => {
  const month = (y: number, m: number) => `${y}-${String(m).padStart(2, '0')}`;
  const year = (y: number, shape: number[]) =>
    Array.from({ length: 12 }, (_, m) => shape.map((v, i) => mk(month(y, m + 1), `A${y}-${i}`, v))).flat();
  it('compares only full years and mentions a partial one without ranking it', async () => {
    const { buildNarrowWideBeat } = await import('../data/habits');
    const data = [
      ...year(2020, [90, 5, 5]), // narrow: 1 artist makes half
      ...year(2021, [10, 10, 10, 10, 10, 10]), // wide: 3 artists make half
      mk('2022-01', 'P1', 100), // partial year with 1 artist: must not be ranked
    ];
    const b = buildNarrowWideBeat(data)!;
    expect(b.nw!.narrow.year).toBe('2020');
    expect(b.nw!.wide.year).toBe('2021');
    expect(b.nw!.partial?.year).toBe('2022');
    expect(b.big).toBe('1 vs 3');
    expect(b.caption).toMatch(/2022 is not ranked/);
  });
  it('returns nothing without two full years or without a difference', async () => {
    const { buildNarrowWideBeat } = await import('../data/habits');
    expect(buildNarrowWideBeat(year(2020, [50, 50]))).toBeNull();
    expect(buildNarrowWideBeat([...year(2020, [50, 50]), ...year(2021, [50, 50])])).toBeNull();
  });
});
