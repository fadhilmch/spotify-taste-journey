import { describe, expect, it } from 'vitest';
import { artistFacts } from '../data/artistFacts';
import { buildHabitBeats } from '../data/habits';
import type { PlayAggregate, PlayEvent } from '../data/types';

const ev = (ts: string, minutes: number): PlayEvent => ({
  ts,
  artist: 'A',
  track: 't',
  ms: minutes * 60_000,
  skipped: null,
  reasonEnd: null,
  shuffle: null,
  offline: null,
  platform: null,
});

describe('buildHabitBeats', () => {
  it('returns nothing without events', () => {
    expect(buildHabitBeats([])).toEqual([]);
  });
  it('finds the busiest hour and day and states shares', () => {
    // 2026-03-02 is a Monday; local time, so build the stamps from local parts.
    const at = (day: number, hour: number) => new Date(2026, 2, day, hour, 0, 0).toISOString();
    const beats = buildHabitBeats([ev(at(2, 21), 60), ev(at(2, 21), 30), ev(at(3, 8), 30)]);
    expect(beats.map((b) => b.id)).toEqual(['habit-hours', 'habit-days', 'habit-sessions']);
    expect(beats[0].big).toBe('21:00');
    expect(beats[0].caption).toContain('75%');
    expect(beats[1].big).toBe('Monday');
    expect(beats[1].values).toHaveLength(7);
  });
});

describe('more habit chapters', () => {
  const at = (day: number, hour: number) => new Date(2026, 2, day, hour, 0, 0).toISOString();
  it('adds sessions, and new names when aggregates are given, but no skips without flags', () => {
    const events = [ev(at(2, 21), 10), ev(at(2, 21), 10), ev(at(5, 9), 10)];
    const aggs: PlayAggregate[] = [{ month: '2026-03', artist: 'A', track: 't', ms: 1 }];
    const ids = buildHabitBeats(events, aggs).map((b) => b.id);
    expect(ids).toContain('habit-sessions');
    expect(ids).toContain('habit-new');
    expect(ids).not.toContain('habit-skips');
  });
  it('adds a skips chapter when the file carries skipped flags', () => {
    const events = Array.from({ length: 30 }, (_, i) => ({ ...ev(at(2, 21), 1), skipped: i < 15 }));
    const b = buildHabitBeats(events).find((x) => x.id === 'habit-skips')!;
    expect(b.big).toBe('50%');
    expect(b.values[21]).toBe(50);
  });
});

describe('artistFacts', () => {
  const aggs: PlayAggregate[] = [
    { month: '2019-01', artist: 'X', track: 'a', ms: 600_000 },
    { month: '2019-02', artist: 'X', track: 'b', ms: 1_200_000 },
    { month: '2020-05', artist: 'X', track: 'a', ms: 600_000 },
    { month: '2020-05', artist: 'Y', track: 'c', ms: 60_000 },
  ];
  it('counts minutes, first and last month and the peak year', () => {
    const f = artistFacts(aggs, 'X')!;
    expect(f).toMatchObject({ minutes: 40, firstMonth: '2019-01', lastMonth: '2020-05', peakYear: '2019' });
    expect(f.peakYearMinutes).toBe(30);
    expect(f.ledYears).toEqual(['2019', '2020']);
    expect(f.monthly.map((m) => m.month)).toEqual(['2019-01', '2019-02', '2020-05']);
  });
  it('returns null for an unknown artist', () => {
    expect(artistFacts(aggs, 'Nobody')).toBeNull();
  });
});
