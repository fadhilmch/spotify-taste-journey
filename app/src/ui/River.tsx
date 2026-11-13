import type { RiverData } from '../data/habits';
import { LABEL_SIZE, placeLabels, type LabelWish } from './riverLabels';

const W = 320;
const H = 440;
const T = 14;
const B = 10;
const HALF = 150;
const HUES = [152, 140, 128, 118, 108, 146, 134, 122, 112, 156];

/** Smooth path along vertical points using midpoint quadratic curves. */
function curve(pts: Array<[number, number]>, move = true): string {
  let d = `${move ? 'M' : 'L'}${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length - 1; i += 1) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2;
    const my = (pts[i][1] + pts[i + 1][1]) / 2;
    d += `Q${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`;
  }
  const last = pts[pts.length - 1];
  return `${d}L${last[0].toFixed(1)} ${last[1].toFixed(1)}`;
}

/**
 * The top artists as a river, time running downward. Each band's width is that artist's minutes
 * in the month (smoothed over three months); the pale halo is every play. The colours only
 * tell the bands apart.
 */
export function River({ data }: { data: RiverData }) {
  const n = data.months.length;
  const cx = W / 2 + 12;
  const y = (i: number) => T + (i / (n - 1)) * (H - T - B);
  const stack = data.bands.map(() => new Array<number>(n).fill(0));
  const lo: number[][] = data.bands.map(() => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i += 1) {
    const sum = data.bands.reduce((s, b) => s + b.minutes[i], 0);
    let run = -sum / 2;
    data.bands.forEach((b, j) => {
      lo[j][i] = run;
      run += b.minutes[i];
      stack[j][i] = run;
    });
  }
  const sums = data.months.map((_, i) => data.bands.reduce((t, b) => t + b.minutes[i], 0));
  const k = (HALF * 1.5) / Math.max(...sums);
  const px = (v: number) => cx + v * k;
  const wishes: LabelWish[] = [];
  data.bands.forEach((b, j) => {
    if (!data.leaders.includes(b.artist)) return;
    let at = 0;
    b.minutes.forEach((v, i) => {
      if (v > b.minutes[at]) at = i;
    });
    wishes.push({ artist: b.artist, y: y(at), cx: (px(lo[j][at]) + px(stack[j][at])) / 2 });
  });
  const labels = placeLabels(wishes, W, T + LABEL_SIZE, H - B);
  const years: Array<{ label: string; i: number }> = [];
  data.months.forEach((m, i) => {
    if (m.endsWith('-01') || i === 0) years.push({ label: m.slice(0, 4), i });
  });
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="tj-river-svg"
      role="img"
      aria-label={`A river of your listening from ${data.months[0]} to ${data.months[n - 1]}. ${data.bands
        .map((b) => b.artist)
        .join(', ')} are the bands.`}
    >
      <defs>
        <clipPath id="tj-river-clip">
          <rect x="0" y="0" width={W} height={H} className="tj-river-reveal" />
        </clipPath>
      </defs>
      <g clipPath="url(#tj-river-clip)">
        {data.bands.map((b, j) => {
          const left = b.minutes.map((_, i): [number, number] => [px(lo[j][i]), y(i)]);
          const right = b.minutes.map((_, i): [number, number] => [px(stack[j][i]), y(i)]).reverse();
          return (
            <path
              key={b.artist}
              d={`${curve(left)}${curve(right, false)}Z`}
              fill={`hsl(${HUES[j % HUES.length]} 62% ${38 + (j % 3) * 8}%)`}
              opacity={0.92}
            />
          );
        })}
      </g>
      {years.map((yr) => (
        <text key={yr.label} x={4} y={y(yr.i) + 3} className="tj-nw-tick">
          {yr.label}
        </text>
      ))}
      {labels.map((l, i) => (
        <text
          key={l.artist}
          x={l.x}
          y={l.y + 4}
          textAnchor="middle"
          className="tj-river-name"
          style={{ animationDelay: `${1.2 + (i / Math.max(1, labels.length)) * 2}s` }}
        >
          {l.text}
        </text>
      ))}
    </svg>
  );
}
