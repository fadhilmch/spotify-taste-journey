import { describe, expect, it } from 'vitest';
import { buildRiverBeat } from '../data/habits';
import type { PlayAggregate } from '../data/types';

const mk = (month: string, artist: string, min: number): PlayAggregate => ({
  month,
  artist,
  track: 't',
  ms: min * 60000,
});
const months = (y: number, to = 12) =>
  Array.from({ length: to }, (_, i) => `${y}-${String(i + 1).padStart(2, '0')}`);

describe('river chapter', () => {
  it("follows each year's top two artists and counts the number ones", () => {
    const data = [
      ...months(2020).flatMap((m) => [mk(m, 'A', 50), mk(m, 'B', 20), mk(m, 'X', 1)]),
      ...months(2021).flatMap((m) => [mk(m, 'C', 50), mk(m, 'B', 30), mk(m, 'X', 1)]),
    ];
    const b = buildRiverBeat(data)!;
    expect(b.river!.bands.map((x) => x.artist).sort()).toEqual(['A', 'B', 'C']);
    expect(b.river!.leaders.sort()).toEqual(['A', 'C']);
    expect(b.big).toBe('2 artists');
    expect(b.river!.bands[0].minutes).toHaveLength(24);
  });
  it('mentions a partial last year and needs a year of data', () => {
    const data = [
      ...months(2020).flatMap((m) => [mk(m, 'A', 50), mk(m, 'B', 20), mk(m, 'C', 10)]),
      ...months(2021, 3).flatMap((m) => [mk(m, 'D', 50), mk(m, 'B', 20), mk(m, 'C', 10)]),
    ];
    expect(buildRiverBeat(data)!.caption).toMatch(/2021 is a partial year/);
    expect(buildRiverBeat(data.slice(0, 5))).toBeNull();
    expect(buildRiverBeat([])).toBeNull();
  });
});
