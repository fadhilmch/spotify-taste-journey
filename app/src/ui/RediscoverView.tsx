import { useMemo } from 'react';
import { exploration, rediscoveries, yearEras } from '../data/rediscovery';
import { fmtMinutes } from '../data/stats';
import type { PlayAggregate } from '../data/types';
import { Card, CardAside } from './primitives';
import { artistBackground } from './theme';

function sinceLabel(months: number): string {
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m} months`;
  return m === 0 ? `${y} y` : `${y} y ${m} m`;
}

/**
 * Rediscovery, eras and exploration. Everything is counted from plays: the view
 * says what changed in your listening, never why.
 */
export function RediscoverView({ aggs }: { aggs: PlayAggregate[] }) {
  const back = useMemo(() => rediscoveries(aggs).slice(0, 10), [aggs]);
  const eras = useMemo(() => yearEras(aggs, 3), [aggs]);
  const explore = useMemo(() => exploration(aggs), [aggs]);

  if (aggs.length === 0) return null;

  return (
    <div className="tj-rediscover">
      <Card
        id="tj-back-h"
        title="Worth coming back to"
        aside={<CardAside>quiet for a year or more</CardAside>}
      >
        {back.length === 0 ? (
          <p className="tj-note">No artist you played a lot has gone quiet for a year yet.</p>
        ) : (
          <ol className="tj-mini">
            {back.map((r, i) => (
              <li key={r.artist}>
                <span className="tj-rank">{i + 1}</span>
                <span className="tj-thumb" style={{ background: artistBackground(r.artist) }} />
                <span className="tj-mini-name tj-mini-wrap">
                  {r.artist}
                  <em>
                    peaked {r.peakYear}, quiet {sinceLabel(r.monthsSince)}
                  </em>
                </span>
                <span className="tj-mini-val">{fmtMinutes(r.minutes)}</span>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <Card id="tj-eras-h" title="Your listening eras" aside={<CardAside>top 3 each year</CardAside>}>
        <ol className="tj-mini">
          {eras.map((e) => (
            <li key={e.year}>
              <span className="tj-year">{e.year}</span>
              <span className="tj-mini-name tj-mini-wrap">
                {e.top.join(', ')}
                <em>
                  {e.year === eras[0].year
                    ? 'first year on record'
                    : `${e.carried} of 3 carried over, ${e.fresh} new to you`}
                </em>
              </span>
            </li>
          ))}
        </ol>
      </Card>

      <Card
        id="tj-explore-h"
        title="Exploring or returning"
        aside={<CardAside>share of minutes on new artists</CardAside>}
      >
        <ol className="tj-mini">
          {explore.map((x) => (
            <li key={x.year}>
              <span className="tj-year">{x.year}</span>
              <span className="tj-mini-name tj-mini-wrap">
                <span
                  role="img"
                  aria-label={`${Math.round(x.newShare * 100)} percent new artists`}
                  style={{
                    display: 'block',
                    height: 8,
                    borderRadius: 4,
                    width: `${Math.max(2, Math.round(x.newShare * 100))}%`,
                    background: 'var(--color-green)',
                  }}
                />
                <em>{x.newArtists.toLocaleString('en-US')} artists first heard this year</em>
              </span>
              <span className="tj-mini-val">{Math.round(x.newShare * 100)}%</span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
