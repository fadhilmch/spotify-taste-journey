import React from 'react';
import {
  discoveries,
  fmtMinutes,
  hourHistogram,
  mixStats,
  monthLabel,
  sessions,
  skipStats,
  weekdayHistogram,
} from '../data/stats';
import type { MonthBucket, PlayAggregate } from '../data/types';
import type { DiscoveryStats } from '../data/stats';
import { useAppStore } from '../state/store';
import { artistBackground } from './theme';
import { Card, CardAside } from './primitives';

const WEEKDAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function hourLabel(h: number): string {
  const from = h % 12 === 0 ? 12 : h % 12;
  const to = (h + 1) % 12 === 0 ? 12 : (h + 1) % 12;
  const ampm = h < 12 ? 'am' : 'pm';
  return `${from}-${to} ${ampm}`;
}

const CLOCK_C = 120;
const CLOCK_R0 = 46;
const CLOCK_R1 = 104;

function clockPolar(r: number, hourFrac: number): [number, number] {
  const rad = ((hourFrac / 24) * 360 - 90) * (Math.PI / 180);
  return [CLOCK_C + r * Math.cos(rad), CLOCK_C + r * Math.sin(rad)];
}

/** Annular sector for one hour on the dial, radius scaled by minutes. */
function clockWedge(h: number, rOut: number): string {
  const gap = 0.035;
  const a0 = h + gap;
  const a1 = h + 1 - gap;
  const [x0, y0] = clockPolar(rOut, a0);
  const [x1, y1] = clockPolar(rOut, a1);
  const [x2, y2] = clockPolar(CLOCK_R0, a1);
  const [x3, y3] = clockPolar(CLOCK_R0, a0);
  return `M${x0.toFixed(1)},${y0.toFixed(1)} A${rOut},${rOut} 0 0 1 ${x1.toFixed(1)},${y1.toFixed(1)} L${x2.toFixed(1)},${y2.toFixed(1)} A${CLOCK_R0},${CLOCK_R0} 0 0 0 ${x3.toFixed(1)},${y3.toFixed(1)} Z`;
}

function ClockDial({ hours, onScrub }: { hours: number[]; onScrub?: (h: number) => void }) {
  const [sel, setSel] = React.useState<number | null>(null);
  const max = Math.max(1, ...hours);
  const peak = hours.indexOf(max);
  const total = hours.reduce((a, b) => a + b, 0);
  const shown = sel ?? peak;
  return (
    <div className="tj-clock-wrap">
      <svg
        className="tj-clock"
        viewBox="0 0 240 240"
        role="img"
        aria-label="Listening clock: minutes per hour of day, midnight at top"
      >
        {hours.map((v, h) => {
          const rOut = CLOCK_R0 + (CLOCK_R1 - CLOCK_R0) * Math.sqrt(v / max);
          const isPeak = h === peak;
          const isSel = sel === h;
          return (
            <path
              key={`h-${h}`}
              d={clockWedge(h, v > 0 ? rOut : CLOCK_R0 + 4)}
              className={'tj-clock-wedge' + (isPeak ? ' is-peak' : '') + (isSel ? ' is-sel' : '')}
              style={{ opacity: v > 0 ? 0.3 + 0.7 * (v / max) : 0.12 }}
              tabIndex={h === shown ? 0 : -1}
              data-hour={h}
              role="button"
              aria-label={`${hourLabel(h)}: ${fmtMinutes(v)}. Arrow keys move between hours.`}
              onClick={() => {
                setSel(isSel ? null : h);
                onScrub?.(h);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSel(isSel ? null : h);
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
                  const nh = (h + dir + 24) % 24;
                  setSel(nh);
                  onScrub?.(nh);
                  requestAnimationFrame(() => {
                    e.currentTarget.ownerSVGElement
                      ?.querySelector<SVGPathElement>(`[data-hour="${nh}"]`)
                      ?.focus();
                  });
                }
              }}
            />
          );
        })}
        {[0, 6, 12, 18].map((h) => {
          const [x, y] = clockPolar(CLOCK_R1 + 12, h + 0.5);
          return (
            <text key={`t-${h}`} className="tj-clock-tick" x={x} y={y + 3}>
              {h}
            </text>
          );
        })}
        <text className="tj-clock-center" x={CLOCK_C} y={CLOCK_C - 10}>
          {hourLabel(shown)}
        </text>
        {sel === null ? (
          <text className="tj-clock-center tj-clock-sub" x={CLOCK_C} y={CLOCK_C + 10}>
            peak hour
          </text>
        ) : (
          <>
            <text className="tj-clock-center tj-clock-sub" x={CLOCK_C} y={CLOCK_C + 7}>
              {fmtMinutes(hours[shown])}
            </text>
            <text className="tj-clock-center tj-clock-sub" x={CLOCK_C} y={CLOCK_C + 21}>
              {Math.round((hours[shown] / Math.max(1, total)) * 100)}% of listening
            </text>
          </>
        )}
      </svg>
      <p className="tj-note">
        A whole day on one dial: midnight at the top, noon at the bottom, one wedge per hour. Longer wedges
        mean more minutes - square-root scaled so quiet hours stay visible. Tap an hour for its exact figures
        {sel !== null ? ` - ${hourLabel(sel)} selected` : ''}.
      </p>
    </div>
  );
}

function DiscoveryBars({ disc, allMonths }: { disc: DiscoveryStats; allMonths: string[] }) {
  const [sel, setSel] = React.useState<string | null>(null);
  const countOf = new Map(disc.byMonth.map((m) => [m.month, m.count]));
  // Continuous chronological axis: months with no first-listens stay visible as empty.
  const rows = allMonths.map((month) => ({ month, count: countOf.get(month) ?? 0 }));
  const max = Math.max(1, ...rows.map((m) => m.count));
  const selRow = disc.byMonthArtists.find((m) => m.month === sel) ?? null;
  const selCount = countOf.get(sel ?? '') ?? 0;
  // Label a readable subset of ticks, always with month + year so dates are unambiguous.
  const step = Math.max(1, Math.ceil(rows.length / 8));
  const tick = (month: string) => {
    const { short } = monthLabel(month);
    return `${short} '${month.slice(2, 4)}`;
  };
  return (
    <div className="tj-disc">
      <div className="tj-disc-bars" role="img" aria-label="New artists heard for the first time per month">
        {rows.map((m, i) => {
          const isSel = sel === m.month;
          const isPeak = m.count === max && m.count > 0;
          return (
            <button
              key={m.month}
              type="button"
              className={'tj-disc-col' + (isSel ? ' is-sel' : '')}
              aria-label={`${monthLabel(m.month).label}: ${m.count} new artist${m.count === 1 ? '' : 's'}`}
              aria-pressed={isSel}
              onClick={() => setSel(isSel ? null : m.month)}
            >
              <span className="tj-disc-val">{m.count > 0 && (isSel || isPeak) ? m.count : ''}</span>
              <span
                className={'tj-disc-bar' + (isPeak ? ' is-peak' : '')}
                style={{
                  height: `${Math.max(2, (m.count / max) * 100)}%`,
                  opacity: m.count > 0 ? 0.35 + 0.65 * (m.count / max) : 0.12,
                  animationDelay: `${Math.min(i, 30) * 18}ms`,
                }}
              />
              <span className="tj-disc-x">{i % step === 0 ? tick(m.month) : ''}</span>
            </button>
          );
        })}
      </div>
      {sel && (
        <div className="tj-disc-detail">
          <h4 className="tj-sub-h">
            {monthLabel(sel).label} - {selCount} first listen{selCount === 1 ? '' : 's'}
          </h4>
          {selRow && selCount > 0 ? (
            <>
              <ol className="tj-mini">
                {selRow.artists.slice(0, 5).map((a, i) => (
                  <li key={`d-${a}`}>
                    <span className="tj-rank">{i + 1}</span>
                    <span className="tj-thumb" style={{ background: artistBackground(a) }} />
                    <span className="tj-mini-name">{a}</span>
                  </li>
                ))}
              </ol>
              {selCount > Math.min(selRow.artists.length, 5) && (
                <p className="tj-note">
                  Plus {selCount - Math.min(selRow.artists.length, 5)} more first heard that month.
                </p>
              )}
            </>
          ) : (
            <p className="tj-note">No new artists arrived that month.</p>
          )}
        </div>
      )}
    </div>
  );
}

function MiniBars({
  values,
  labels,
  ariaLabel,
  highlightPeak,
}: {
  values: number[];
  labels: string[];
  ariaLabel: string;
  highlightPeak?: boolean;
}) {
  const max = Math.max(1, ...values);
  return (
    <div className="tj-minibars" role="img" aria-label={ariaLabel}>
      {values.map((v, i) => (
        <div key={labels[i]} className="tj-minibar-col">
          <div
            className={'tj-minibar' + (highlightPeak && v === max && v > 0 ? ' is-peak' : '')}
            style={{
              height: `${Math.max(3, (v / max) * 100)}%`,
              opacity: v > 0 ? 0.35 + 0.65 * (v / max) : 0.15,
              animationDelay: `${i * 30}ms`,
            }}
          />
          <span className="tj-minibar-x">{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}

export function StoryView({ months, aggs }: { months: MonthBucket[]; aggs: PlayAggregate[] }) {
  const events = useAppStore((s) => s.events);
  const setView = useAppStore((s) => s.setView);

  // Habits always cover all time: this page has no range chips, so it must not
  // silently follow a range picked on another page.
  const rangedEvents = events;

  const clock = hourHistogram(rangedEvents);
  const week = weekdayHistogram(rangedEvents);
  const peakHour = clock.indexOf(Math.max(...clock));
  const skips = skipStats(rangedEvents);
  const disc = discoveries(aggs);
  const sess = sessions(rangedEvents);
  const mix = mixStats(rangedEvents);

  return (
    <>
      <p className="tj-note">
        Artist chapters are in the Story.{' '}
        <button type="button" className="tj-linkbtn" onClick={() => setView('flow')}>
          Open the story
        </button>
      </p>

      <Card
        id="tj-clock-h"
        title="Listening clock"
        aside={<CardAside>{events.length > 0 ? `Peak: ${hourLabel(peakHour)}` : ''}</CardAside>}
      >
        {events.length > 0 ? (
          <>
            <ClockDial hours={clock} />
            <h4 className="tj-sub-h">By weekday</h4>
            <MiniBars values={week} labels={WEEKDAY} ariaLabel="Minutes per weekday" highlightPeak />
          </>
        ) : (
          <p className="tj-note">Per-play timestamps appear here once an export is loaded.</p>
        )}
      </Card>

      <Card
        id="tj-disc-h"
        title="Discoveries"
        aside={<CardAside>{disc.totalArtists} artists on record</CardAside>}
      >
        <DiscoveryBars disc={disc} allMonths={months.map((m) => m.key)} />
        <p className="tj-note">
          First-ever listens are counted across your full history, whatever range is picked above - empty
          months simply had no new artists. Tap a month to see who arrived then.
        </p>
        <ul className="tj-facts">
          <li>
            <strong>{disc.keepers}</strong> keepers - heard in at least three different months
          </li>
          <li>
            <strong>{disc.oneMonthWonders}</strong> one-month wonders - heard in a single month
          </li>
          {disc.latest.length > 0 && (
            <li>
              Latest first-listens:{' '}
              {disc.latest
                .slice(0, 3)
                .map((l) => l.artist)
                .join(', ')}
            </li>
          )}
        </ul>
      </Card>

      <Card
        id="tj-skip-h"
        title="Skips and sessions"
        aside={
          skips.hasFlags ? <CardAside>{Math.round(skips.rate * 100)}% of plays skipped</CardAside> : undefined
        }
      >
        {skips.hasFlags ? (
          <>
            {skips.byArtist.length > 0 && (
              <ol className="tj-mini">
                {skips.byArtist.slice(0, 3).map((a, i) => (
                  <li key={a.artist}>
                    <span className="tj-rank">{i + 1}</span>
                    <span className="tj-thumb" style={{ background: artistBackground(a.artist) }} />
                    <span className="tj-mini-name">{a.artist}</span>
                    <span className="tj-mini-val">{Math.round(a.skipRate * 100)}% skipped</span>
                  </li>
                ))}
              </ol>
            )}
            <p className="tj-note">
              Skipped is Spotify&apos;s own flag on each play; only artists with 20+ flagged plays are ranked.
            </p>
          </>
        ) : (
          <p className="tj-note">
            This file carries no skip flags (older exports don&apos;t), so skip stats stay blank rather than
            guessed.
          </p>
        )}
        {sess.count > 0 && (
          <ul className="tj-facts">
            <li>
              <strong>{sess.count.toLocaleString()}</strong> listening sessions (a gap of 30+ minutes splits
              them)
            </li>
            <li>
              Longest session: <strong>{fmtMinutes(sess.longestMin)}</strong> across{' '}
              <strong>{sess.activeDays.toLocaleString()}</strong> active days
            </li>
          </ul>
        )}
      </Card>

      {(mix.shuffleShare !== null || mix.platforms.length > 0) && (
        <Card id="tj-mix-h2" title="How you listened">
          <ul className="tj-facts">
            {mix.shuffleShare !== null && (
              <li>
                Shuffle on for <strong>{Math.round(mix.shuffleShare * 100)}%</strong> of flagged plays
              </li>
            )}
            {mix.offlineShare !== null && (
              <li>
                <strong>{Math.round(mix.offlineShare * 100)}%</strong> of flagged plays were offline
              </li>
            )}
            {mix.platforms.length > 0 && (
              <li>
                By minutes:{' '}
                {mix.platforms
                  .slice(0, 4)
                  .map((p) => `${p.name} ${Math.round(p.share * 100)}%`)
                  .join(' · ')}
              </li>
            )}
          </ul>
        </Card>
      )}

      <Card id="tj-narr-h" title="Narration - not enabled yet" className="border-dashed border-white/[0.14]!">
        <p className="tj-note">
          A narrator could turn these computed facts into written chapters and answers. Two routes are
          possible: a small model that runs inside this browser (free and private, but needs a multi-GB
          download and a recent device), or a hosted API (stronger writing, costs money, and sends only a
          computed fact sheet - never your raw export - to a third party). Neither is wired up. Nothing is
          downloaded, shared, or paid for from this app; choosing a route is a conversation, not a setting
          here.
        </p>
      </Card>
    </>
  );
}
