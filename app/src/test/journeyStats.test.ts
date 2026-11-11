import { describe, expect, it } from 'vitest';
import {
  chapters,
  discoveries,
  hourHistogram,
  mixStats,
  sessions,
  albumStats,
  forwardByYear,
  loopStats,
  skipFlagGapYears,
  skipStats,
  startStats,
  weekdayHistogram,
} from '../data/stats';
import { parseStreamingHistory } from '../data/parseExport';
import { buildDemoAggregates, buildDemoEvents } from '../data/demoData';
import type { PlayAggregate, PlayEvent } from '../data/types';

const ev = (over: Partial<PlayEvent>): PlayEvent => ({
  ts: '2025-03-10T20:00:00Z',
  artist: 'A',
  track: 't',
  ms: 180000,
  skipped: false,
  reasonEnd: 'trackdone',
  reasonStart: null,
  album: null,
  shuffle: true,
  offline: false,
  platform: 'android',
  ...over,
});

describe('hour/weekday histograms', () => {
  it('buckets minutes into local hours and weekdays', () => {
    const events = [
      ev({ ts: '2025-03-10T20:00:00Z', ms: 60000 }), // Monday
      ev({ ts: '2025-03-10T21:30:00Z', ms: 120000 }), // Monday
      ev({ ts: '2025-03-12T08:00:00Z', ms: 30000 }), // Wednesday
    ];
    const hours = hourHistogram(events);
    expect(hours.reduce((s, v) => s + v, 0)).toBe(4); // 1 + 2 + 1 (0.5 rounds up)
    expect(hours[new Date('2025-03-10T20:00:00Z').getHours()]).toBe(1);
    expect(hours[new Date('2025-03-10T21:30:00Z').getHours()]).toBe(2);
    const days = weekdayHistogram(events);
    expect(days[0]).toBe(3); // Monday-first
    expect(days[2]).toBe(1);
  });
});

describe('skipStats', () => {
  it('reports hasEnds=false when no row records how it ended', () => {
    const s = skipStats([ev({ reasonEnd: null }), ev({ reasonEnd: null })]);
    expect(s.hasEnds).toBe(false);
  });
  it('computes overall and per-artist skip rates with a 20-play floor', () => {
    const events: PlayEvent[] = [];
    for (let i = 0; i < 30; i++)
      events.push(ev({ artist: 'SkipMe', reasonEnd: i < 6 ? 'fwdbtn' : 'trackdone' }));
    for (let i = 0; i < 5; i++) events.push(ev({ artist: 'SmallSample', reasonEnd: 'fwdbtn' }));
    const s = skipStats(events);
    expect(s.hasEnds).toBe(true);
    expect(s.rate).toBeCloseTo(11 / 35, 5);
    expect(s.byArtist).toHaveLength(1);
    expect(s.byArtist[0]).toMatchObject({ artist: 'SkipMe', plays: 30 });
    expect(s.byArtist[0].skipRate).toBeCloseTo(0.2, 5);
  });
});

describe('forward-button measure by year', () => {
  const year = (y: string, n: number, fwd: number, flag: boolean | null) =>
    Array.from({ length: n }, (_, i) =>
      ev({
        ts: `${y}-05-01T10:00:00Z`,
        reasonEnd: i < fwd ? 'fwdbtn' : 'trackdone',
        skipped: flag === null ? null : flag && i < fwd,
      }),
    );
  it('counts forward-button endings per year and drops years under 100 plays', () => {
    const rows = [
      ...year('2019', 200, 40, false),
      ...year('2020', 150, 90, true),
      ...year('2021', 50, 10, true),
    ];
    const r = forwardByYear(rows);
    expect(r.map((x) => x.year)).toEqual(['2019', '2020']);
    expect(r[0].rate).toBeCloseTo(0.2, 5);
    expect(r[1].rate).toBeCloseTo(0.6, 5);
  });
  it('flags years where the skipped flag is never true although forward endings exist', () => {
    const rows = [
      ...year('2019', 200, 40, false),
      ...year('2020', 150, 90, true),
      ...year('2021', 120, 0, false),
    ];
    expect(skipFlagGapYears(rows)).toEqual(['2019']);
  });
});

describe('discoveries', () => {
  it('finds first months, wonders, keepers and latest discoveries', () => {
    const aggs: PlayAggregate[] = [
      { month: '2024-01', artist: 'Old', track: 'x', ms: 1000 },
      { month: '2024-03', artist: 'Old', track: 'x', ms: 1000 },
      { month: '2024-05', artist: 'Old', track: 'y', ms: 1000 },
      { month: '2024-06', artist: 'Flash', track: 'z', ms: 1000 },
      { month: '2024-06', artist: 'New', track: 'w', ms: 1000 },
      { month: '2024-07', artist: 'New', track: 'w', ms: 1000 },
    ];
    const d = discoveries(aggs);
    expect(d.totalArtists).toBe(3);
    expect(d.oneMonthWonders).toBe(1); // Flash
    expect(d.keepers).toBe(1); // Old
    expect(d.byMonth.find((m) => m.month === '2024-06')?.count).toBe(2);
    expect(d.latest[0].month).toBe('2024-06'); // first heard, not latest heard
  });
});

describe('sessions', () => {
  it('splits on 30-minute gaps and measures the longest span', () => {
    const events = [
      ev({ ts: '2025-03-10T20:00:00Z' }),
      ev({ ts: '2025-03-10T20:04:00Z' }),
      ev({ ts: '2025-03-10T22:00:00Z' }), // gap -> new session
      ev({ ts: '2025-03-11T09:00:00Z' }), // next day
    ];
    const s = sessions(events);
    expect(s.count).toBe(3);
    expect(s.activeDays).toBe(2);
  });
});

describe('mixStats', () => {
  it('shares shuffle, offline and platform by minutes', () => {
    const events = [
      ev({ platform: 'android', shuffle: true, ms: 60000 }),
      ev({ platform: 'windows 10', shuffle: false, ms: 60000 }),
      ev({ platform: 'iOS', shuffle: true, offline: true, ms: 60000 }),
    ];
    const m = mixStats(events);
    expect(m.shuffleShare).toBeCloseTo(2 / 3, 5);
    expect(m.offlineShare).toBeCloseTo(1 / 3, 5);
    expect(m.platforms).toHaveLength(3);
    expect(m.platforms.map((p) => p.name)).toContain('Windows');
  });
  it('returns null shares when flags are absent', () => {
    const m = mixStats([ev({ shuffle: null, offline: null, platform: null })]);
    expect(m.shuffleShare).toBeNull();
    expect(m.offlineShare).toBeNull();
    expect(m.platforms).toHaveLength(0);
  });
});

describe('chapters', () => {
  const months = [
    { key: '2024-01', label: 'January 2024', short: 'Jan', minutes: 100 },
    { key: '2024-02', label: 'February 2024', short: 'Feb', minutes: 100 },
    { key: '2024-03', label: 'March 2024', short: 'Mar', minutes: 100 },
    { key: '2024-04', label: 'April 2024', short: 'Apr', minutes: 100 },
  ];
  it('labels first, takeover, phase and comeback eras deterministically', () => {
    const aggs: PlayAggregate[] = [
      { month: '2024-01', artist: 'Alpha', track: 'a1', ms: 80 * 60000 },
      { month: '2024-01', artist: 'Beta', track: 'b1', ms: 20 * 60000 },
      { month: '2024-02', artist: 'Beta', track: 'b1', ms: 90 * 60000 },
      { month: '2024-02', artist: 'Alpha', track: 'a1', ms: 10 * 60000 },
      { month: '2024-03', artist: 'Gamma', track: 'g1', ms: 40 * 60000 },
      { month: '2024-03', artist: 'Beta', track: 'b1', ms: 35 * 60000 },
      { month: '2024-03', artist: 'Alpha', track: 'a1', ms: 25 * 60000 },
      { month: '2024-04', artist: 'Alpha', track: 'a1', ms: 70 * 60000 },
      { month: '2024-04', artist: 'Beta', track: 'b1', ms: 30 * 60000 },
    ];
    const ch = chapters(months, aggs);
    expect(ch.map((c) => c.kind)).toEqual(['first', 'takeover', 'phase', 'comeback']);
    expect(ch[3].artist).toBe('Alpha');
    expect(ch[3].current).toBe(true);
    expect(ch[1].share).toBeGreaterThanOrEqual(0.45);
    expect(ch[1].topTrack).toBe('b1');
  });
});

describe('parser event extraction', () => {
  it('keeps skipped/shuffle/offline/platform/reason_end from extended rows', () => {
    const summary = parseStreamingHistory([
      {
        ts: '2025-01-05T22:10:00Z',
        ms_played: 90000,
        master_metadata_track_name: 'Song',
        master_metadata_album_artist_name: 'Artist',
        skipped: true,
        reason_end: 'fwdbtn',
        shuffle: true,
        offline: false,
        platform: 'android',
      },
    ]);
    expect(summary.events).toHaveLength(1);
    expect(summary.events[0]).toMatchObject({
      skipped: true,
      reasonEnd: 'fwdbtn',
      shuffle: true,
      offline: false,
      platform: 'android',
    });
  });
  it('fills nulls for legacy rows', () => {
    const summary = parseStreamingHistory([
      { endTime: '2019-03-04 21:05', msPlayed: 200000, trackName: 'Old Song', artistName: 'Old Artist' },
    ]);
    expect(summary.events[0].skipped).toBeNull();
    expect(summary.events[0].platform).toBeNull();
    expect(summary.events[0].ts).toBe('2019-03-04T21:05');
  });
});

describe('demo fixtures', () => {
  it('stagger first listens so the discoveries chart spreads', () => {
    const d = discoveries(buildDemoAggregates());
    expect(d.byMonth.length).toBeGreaterThan(3);
    expect(d.totalArtists).toBe(9);
  });
  it('demo events carry skip/shuffle/platform flags for the deeper stats', () => {
    const events = buildDemoEvents();
    expect(events.length).toBeGreaterThan(500);
    expect(skipStats(events).hasEnds).toBe(true);
    const m = mixStats(events);
    expect(m.shuffleShare).not.toBeNull();
    expect(m.platforms.length).toBeGreaterThan(2);
  });
});

describe('loops, albums and starts', () => {
  const at = (min: number) => `2024-03-05T10:${String(min).padStart(2, '0')}:00Z`;
  it('finds runs of one track within the gap and names the longest', () => {
    const rows = [
      ...Array.from({ length: 6 }, (_, i) => ev({ ts: at(i), track: 'Loop', artist: 'L' })),
      ev({ ts: at(7), track: 'Other', artist: 'L' }),
      ...Array.from({ length: 4 }, (_, i) => ev({ ts: at(10 + i), track: 'Short', artist: 'L' })),
      // same track again but hours later: not part of the same run
      ev({ ts: '2024-03-05T20:00:00Z', track: 'Loop', artist: 'L' }),
    ];
    const l = loopStats(rows);
    expect(l.runs).toBe(1);
    expect(l.longest).toMatchObject({ count: 6, track: 'Loop', artist: 'L', endMonth: 'March 2024' });
    expect(l.byYear).toEqual([{ year: '2024', runs: 1 }]);
  });
  it('fills years without a run with zero so the bars have no gap', () => {
    const run = (y: string) =>
      Array.from({ length: 5 }, (_, i) => ev({ ts: `${y}-02-01T10:0${i}:00Z`, track: 'R', artist: 'Z' }));
    const l = loopStats([...run('2021'), ...run('2024')]);
    expect(l.byYear.map((y) => [y.year, y.runs])).toEqual([
      ['2021', 1],
      ['2022', 0],
      ['2023', 0],
      ['2024', 1],
    ]);
  });
  it('counts albums with enough different tracks, not repeats of one track', () => {
    const wide = Array.from({ length: 9 }, (_, i) => ev({ artist: 'A', track: `t${i}`, album: 'Wide' }));
    const narrow = Array.from({ length: 20 }, () => ev({ artist: 'A', track: 'same', album: 'Narrow' }));
    const a = albumStats([...wide, ...narrow, ev({ album: null })]);
    expect(a.albums).toBe(2);
    expect(a.wide).toBe(1);
    expect(a.top[0]).toMatchObject({ album: 'Wide', tracks: 9 });
    expect(a.byYear).toEqual([{ year: '2025', wide: 1 }]);
  });
  it('splits starts into chosen, carried on and forward, and reports blank without them', () => {
    expect(startStats([ev({ reasonStart: null })]).hasStarts).toBe(false);
    const rows = [
      ...Array.from({ length: 2 }, () => ev({ reasonStart: 'clickrow' })),
      ev({ reasonStart: 'backbtn' }),
      ...Array.from({ length: 5 }, () => ev({ reasonStart: 'trackdone' })),
      ev({ reasonStart: 'fwdbtn' }),
      ev({ reasonStart: 'appload' }),
    ];
    const s = startStats(rows);
    expect(s.chosen).toBeCloseTo(3 / 10, 5);
    expect(s.carried).toBeCloseTo(5 / 10, 5);
    expect(s.forward).toBeCloseTo(1 / 10, 5);
  });
  it('reads reason_start and album from extended rows and nothing else new', () => {
    const s = parseStreamingHistory([
      {
        ts: '2024-01-01T10:00:00Z',
        ms_played: 60000,
        master_metadata_track_name: 'T',
        master_metadata_album_artist_name: 'A',
        master_metadata_album_album_name: 'Al',
        reason_start: 'clickrow',
        spotify_track_uri: 'spotify:track:x',
        ip_addr: '1.2.3.4',
      },
    ]);
    expect(s.events[0]).toMatchObject({ reasonStart: 'clickrow', album: 'Al' });
    expect(JSON.stringify(s.events[0])).not.toContain('1.2.3.4');
    expect(JSON.stringify(s.events[0])).not.toContain('spotify:track');
  });
});
