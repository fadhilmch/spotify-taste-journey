import { useMemo, useState } from 'react';
import { concentration } from '../data/rediscovery';
import type { PlayAggregate } from '../data/types';
import { Card, CardAside, Chip } from './primitives';

const SIZE = 140;
const MID = SIZE / 2;
const GOLDEN = 2.399963;

/** Dot positions on a sunflower spiral: biggest artist in the middle. Same for every year, so dots can move smoothly between years. */
function layout(count: number): Array<[number, number]> {
  return Array.from({ length: count }, (_, i) => {
    const rad = i === 0 ? 0 : Math.sqrt(i) * 6.2;
    return [MID + Math.cos(i * GOLDEN) * rad, MID + Math.sin(i * GOLDEN) * rad];
  });
}

/**
 * Narrow and wide: one dot per artist, sized by share of the year. Green dots are
 * the artists that together make half of that year's minutes. Only the most-played
 * artists are drawn (the page says how many), the numbers cover everyone.
 */
export function NarrowWide({ aggs }: { aggs: PlayAggregate[] }) {
  const years = useMemo(() => concentration(aggs), [aggs]);
  const [picked, setPicked] = useState<string | null>(null);
  if (years.length === 0) return null;

  const cur = years.find((y) => y.year === picked) ?? years[years.length - 1];
  const narrow = years.reduce((a, b) => (b.half < a.half ? b : a));
  const wide = years.reduce((a, b) => (b.half > a.half ? b : a));
  const drawn = cur.shares.length;
  const maxDrawn = Math.max(...years.map((y) => y.shares.length));
  const dots = layout(maxDrawn);

  return (
    <Card
      id="tj-narrow-h"
      title="Narrow and wide"
      aside={<CardAside>artists it takes to make half your minutes</CardAside>}
    >
      <div className="tj-nw-stage">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="tj-nw-svg"
          role="img"
          aria-label={`${cur.year}: ${cur.half} artists make up half of your minutes, out of ${cur.artists} played. The ${drawn} most-played are drawn.`}
        >
          {dots.map(([cx, cy], i) => {
            const share = cur.shares[i];
            const on = share !== undefined;
            return (
              <circle
                key={i}
                className="tj-nw-dot"
                cx={cx}
                cy={cy}
                r={on ? Math.max(1.6, Math.sqrt(share) * 40) : 0}
                fill={on && i < cur.half ? 'var(--color-green)' : 'var(--color-line)'}
                opacity={on ? 0.88 : 0}
              />
            );
          })}
        </svg>
        <div className="tj-nw-read">
          <div className="tj-nw-big">{cur.half}</div>
          <p className="tj-note" style={{ margin: 0 }}>
            artists made up half of your {cur.year}
            {cur.partial ? ' so far' : ''} listening, out of {cur.artists.toLocaleString('en-US')} you played.
          </p>
        </div>
      </div>
      <div className="tj-nw-years" role="group" aria-label="Year">
        {years.map((y) => (
          <Chip key={y.year} on={y.year === cur.year} onClick={() => setPicked(y.year)}>
            {y.year}
          </Chip>
        ))}
      </div>
      <p className="tj-note">
        Narrowest: {narrow.year} with {narrow.half}
        {narrow.partial ? ' (partial year)' : ''}. Widest: {wide.year} with {wide.half}
        {wide.partial ? ' (partial year)' : ''}. Each dot is an artist, sized by its share of the year; green
        dots together make half. Only the {drawn} most-played artists are drawn, so the dots are a subset. The
        counts cover every artist.
      </p>
    </Card>
  );
}
