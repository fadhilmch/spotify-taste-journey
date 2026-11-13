import { worldShapes, WORLD_H, WORLD_W } from '../data/geo';
import type { CountryMapData } from '../data/habits';

/** Country-level map: land shaded by share of minutes, top countries named. Origin, not where you listened. */
export function CountryMap({ data }: { data: CountryMapData }) {
  const world = worldShapes();
  const byId = new Map(data.countries.map((c) => [c.id, c]));
  const max = data.countries[0]?.minutes ?? 1;
  const top = data.countries.slice(0, 5);
  const label = top.map((c) => `${c.name} ${c.share}%`).join(', ');
  return (
    <div className="tj-cmap">
      <svg
        className="tj-world tj-cmap-svg"
        viewBox={`0 0 ${WORLD_W} ${WORLD_H}`}
        role="img"
        aria-label={`World map shaded by minutes per artist origin country. Biggest: ${label}. ${data.unplacedShare}% of minutes are not placed.`}
      >
        <path className="tj-world-sphere" d={world.sphere} />
        {world.shapes.map((s) => {
          const c = byId.get(s.id);
          return (
            <path
              key={s.id}
              className="tj-world-land"
              d={s.d}
              style={
                c ? { fill: `rgba(30, 215, 96, ${0.18 + 0.82 * Math.sqrt(c.minutes / max)})` } : undefined
              }
            />
          );
        })}
      </svg>
      <ul className="tj-cmap-top">
        {top.map((c) => (
          <li key={c.id}>
            <b>{c.share}%</b>
            <span>{c.name}</span>
          </li>
        ))}
      </ul>
      <div className="tj-cmap-key">
        <span className="tj-cmap-scale">
          Fewer <span className="tj-cmap-ramp" aria-hidden="true" /> More minutes
        </span>
        <span className="tj-cmap-np">
          <span className="tj-cmap-swatch" aria-hidden="true" /> Not placed <b>{data.unplacedShare}%</b>
        </span>
      </div>
    </div>
  );
}
