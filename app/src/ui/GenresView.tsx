import React from 'react';
import { layerPath, stackRows } from '../lib/streamArea';
import { filterToMonths, fmtMinutes, rangeMonthKeys, topTracks } from '../data/stats';
import type { MonthBucket, PlayAggregate } from '../data/types';
import { useAppStore } from '../state/store';
import { OptInGate } from './OptIn';
import { groupHue } from './theme';
import { Section } from './primitives';

const UNC = '__uncategorized__';
const STREAM_W = 960;
const STREAM_H = 240;
interface GroupRow {
  group: string;
  minutes: number;
  artists: Array<{ name: string; minutes: number; topTrack: string | null }>;
}

/**
 * Spectrum: the mix of what you listen to, and how it moves over time.
 * The stream shows each group's share of monthly minutes; the rows below
 * open to reveal the artists and songs behind a group. Groups are broad
 * buckets from MusicBrainz community tags - they are not a physical axis
 * and not measured sound. Unmatched minutes stay visibly uncategorized.
 */
export function GenresView({ months, aggs }: { months: MonthBucket[]; aggs: PlayAggregate[] }) {
  const genres = useAppStore((s) => s.genres);
  const genresAreDemo = useAppStore((s) => s.genresAreDemo);
  const matchState = useAppStore((s) => s.matchState);
  const source = useAppStore((s) => s.source);
  const range = useAppStore((s) => s.range);
  const month = useAppStore((s) => s.month);
  const setMonth = useAppStore((s) => s.setMonth);
  const setPlaying = useAppStore((s) => s.setPlaying);
  const [open, setOpen] = React.useState<string | null>(null);

  const rangeKeys = React.useMemo(() => rangeMonthKeys(months, range), [months, range]);
  const rangedMonths = React.useMemo(() => months.filter((m) => rangeKeys.has(m.key)), [months, rangeKeys]);
  const rangedAggs = React.useMemo(() => filterToMonths(aggs, rangeKeys), [aggs, rangeKeys]);
  const gated = source === 'export' && matchState === 'idle';

  /** Primary group per artist (first group wins, same rule as everywhere). */
  const primaryOf = React.useCallback(
    (artist: string): string | null => genres[artist]?.groups[0] ?? null,
    [genres],
  );

  // Stream series: per month, share of minutes per group.
  const layers = React.useMemo(() => {
    const groupSet = new Set<string>();
    const rows = rangedMonths.map((m) => {
      const rec: Record<string, number> = { month: m.key } as never;
      let total = 0;
      for (const a of aggs) {
        if (a.month !== m.key) continue;
        total += a.ms;
        const g = primaryOf(a.artist);
        if (g) {
          groupSet.add(g);
          rec[g] = (rec[g] ?? 0) + a.ms;
        } else rec[UNC] = (rec[UNC] ?? 0) + a.ms;
      }
      const t = Math.max(1, total);
      for (const k of Object.keys(rec)) if (k !== 'month') rec[k] = (rec[k] as number) / t;
      return rec;
    });
    const keys = [...groupSet];
    if (rows.some((r) => (r[UNC] as number) > 0)) keys.push(UNC);
    return stackRows(rows, keys);
  }, [rangedMonths, aggs, primaryOf]);

  // Group rows for browsing.
  const rows = React.useMemo((): GroupRow[] => {
    const byGroup = new Map<string, Map<string, number>>();
    const trackAgg = new Map<string, PlayAggregate[]>();
    for (const a of rangedAggs) {
      const g = primaryOf(a.artist) ?? UNC;
      if (!byGroup.has(g)) byGroup.set(g, new Map());
      const m = byGroup.get(g)!;
      m.set(a.artist, (m.get(a.artist) ?? 0) + a.ms / 60000);
      if (!trackAgg.has(a.artist)) trackAgg.set(a.artist, []);
      trackAgg.get(a.artist)!.push(a);
    }
    const out: GroupRow[] = [];
    for (const [group, artistMap] of byGroup) {
      const artists = [...artistMap.entries()]
        .map(([name, minutes]) => ({
          name,
          minutes,
          topTrack: topTracks(trackAgg.get(name) ?? [], 1)[0]?.name ?? null,
        }))
        .sort((a, b) => b.minutes - a.minutes);
      out.push({ group, minutes: artists.reduce((s, a) => s + a.minutes, 0), artists });
    }
    out.sort((a, b) => (a.group === UNC ? 1 : b.group === UNC ? -1 : b.minutes - a.minutes));
    return out;
  }, [rangedAggs, primaryOf]);

  const totalMin = rows.reduce((s, r) => s + r.minutes, 0);
  const curKey = month ?? months[months.length - 1]?.key;
  const xs = rangedMonths.map((_, i) =>
    rangedMonths.length <= 1 ? STREAM_W / 2 : (i / (rangedMonths.length - 1)) * STREAM_W,
  );

  const swatch = (g: string) => (g === UNC ? undefined : `hsl(${groupHue(g)} 60% 52%)`);

  return (
    <>
      {source === 'export' && <OptInGate what="Genre lookup" />}

      <Section
        id="tj-stream-h"
        title={'How the mix moves'}
        aside={<>Share of each month&apos;s minutes{genresAreDemo ? ' - demo' : ''}</>}
      >
        {gated ? (
          <p className="tj-note">Enable the lookup above to see your genre mix.</p>
        ) : (
          <>
            <svg
              className="tj-stream"
              viewBox={`0 0 ${STREAM_W} ${STREAM_H}`}
              role="img"
              aria-label="Stream of genre share per month"
            >
              {layers.map((layer) => {
                const g = layer.key;
                const d = layerPath(layer.points, xs, STREAM_H);
                return g === UNC ? (
                  <path key={g} d={d} fill="url(#tj-hatch)" opacity={0.85} />
                ) : (
                  <path key={g} d={d} fill={swatch(g)} opacity={0.92} />
                );
              })}
              <defs>
                <pattern
                  id="tj-hatch"
                  width="7"
                  height="7"
                  patternTransform="rotate(45)"
                  patternUnits="userSpaceOnUse"
                >
                  <rect width="7" height="7" fill="#26262b" />
                  <rect width="3" height="7" fill="#3d3d44" />
                </pattern>
              </defs>
              {rangedMonths.map((m, i) => (
                <rect
                  key={m.key}
                  className={'tj-stream-month' + (m.key === curKey ? ' is-sel' : '')}
                  x={(i / Math.max(1, rangedMonths.length)) * STREAM_W + 1}
                  y={1}
                  width={STREAM_W / Math.max(1, rangedMonths.length) - 2}
                  height={STREAM_H - 2}
                  rx={3}
                  fill="transparent"
                  tabIndex={m.key === curKey ? 0 : -1}
                  data-month={m.key}
                  role="button"
                  aria-label={`Scrub to ${m.label}. Arrow keys move between months.`}
                  onClick={() => {
                    setMonth(m.key);
                    setPlaying(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setMonth(m.key);
                      setPlaying(false);
                      return;
                    }
                    const dir =
                      e.key === 'ArrowRight' || e.key === 'ArrowDown'
                        ? 1
                        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
                          ? -1
                          : 0;
                    if (dir !== 0) {
                      e.preventDefault();
                      const ni = Math.min(rangedMonths.length - 1, Math.max(0, i + dir));
                      const nm = rangedMonths[ni];
                      if (nm) {
                        setMonth(nm.key);
                        setPlaying(false);
                        requestAnimationFrame(() => {
                          e.currentTarget.ownerSVGElement
                            ?.querySelector<SVGRectElement>(`[data-month="${nm.key}"]`)
                            ?.focus();
                        });
                      }
                    }
                  }}
                />
              ))}
            </svg>
            <div className="tj-chart-x">
              <span>{rangedMonths[0]?.label}</span>
              <span>{rangedMonths[rangedMonths.length - 1]?.label}</span>
            </div>
            <div className="tj-stream-legend">
              {layers.map((l) => (
                <span key={`lg-${l.key}`}>
                  {l.key === UNC ? (
                    <i
                      className="tj-spectrum-swatch"
                      style={{
                        background: 'repeating-linear-gradient(45deg, #3d3d44 0 3px, #26262b 3px 6px)',
                      }}
                    />
                  ) : (
                    <i className="tj-spectrum-swatch" style={{ background: swatch(l.key) }} />
                  )}
                  {l.key === UNC ? 'Uncategorized' : l.key}
                </span>
              ))}
            </div>
            <p className="tj-note">
              Tap a month to scrub the whole app there. The stream shows shares, not loudness or mood - genre
              tags are metadata, not measured sound.
            </p>
          </>
        )}
      </Section>

      {!gated && (
        <Section
          id="tj-browse-h"
          title={'Browse the mix'}
          aside={<>{fmtMinutes(totalMin)} in the current range</>}
        >
          <div>
            {rows.map((r) => {
              const isOpen = open === r.group;
              const share = Math.round((r.minutes / Math.max(1, totalMin)) * 100);
              return (
                <div key={r.group} className="tj-spectrum-row">
                  <button
                    type="button"
                    className="tj-spectrum-btn"
                    aria-expanded={isOpen}
                    onClick={() => setOpen(isOpen ? null : r.group)}
                  >
                    {r.group === UNC ? (
                      <span
                        className="tj-spectrum-swatch"
                        style={{
                          background: 'repeating-linear-gradient(45deg, #3d3d44 0 3px, #26262b 3px 6px)',
                        }}
                      />
                    ) : (
                      <span className="tj-spectrum-swatch" style={{ background: swatch(r.group) }} />
                    )}
                    <span className="tj-spectrum-name">{r.group === UNC ? 'Uncategorized' : r.group}</span>{' '}
                    <span className="tj-spectrum-share">
                      {share}% - {fmtMinutes(r.minutes)}
                    </span>
                    <span className="tj-spectrum-caret" aria-hidden="true">
                      &#9656;
                    </span>
                  </button>
                  {isOpen && (
                    <div className="tj-spectrum-detail">
                      <ol className="tj-mini">
                        {r.artists.slice(0, 10).map((a, i) => (
                          <li key={a.name}>
                            <span className="tj-rank">{i + 1}</span>
                            <span className="tj-mini-name">
                              {a.name}
                              {a.topTrack && <em>most played: {a.topTrack}</em>}
                            </span>
                            <span className="tj-mini-val">{fmtMinutes(a.minutes)}</span>
                          </li>
                        ))}
                      </ol>
                      {r.group === UNC && (
                        <p className="tj-note">
                          No genre metadata match - left here on purpose, never guessed.
                          {genresAreDemo ? ' Demo data keeps one artist here deliberately.' : ''}
                        </p>
                      )}
                      {r.artists.length > 10 && (
                        <p className="tj-note">Showing the 10 most played of {r.artists.length} artists.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="tj-note">
            {genresAreDemo
              ? 'Demo genres are invented. With a real export, groups come from MusicBrainz community tags (CC BY-NC-SA, credited), matched per artist name only.'
              : 'Groups come from MusicBrainz community tags (CC BY-NC-SA), matched per artist name only. An artist sits under their first matching group.'}
          </p>
        </Section>
      )}
    </>
  );
}
