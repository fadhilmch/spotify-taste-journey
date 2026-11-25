import React from 'react';
import type { MonthBucket } from '../data/types';
import { useAppStore } from '../state/store';
import { topArtists } from '../data/stats';
import type { PlayAggregate } from '../data/types';
import { artistBackground } from './theme';

export function PlayerBar({ months, aggs }: { months: MonthBucket[]; aggs: PlayAggregate[] }) {
  const month = useAppStore((s) => s.month);
  const setMonth = useAppStore((s) => s.setMonth);
  const playing = useAppStore((s) => s.playing);
  const setPlaying = useAppStore((s) => s.setPlaying);

  const idx = Math.max(
    0,
    months.findIndex((m) => m.key === (month ?? months[months.length - 1]?.key)),
  );
  const cur = months[idx];
  const curKey = cur?.key;
  const topArtist = React.useMemo(
    () =>
      curKey
        ? topArtists(
            aggs.filter((a) => a.month === curKey),
            1,
          )[0]
        : undefined,
    [aggs, curKey],
  );

  // Playback: advance the selected month on a timer; stop at the last month.
  React.useEffect(() => {
    if (!playing || months.length === 0) return;
    const t = setInterval(() => {
      if (idx >= months.length - 1) {
        setPlaying(false);
      } else {
        setMonth(months[idx + 1].key);
      }
    }, 900);
    return () => clearInterval(t);
  }, [playing, months, idx, setMonth, setPlaying]);

  // Leaving the pages that show the bar pauses playback, so coming back never restarts it by itself.
  // The bar stays mounted when moving between its own pages, so playback carries on there.
  React.useEffect(() => () => setPlaying(false), [setPlaying]);

  if (!cur) return null;
  return (
    <div className="tj-player">
      <span className="tj-thumb" style={{ background: artistBackground(topArtist?.name ?? '?') }} />
      <div className="tj-player-mid">
        <p className="tj-player-title">
          {cur.label}
          {topArtist ? ` - ${topArtist.name}` : ''}
        </p>
        <input
          type="range"
          min={0}
          max={months.length - 1}
          value={idx}
          aria-label="Scrub through months"
          aria-valuetext={cur.label}
          onChange={(e) => {
            setMonth(months[Number(e.target.value)].key);
            setPlaying(false);
          }}
        />
      </div>
      <button
        type="button"
        className="tj-play"
        onClick={() => {
          // Play from the last month restarts from the first.
          if (!playing && idx >= months.length - 1 && months.length > 1) setMonth(months[0].key);
          setPlaying(!playing);
        }}
        aria-label={playing ? 'Pause the journey' : 'Play the journey'}
      >
        {playing ? '❚❚' : '▶'}
      </button>
    </div>
  );
}
