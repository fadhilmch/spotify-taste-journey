import type { ConcentrationYear } from '../data/rediscovery';

const SIZE = 140;
const MID = SIZE / 2;
const GOLDEN = 2.399963;

/** Sunflower spiral: biggest artist in the middle. Same layout for every year. */
function spot(i: number): [number, number] {
  const rad = i === 0 ? 0 : Math.sqrt(i) * 6.2;
  return [MID + Math.cos(i * GOLDEN) * rad, MID + Math.sin(i * GOLDEN) * rad];
}

/**
 * One dot per artist, sized by share of the year. Green dots are the artists that
 * together make half of the year's minutes. Only the most-played are drawn.
 */
export function DotPanel({ year }: { year: ConcentrationYear }) {
  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="tj-nw-svg"
      role="img"
      aria-label={`${year.year}: ${year.half} artists make up half of your minutes, out of ${year.artists} played. The ${year.shares.length} most-played are drawn.`}
    >
      {year.shares.map((share, i) => {
        const [cx, cy] = spot(i);
        return (
          <circle
            key={i}
            className="tj-nw-dot"
            style={{ ['--i' as string]: i }}
            cx={cx}
            cy={cy}
            r={Math.max(1.6, Math.sqrt(share) * 40)}
            fill={i < year.half ? 'var(--color-green)' : 'var(--color-line)'}
            opacity={0.88}
          />
        );
      })}
    </svg>
  );
}
