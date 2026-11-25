import { describe, expect, it, vi } from 'vitest';
import { countryForAlpha2, countryName, worldShapes } from '../data/geo';
import { DEMO_GENRES, buildDemoAggregates } from '../data/demoData';
import { lookupArtistGenre } from '../data/genreService';

describe('world geo', () => {
  it('loads real country shapes offline', () => {
    const { shapes, sphere } = worldShapes();
    expect(shapes.length).toBeGreaterThan(150);
    expect(sphere.length).toBeGreaterThan(0);
  });

  it('maps ISO alpha-2 codes to shapes and names', () => {
    expect(countryForAlpha2('SE')?.name).toBe('Sweden');
    expect(countryForAlpha2('ID')?.name).toBe('Indonesia');
    expect(countryForAlpha2(null)).toBeNull();
    expect(countryForAlpha2('XX')).toBeNull();
    expect(countryName('SE')).toBe('Sweden');
  });

  it('centroids stay inside the map viewBox', () => {
    for (const s of worldShapes().shapes) {
      expect(s.centroid[0]).toBeGreaterThanOrEqual(0);
      expect(s.centroid[0]).toBeLessThanOrEqual(960);
      expect(s.centroid[1]).toBeGreaterThanOrEqual(0);
      expect(s.centroid[1]).toBeLessThanOrEqual(500);
    }
  });
});

describe('artist origins', () => {
  it('demo data carries origins, with one artist deliberately unmapped', () => {
    expect(DEMO_GENRES['Senja Radio'].origin?.country).toBe('ID');
    expect(DEMO_GENRES['June Harbor'].origin?.country).toBe('SE');
    expect(DEMO_GENRES['Lost Cartographer']).toBeUndefined();
    const aggs = buildDemoAggregates();
    expect(aggs.some((a) => a.artist === 'Lost Cartographer')).toBe(true);
    const countries = new Set(Object.values(DEMO_GENRES).map((g) => g.origin?.country));
    expect(countries.size).toBeGreaterThanOrEqual(8);
  });

  it('MusicBrainz lookup captures country and area when present', async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            artists: [
              {
                name: 'June Harbor',
                country: 'SE',
                area: { name: 'Stockholm, Sweden' },
                tags: [{ name: 'ambient', count: 5 }],
              },
            ],
          }),
          { status: 200 },
        ),
    ) as unknown as typeof fetch;
    const hit = await lookupArtistGenre('June Harbor', fetcher);
    expect(hit?.origin?.country).toBe('SE');
    expect(hit?.origin?.area).toBe('Stockholm, Sweden');
  });

  it('lookup tolerates artists with no origin fields', async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            artists: [{ name: 'Mystery Act', tags: [{ name: 'rock', count: 3 }] }],
          }),
          { status: 200 },
        ),
    ) as unknown as typeof fetch;
    const hit = await lookupArtistGenre('Mystery Act', fetcher);
    expect(hit?.groups).toContain('Rock');
    expect(hit?.origin?.country).toBeNull();
  });
});

describe('streamArea', () => {
  it('stacks rows into cumulative layers and produces closed paths', async () => {
    const { stackRows, layerPath } = await import('../lib/streamArea');
    const layers = stackRows(
      [
        { a: 0.5, b: 0.25 },
        { a: 0.2, b: 0.6 },
      ],
      ['a', 'b'],
    );
    expect(layers[0].points).toEqual([
      [0, 0.5],
      [0, 0.2],
    ]);
    expect(layers[1].points).toEqual([
      [0.5, 0.75],
      [0.2, 0.8],
    ]);
    const d = layerPath(layers[0].points, [0, 100], 200);
    expect(d.startsWith('M')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    expect(d).toContain('C'); // smoothed
  });

  it('monotone curve passes through the data points', async () => {
    const { layerPath } = await import('../lib/streamArea');
    const d = layerPath(
      [
        [0, 0.5],
        [0, 0.5],
      ],
      [0, 100],
      100,
    );
    expect(d).toContain('0.00,50.00');
    expect(d).toContain('100.00,50.00');
  });
});
