import { describe, expect, it } from 'vitest';
import { buildMonths } from '../data/stats';
import { NEXT_STEP, takeaway } from '../data/takeaways';
import type { PlayAggregate, View } from '../data/types';

const mk = (month: string, artist: string, track: string, minutes: number): PlayAggregate => ({
  month,
  artist,
  track,
  ms: minutes * 60_000,
});
const aggs = [
  mk('2019-03', 'Old', 'a', 300),
  mk('2019-04', 'Old', 'a', 100),
  mk('2020-01', 'Steady', 'b', 200),
  mk('2020-02', 'Steady', 'b', 200),
  mk('2020-03', 'Steady', 'c', 100),
  mk('2022-06', 'New', 'd', 80),
];
const months = buildMonths(aggs);

describe('takeaway', () => {
  it('states the biggest month and who led it', () => {
    expect(takeaway('journey', aggs, months).lead).toContain('Mar 2019');
    expect(takeaway('journey', aggs, months).lead).toContain('led by Old');
  });
  it('states the longest run on top', () => {
    expect(takeaway('story', aggs, months).lead).toBe(
      'Steady held the top spot for 3 months in a row, your longest stretch.',
    );
  });
  it('states concentration of artists and tracks', () => {
    expect(takeaway('artists', aggs, months).lead).toContain('Steady is first');
    expect(takeaway('tracks', aggs, months).lead).toContain('Half of your listening');
  });
  it('phrases artists plainly when there are fewer than ten', () => {
    expect(takeaway('artists', aggs, months).lead).toBe(
      'Steady is first with 500 min, 51% of the minutes in this range.',
    );
  });
  it('only states a genre finding when most minutes have a genre', () => {
    const g = { Old: { groups: ['Rock'] }, Steady: { groups: ['Jazz'] } } as never;
    expect(takeaway('genres', aggs, months, g).lead).toContain('Jazz is your biggest group');
    expect(takeaway('genres', aggs, months, {}).lead).toBeNull();
  });
  it('is empty for no data and for pages with no honest single finding', () => {
    expect(takeaway('artists', [], []).lead).toBeNull();
    expect(takeaway('map', aggs, months).lead).toBeNull();
  });
  it('never gives a reason for a change', () => {
    const views: View[] = ['rediscover', 'journey', 'story', 'artists', 'tracks'];
    for (const v of views)
      expect(takeaway(v, aggs, months).lead ?? '').not.toMatch(/because|due to|since you/i);
  });
});

describe('NEXT_STEP', () => {
  it('forms one chain from the story to share with no loops', () => {
    const seen: View[] = [];
    let v: View | undefined = 'flow';
    while (v && NEXT_STEP[v]) {
      seen.push(v);
      v = NEXT_STEP[v]!.to;
    }
    expect(seen).toEqual(['flow', 'rediscover', 'journey', 'story', 'map', 'genres', 'artists', 'tracks']);
    expect(v).toBe('share');
  });
});

describe('rediscover takeaway', () => {
  it('skips the exploration line when no year brought new artists', () => {
    const flat = [mk('2019-01', 'A', 'x', 100), mk('2020-01', 'A', 'x', 100), mk('2021-01', 'A', 'x', 100)];
    expect(takeaway('rediscover', flat, buildMonths(flat)).lead).toBeNull();
  });
});
