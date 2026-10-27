import React from 'react';
import { chapters, filterToMonths, fmtMinutes, rangeMonthKeys, topTracks } from '../data/stats';
import { countryForAlpha2, worldShapes, WORLD_H, WORLD_W, type CountryShape } from '../data/geo';
import type { MonthBucket, PlayAggregate } from '../data/types';
import { useAppStore } from '../state/store';
import { OptInGate } from './OptIn';
import { groupHue } from './theme';
import { Card, CardAside, Section } from './primitives';

const MS_PER_MIN = 60000;

interface CountryPin {
  country: string;
  shape: CountryShape;
  minutes: number; // real minutes, not ms
  hue: number | null; // dominant genre group hue, null = none
  artists: Array<{ name: string; minutes: number }>;
}

/**
 * World: where your artists come from, on a real world map rendered fully
 * offline (bundled Natural Earth 110m). One pin per origin COUNTRY at the
 * country's centroid - it means "artists you play are from here", never
 * where you listened. The dashed route links your chapters in time order.
 */
export function MapView({ months, aggs }: { months: MonthBucket[]; aggs: PlayAggregate[] }) {
  const genres = useAppStore((s) => s.genres);
  const genresAreDemo = useAppStore((s) => s.genresAreDemo);
  const matchState = useAppStore((s) => s.matchState);
  const source = useAppStore((s) => s.source);
  const range = useAppStore((s) => s.range);
  const [selected, setSelected] = React.useState<string | null>(null);
  const mapRef = React.useRef<SVGSVGElement>(null);
  const [mapPx, setMapPx] = React.useState(0);
  React.useEffect(() => {
    const el = mapRef.current;
    if (!el) return;
    const update = () => setMapPx(el.clientWidth);
    update();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // SVG units per rendered CSS pixel; keep tap targets >= 44 CSS px and labels readable.
  const pxPerUnit = mapPx > 0 ? mapPx / WORLD_W : 1;
  const minHitUnits = 22 / Math.max(0.2, pxPerUnit);
  const labelUnits = Math.min(30, Math.max(17, 10.5 / Math.max(0.2, pxPerUnit)));

  const rangeKeys = rangeMonthKeys(months, range);
  const rangedMonths = months.filter((m) => rangeKeys.has(m.key));
  const rangedAggs = React.useMemo(() => filterToMonths(aggs, rangeKeys), [aggs, rangeKeys]);

  const world = worldShapes();

  const { pins, noOrigin, route } = React.useMemo(() => {
    const byCountry = new Map<string, CountryPin>();
    const noOrigin = new Map<string, number>();
    for (const a of rangedAggs) {
      const g = genres[a.artist];
      const shape = countryForAlpha2(g?.origin?.country);
      const min = a.ms / MS_PER_MIN;
      if (g && shape) {
        let pin = byCountry.get(shape.id);
        if (!pin) {
          pin = { country: shape.name, shape, minutes: 0, hue: null, artists: [] };
          byCountry.set(shape.id, pin);
        }
        pin.minutes += min;
        const prev = pin.artists.find((x) => x.name === a.artist);
        if (prev) prev.minutes += min;
        else pin.artists.push({ name: a.artist, minutes: min });
      } else {
        noOrigin.set(a.artist, (noOrigin.get(a.artist) ?? 0) + min);
      }
    }
    const pins = [...byCountry.values()];
    // Dominant group hue per country, weighted by minutes.
    for (const pin of pins) {
      const byGroup = new Map<string, number>();
      for (const a of rangedAggs) {
        const g = genres[a.artist];
        if (!g || countryForAlpha2(g.origin?.country)?.id !== pin.shape.id) continue;
        const grp = g.groups[0];
        if (grp) byGroup.set(grp, (byGroup.get(grp) ?? 0) + a.ms);
      }
      const top = [...byGroup.entries()].sort((x, y) => y[1] - x[1])[0];
      pin.hue = top ? groupHue(top[0]) : null;
      pin.artists.sort((x, y) => y.minutes - x.minutes);
    }
    pins.sort((a, b) => b.minutes - a.minutes);
    // Chapter route: distinct countries of chapter artists, in time order.
    const pinByArtist = new Map<string, CountryPin>();
    for (const pin of pins) for (const a of pin.artists) pinByArtist.set(a.name, pin);
    const route: CountryPin[] = [];
    for (const c of chapters(rangedMonths, rangedAggs)) {
      const pin = pinByArtist.get(c.artist);
      if (pin && route[route.length - 1] !== pin) route.push(pin);
    }
    return {
      pins,
      noOrigin: [...noOrigin.entries()]
        .map(([artist, minutes]) => ({ artist, minutes }))
        .sort((a, b) => b.minutes - a.minutes),
      route,
    };
  }, [rangedAggs, rangedMonths, genres]);

  const maxMin = pins[0]?.minutes ?? 1;
  const sel = pins.find((p) => p.shape.id === selected) ?? null;
  const gated = source === 'export' && matchState === 'idle';

  // Place each label below its pin, else above it; skip a label that would still overlap one already placed
  // (every country stays in the list under the map).
  const labelAt = new Map<string, number>();
  {
    const placed: Array<[number, number, number, number]> = [];
    const hits = (b: [number, number, number, number]) =>
      placed.some((q) => b[0] < q[2] && b[2] > q[0] && b[1] < q[3] && b[3] > q[1]);
    for (const p of pins) {
      const r = 8 + 20 * Math.sqrt(p.minutes / maxMin);
      const [cx, cy] = p.shape.centroid;
      const w = p.country.length * labelUnits * 0.6;
      const mk = (base: number): [number, number, number, number] => [
        cx - w / 2,
        base - labelUnits,
        cx + w / 2,
        base + labelUnits * 0.3,
      ];
      const below = cy + r + labelUnits;
      const above = cy - r - labelUnits * 0.3 - 22;
      const others = pins
        .filter((o) => o !== p)
        .map((o): [number, number, number, number] => {
          const or = 8 + 20 * Math.sqrt(o.minutes / maxMin);
          const [ox, oy] = o.shape.centroid;
          return [ox - or, oy - or, ox + or, oy + or];
        });
      const onPin = (bx: [number, number, number, number]) =>
        others.some((q) => bx[0] < q[2] && bx[2] > q[0] && bx[1] < q[3] && bx[3] > q[1]);
      for (const y of [below, above]) {
        const bx = mk(y);
        if (!hits(bx) && !onPin(bx)) {
          placed.push(bx);
          labelAt.set(p.shape.id, y);
          break;
        }
      }
    }
  }

  const routePath =
    route.length >= 2
      ? route.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.shape.centroid[0]},${p.shape.centroid[1]}`).join(' ')
      : null;

  return (
    <>
      {source === 'export' && <OptInGate what="World map and genres" plural />}

      <Section
        id="tj-world-h"
        title={'Where your music comes from'}
        aside={
          <>
            {genresAreDemo ? 'Demo tags' : 'MusicBrainz'}
            {range !== 'all' ? ' - current range' : ''}
          </>
        }
      >
        {gated ? (
          <p className="tj-note">Enable the lookup above to place your artists on the map.</p>
        ) : (
          <>
            <svg
              ref={mapRef}
              className="tj-world"
              viewBox={`0 0 ${WORLD_W} ${WORLD_H}`}
              role="img"
              aria-label="World map with one pin per artist origin country"
            >
              <path className="tj-world-sphere" d={world.sphere} />
              {world.shapes.map((s) => (
                <path key={s.id} className="tj-world-land" d={s.d} />
              ))}
              {routePath && <path className="tj-world-route" d={routePath} />}
              {pins.map((p) => {
                const r = 8 + 20 * Math.sqrt(p.minutes / maxMin);
                // Hit disc must be >= 44 CSS px across: convert to SVG units from the rendered width.
                const hit = Math.max(r + 12, minHitUnits);
                const [cx, cy] = p.shape.centroid;
                return (
                  <g key={p.shape.id}>
                    <circle
                      className="tj-world-hit"
                      cx={cx}
                      cy={cy}
                      r={hit}
                      tabIndex={0}
                      role="button"
                      aria-label={`${p.country}: ${p.artists.length} artist${p.artists.length === 1 ? '' : 's'}, ${fmtMinutes(p.minutes)}`}
                      onClick={() => setSelected(selected === p.shape.id ? null : p.shape.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelected(selected === p.shape.id ? null : p.shape.id);
                        }
                      }}
                    />
                    <circle
                      className={'tj-world-pin' + (selected === p.shape.id ? ' is-sel' : '')}
                      cx={cx}
                      cy={cy}
                      r={r}
                      fill={p.hue != null ? `hsl(${p.hue} 60% 52%)` : '#5a5a60'}
                      pointerEvents="none"
                    />
                    {labelAt.has(p.shape.id) && (
                      <text
                        className="tj-world-label"
                        x={cx}
                        y={labelAt.get(p.shape.id)}
                        style={{ fontSize: labelUnits }}
                      >
                        {p.country}
                      </text>
                    )}
                  </g>
                );
              })}
              {[
                ...route
                  .reduce(
                    (m, p, i) => (m.has(p.shape.id) ? m : m.set(p.shape.id, i)),
                    new Map<string, number>(),
                  )
                  .entries(),
              ].map(([id, i]) => {
                const p = route[i];
                return (
                  <g
                    key={`stop-${id}`}
                    transform={`translate(${p.shape.centroid[0]}, ${p.shape.centroid[1] - 22})`}
                  >
                    <circle className="tj-world-stop" r={8} />
                    <text className="tj-world-stopnum" y={0.5}>
                      {i + 1}
                    </text>
                  </g>
                );
              })}
            </svg>

            <div className="tj-map-legend">
              <span className="tj-map-chip">
                <i className="tj-map-dot" style={{ background: 'var(--green)' }} />
                Numbered stops: your chapters, in order
              </span>
              <span className="tj-map-chip">
                <i className="tj-map-dot" style={{ background: '#5a5a60' }} />
                No genre group
              </span>
            </div>

            {sel && (
              <Card
                role="status"
                animated={false}
                title={sel.country}
                aside={<CardAside>{fmtMinutes(sel.minutes)} in the current range</CardAside>}
              >
                <ol className="tj-mini">
                  {sel.artists.map((a, i) => (
                    <li key={a.name}>
                      <span className="tj-rank">{i + 1}</span>
                      <span className="tj-mini-name">
                        {a.name}
                        <em>
                          most played:{' '}
                          {topTracks(
                            rangedAggs.filter((x) => x.artist === a.name),
                            1,
                          )[0]?.name ?? 'n/a'}
                        </em>
                      </span>
                      <span className="tj-mini-val">{fmtMinutes(a.minutes)}</span>
                    </li>
                  ))}
                </ol>
              </Card>
            )}

            <div className="tj-country-list" role="list" aria-label="Origins by country">
              {pins.map((p) => (
                <button
                  key={`row-${p.shape.id}`}
                  type="button"
                  className={'tj-country-row' + (selected === p.shape.id ? ' is-sel' : '')}
                  onClick={() => setSelected(selected === p.shape.id ? null : p.shape.id)}
                >
                  <i
                    className="tj-map-dot"
                    style={{ background: p.hue != null ? `hsl(${p.hue} 60% 52%)` : '#5a5a60' }}
                  />
                  <span className="tj-country-name">{p.country}</span>
                  <span className="tj-country-meta">
                    {p.artists.length} artist{p.artists.length === 1 ? '' : 's'} - {fmtMinutes(p.minutes)}
                  </span>
                </button>
              ))}
            </div>

            <p className="tj-note">
              Each pin sits at the center of a country and means artists you play come from there - never
              where you listened. Pin size is your minutes in the current range; color is the dominant genre
              group. Origins and tags
              {genresAreDemo
                ? ' are invented demo data.'
                : ' come from MusicBrainz (CC BY-NC-SA, credited); nothing about your plays leaves this device.'}
            </p>

            {noOrigin.length > 0 && (
              <details className="tj-note">
                <summary>
                  {noOrigin.length} artist{noOrigin.length === 1 ? '' : 's'} with no origin on record
                </summary>
                <ol className="tj-mini" style={{ marginTop: 8 }}>
                  {noOrigin.slice(0, 12).map((a) => (
                    <li key={a.artist}>
                      <span className="tj-mini-name">{a.artist}</span>
                      <span className="tj-mini-val">{fmtMinutes(a.minutes)}</span>
                    </li>
                  ))}
                </ol>
                No origin is guessed - these stay off the map until the metadata source has one.
              </details>
            )}
          </>
        )}
      </Section>
    </>
  );
}
