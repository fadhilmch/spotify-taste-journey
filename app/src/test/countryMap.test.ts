import { describe, expect, it } from 'vitest';
import { buildCountryMapBeat } from '../data/habits';
import type { ArtistOrigin, PlayAggregate } from '../data/types';

const MIN = 60000;
const agg = (artist: string, minutes: number, month = '2025-01'): PlayAggregate => ({
  month,
  artist,
  track: 't',
  ms: minutes * MIN,
});
const origins: Record<string, ArtistOrigin> = {
  alpha: { country: 'US', area: null },
  beta: { country: 'ID', area: null },
  gamma: { country: null, area: null },
};

describe('buildCountryMapBeat', () => {
  it('shares add up with the unplaced share and are ranked by minutes', () => {
    const b = buildCountryMapBeat(
      [agg('Alpha', 50), agg('Beta', 30), agg('Gamma', 10), agg('Delta', 10)],
      origins,
    )!;
    expect(b.map!.countries.map((c) => c.name)).toEqual(['United States of America', 'Indonesia']);
    expect(b.map!.countries.map((c) => c.share)).toEqual([50, 30]);
    expect(b.map!.unplacedShare).toBe(20);
    expect(b.big).toBe('80%');
  });
  it('says the caption is a name match and names a partial last year', () => {
    const b = buildCountryMapBeat([agg('Alpha', 50), agg('Beta', 30, '2026-10')], origins)!;
    expect(b.caption).toMatch(/not a verified identity/);
    expect(b.caption).toMatch(/2026\) is partial/);
  });
  it('is absent without origins or with fewer than two countries', () => {
    expect(buildCountryMapBeat([agg('Alpha', 5)], {})).toBeNull();
    expect(buildCountryMapBeat([agg('Alpha', 5)], origins)).toBeNull();
  });
});
