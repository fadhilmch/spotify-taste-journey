import React from 'react';
import {
  buildArtistBeat,
  buildHabitBeats,
  buildReturnedBeat,
  ORIGINS_BEAT,
  SHARE_BEAT,
  type HabitBeat,
} from '../data/habits';
import { buildNarrative, type Narrative } from '../data/narrative';
import type { PlayAggregate, PlayEvent } from '../data/types';
import { useAppStore } from '../state/store';
import { Button } from './primitives';

const COLORS = ['#1ed760', '#f5c451', '#7aa7ff'];
const W = 640;
const H = 300;
const PAD_X = 28;
const BASE = H - 34;
const TOP = 16;
const SLOTS = 3;
const DURATION = 950;

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function ease(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Smoothly move a numeric vector to its target. Jumps at once when motion is reduced. */
function useTween(target: number[], zeroIndex?: number): number[] {
  const [value, setValue] = React.useState<number[]>(target);
  const valueRef = React.useRef<number[]>(target);

  React.useEffect(() => {
    const to = target;
    const from = (valueRef.current.length === to.length ? valueRef.current : to).slice();
    // The headline number counts up from zero in each chapter, so a new unit never shows a value from the old one.
    if (zeroIndex !== undefined) from[zeroIndex] = 0;
    const reduced = prefersReducedMotion();
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = reduced ? 1 : Math.min(1, (now - start) / DURATION);
      const e = ease(t);
      const next = to.map((v, i) => from[i] + (v - from[i]) * e);
      valueRef.current = next;
      setValue(next);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return value;
}

function fmtBig(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

function HabitStage({ beat, chapter, total }: { beat: HabitBeat; chapter: number; total: number }) {
  const max = Math.max(1, ...beat.values);
  return (
    <div className="tj-flow-stage">
      <p className="sr-only" role="status">
        {beat.title}. {beat.big} {beat.unit}.
      </p>
      <p className="tj-flow-kicker">
        Chapter {chapter} of {total}
      </p>
      <p className="tj-flow-big">
        <span>{beat.big}</span> <small>{beat.unit}</small>
      </p>
      {beat.values.length > 0 && (
        <div className="tj-habit-bars" role="img" aria-label={`${beat.title}. ${beat.caption}`}>
          {beat.values.map((v, i) => (
            <div key={i} className="tj-habit-col">
              <div
                className={i === beat.peak ? 'tj-habit-bar peak' : 'tj-habit-bar'}
                style={{ height: `${Math.max(2, (v / max) * 100)}%` }}
              />
              <span className="tj-habit-lab">{beat.labels[i]}</span>
            </div>
          ))}
        </div>
      )}
      <p className="tj-flow-legend">
        <span>Counted from your play timestamps.</span>
      </p>
    </div>
  );
}

function Stage({ story, active, total }: { story: Narrative; active: number; total: number }) {
  const { years, beats, series } = story;
  const n = years.length;
  const beat = beats[active];
  const maxHpm = Math.max(1, ...years.map((y) => y.hoursPerMonth));
  const x = (k: number) => PAD_X + (k * (W - 2 * PAD_X)) / Math.max(1, n - 1);
  const y = (f: number) => BASE - f * (BASE - TOP);

  // Target vector: [from, to, big, alpha*3, line values*3*n]
  const target = React.useMemo(() => {
    const v: number[] = [beat.from, beat.to, beat.big];
    const names = beat.artists;
    const max = Math.max(1, ...names.flatMap((a) => series[a] ?? []));
    for (let s = 0; s < SLOTS; s += 1) v.push(names[s] ? 1 : 0);
    for (let s = 0; s < SLOTS; s += 1) {
      const vals = names[s] ? (series[names[s]] ?? []) : new Array<number>(n).fill(0);
      for (let k = 0; k < n; k += 1) v.push((vals[k] ?? 0) / max);
    }
    return v;
  }, [beat, series, n]);
  const cur = useTween(target, 2);
  const from = cur[0];
  const to = cur[1];
  const big = cur[2];

  return (
    <div className="tj-flow-stage">
      <p className="sr-only" role="status">
        {beat.title}. {beat.big.toLocaleString('en-US')} {beat.unit}.
      </p>
      <p className="tj-flow-kicker">
        Chapter {active + 1} of {total}
      </p>
      <p className="tj-flow-big">
        <span>{fmtBig(big)}</span> <small>{beat.unit}</small>
      </p>
      <svg
        className="tj-flow-chart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Hours per month by year, with ${beat.artists.join(' and ') || 'no artist'} highlighted. ${beat.title}.`}
      >
        <rect
          className="tj-flow-band"
          x={x(from) - 14}
          y={TOP - 8}
          width={Math.max(0, x(to) - x(from)) + 28}
          height={BASE - TOP + 12}
          rx={10}
        />
        {years.map((yr, k) => {
          const h = (yr.hoursPerMonth / maxHpm) * (BASE - TOP) * 0.55;
          return (
            <rect
              key={yr.year}
              className={yr.partial ? 'tj-flow-bar tj-flow-bar-partial' : 'tj-flow-bar'}
              x={x(k) - 11}
              y={BASE - h}
              width={22}
              height={h}
              rx={3}
            />
          );
        })}
        {years.map((yr, k) => (
          <text key={yr.year} className="tj-flow-ax" x={x(k)} y={H - 10} textAnchor="middle">
            {n > 8 && k % 2 === 1 && k !== n - 1 ? '' : yr.year.slice(n > 8 ? 2 : 0)}
            {yr.partial ? '*' : ''}
          </text>
        ))}
        {Array.from({ length: SLOTS }, (_, s) => {
          const base = 3 + SLOTS + s * n;
          const d = Array.from(
            { length: n },
            (_, k) => `${k ? 'L' : 'M'}${x(k).toFixed(1)} ${y(cur[base + k]).toFixed(1)}`,
          ).join(' ');
          const alpha = cur[3 + s];
          return (
            <g key={s} style={{ opacity: alpha }}>
              <path className="tj-flow-line" d={d} style={{ stroke: COLORS[s] }} />
              {Array.from({ length: n }, (_, k) => (
                <circle
                  key={k}
                  className="tj-flow-dot"
                  cx={x(k)}
                  cy={y(cur[base + k])}
                  r={k >= beat.from && k <= beat.to ? 4.5 : 0}
                  style={{ fill: COLORS[s] }}
                />
              ))}
            </g>
          );
        })}
      </svg>
      <p className="tj-flow-legend">
        {beat.artists.length === 0 ? (
          <span>Bars: average hours per month, by year. * marks a year the history only partly covers.</span>
        ) : (
          beat.artists.map((a, k) => (
            <span key={a}>
              <i style={{ background: COLORS[k] }} />
              {a}
            </span>
          ))
        )}
      </p>
    </div>
  );
}

function MonthStrip({
  aggs,
  years,
  from,
  to,
}: {
  aggs: PlayAggregate[];
  years: string[];
  from: number;
  to: number;
}) {
  const bars = React.useMemo(() => {
    const by = new Map<string, number>();
    for (const a of aggs) by.set(a.month, (by.get(a.month) ?? 0) + a.ms);
    const keys = [...by.keys()].sort();
    const max = Math.max(1, ...by.values());
    return keys.map((k) => ({ k, h: by.get(k)! / max }));
  }, [aggs]);
  const lo = years[from] ?? '';
  const hi = years[to] ?? '';
  const any = from >= 0 && to >= 0;
  return (
    <div
      className="tj-strip"
      role="img"
      aria-label="Minutes played in every month. The months of the current chapter are highlighted."
    >
      {bars.map((b) => (
        <i
          key={b.k}
          className={any && b.k.slice(0, 4) >= lo && b.k.slice(0, 4) <= hi ? 'on' : undefined}
          style={{ height: `${Math.max(4, b.h * 100)}%` }}
        />
      ))}
    </div>
  );
}

export function FlowView({ aggs, events }: { aggs: PlayAggregate[]; events: PlayEvent[] }) {
  const story = React.useMemo(() => buildNarrative(aggs), [aggs]);
  const artistChapter = useAppStore((st) => st.artistChapter);
  const extras = React.useMemo(() => {
    const list: HabitBeat[] = [...buildHabitBeats(events, aggs)];
    const ret = buildReturnedBeat(aggs);
    if (ret) list.push(ret);
    const art = artistChapter ? buildArtistBeat(aggs, artistChapter) : null;
    if (art) list.push(art);
    list.push(ORIGINS_BEAT, SHARE_BEAT);
    return list;
  }, [events, aggs, artistChapter]);
  const nStory = story ? story.beats.length : 0;
  const total = nStory + extras.length;
  const [active, setActive] = React.useState(0);
  const storyFocus = useAppStore((st) => st.storyFocus);
  const setLibraryArtist = useAppStore((st) => st.setLibraryArtist);
  const setStoryFocus = useAppStore((st) => st.setStoryFocus);
  const setShareFocus = useAppStore((st) => st.setShareFocus);
  const setView = useAppStore((st) => st.setView);
  const [playing, setPlaying] = React.useState(false);
  const sections = React.useRef<Array<HTMLElement | null>>([]);

  React.useEffect(() => {
    if (!story || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const i = Number((e.target as HTMLElement).dataset.beat);
            if (!Number.isNaN(i)) setActive(i);
          }
        }
      },
      { rootMargin: '-35% 0px -55% 0px', threshold: 0 },
    );
    sections.current.forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, [story, extras]);

  const goTo = React.useCallback((i: number, instant = false) => {
    sections.current[i]?.scrollIntoView({
      behavior: instant || prefersReducedMotion() ? 'auto' : 'smooth',
      block: 'center',
    });
  }, []);

  React.useEffect(() => {
    if (!playing || !story) return;
    const t = setInterval(() => {
      setActive((cur) => {
        if (cur >= total - 1) {
          setPlaying(false);
          return cur;
        }
        goTo(cur + 1);
        return cur;
      });
    }, 6500);
    return () => clearInterval(t);
  }, [playing, story, total, goTo]);

  React.useEffect(() => {
    if (!story || !storyFocus) return;
    const i = story.beats.findIndex((b) => b.artists.includes(storyFocus));
    setStoryFocus(null);
    if (i >= 0) setTimeout(() => goTo(i, true), 50);
  }, [story, storyFocus, goTo, setStoryFocus]);

  React.useEffect(() => {
    if (!story || !artistChapter) return;
    const i = extras.findIndex((b) => b.kind === 'artist');
    if (i < 0) return;
    const t = setTimeout(() => goTo(nStory + i, true), 80);
    return () => clearTimeout(t);
  }, [story, artistChapter, extras, nStory, goTo]);

  if (!story) return null;
  const chapters: Array<{ id: string; label: string }> = [...story.beats, ...extras];
  const cur = active < nStory ? story.beats[active] : null;
  const strip = cur ? { from: cur.from, to: cur.to } : { from: -1, to: -1 };
  const cardArtist = (() => {
    const last = [...story.beats].reverse().find((b) => b.artists.length > 0);
    const here = cur && cur.artists.length > 0 ? cur.artists[0] : null;
    return here ?? extras[active - nStory]?.artist ?? last?.artists[0] ?? null;
  })();
  return (
    <>
      <div className="tj-flow">
        <div className="tj-flow-left">
          <MonthStrip aggs={aggs} years={story.years.map((y) => y.year)} from={strip.from} to={strip.to} />
          {active < nStory ? (
            <Stage story={story} active={active} total={total} />
          ) : (
            <HabitStage beat={extras[active - nStory]} chapter={active + 1} total={total} />
          )}
          <div className="tj-flow-rail" role="group" aria-label="Chapters">
            {chapters.map((b, i) => (
              <button
                key={b.id}
                type="button"
                className={i === active ? 'tj-flow-pip on' : 'tj-flow-pip'}
                aria-current={i === active ? 'step' : undefined}
                onClick={() => {
                  setPlaying(false);
                  goTo(i);
                }}
              >
                <span className="tj-flow-pipdot" />
                {b.label}
              </button>
            ))}
            <Button
              variant="ghost"
              className="tj-flow-play"
              onClick={() => {
                if (!playing && active >= total - 1) goTo(0);
                setPlaying(!playing);
              }}
            >
              {playing ? 'Pause story' : 'Play story'}
            </Button>
          </div>
        </div>
        <ol className="tj-flow-chapters">
          {[...story.beats, ...extras].map((b, i) => {
            const x = i >= nStory ? extras[i - nStory] : null;
            return (
              <li
                key={b.id}
                ref={(el) => {
                  sections.current[i] = el;
                }}
                data-beat={i}
                className={i === active ? 'tj-flow-chapter on' : 'tj-flow-chapter'}
              >
                <h3>{b.title}</h3>
                {x?.kind === 'origins' ? (
                  <div className="tj-flow-notice">
                    <p>
                      <strong>What it sends:</strong> artist names only, one request each to MusicBrainz, a
                      public music database. No plays, dates or minutes. Results stay on this device. You can
                      skip it and nothing else changes.
                    </p>
                    <div className="tj-flow-links">
                      <Button onClick={() => setView('map')}>Add artist origins</Button>
                      <Button variant="ghost" onClick={() => goTo(i + 1)}>
                        Skip
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p>{b.caption}</p>
                )}
                {x?.kind === 'returned' && (
                  <div className="tj-flow-links">
                    <Button variant="ghost" onClick={() => setView('rediscover')}>
                      See who and when
                    </Button>
                  </div>
                )}
                {x?.kind === 'artist' && x.artist && (
                  <div className="tj-flow-links">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setLibraryArtist(x.artist ?? null);
                        setView('artists');
                      }}
                    >
                      Library: {x.artist}
                    </Button>
                  </div>
                )}
                {x?.kind === 'share' && (
                  <div className="tj-flow-links">
                    <Button
                      onClick={() => {
                        setShareFocus(cardArtist);
                        setView('share');
                      }}
                    >
                      Make a share card{cardArtist ? ` from ${cardArtist}` : ''}
                    </Button>
                  </div>
                )}
                {'artists' in b && b.artists.length > 0 && (
                  <div className="tj-flow-links">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setLibraryArtist(b.artists[0]);
                        setView('artists');
                      }}
                    >
                      Library: {b.artists[0]}
                    </Button>
                    <Button variant="ghost" onClick={() => setView('rediscover')}>
                      Go deeper: eras and new names
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </div>
      <div className="tj-flow-end">
        <div className="tj-flow-next" role="group" aria-label="Keep going">
          <p className="tj-flow-next-title">Keep going</p>
          <div className="tj-flow-next-links">
            <Button variant="ghost" onClick={() => setView('rediscover')}>
              Rediscover artists you left
            </Button>
            <Button variant="ghost" onClick={() => setView('journey')}>
              See every month
            </Button>
            <Button variant="ghost" onClick={() => setView('artists')}>
              Open your library
            </Button>
            <Button variant="ghost" onClick={() => setView('map')}>
              Where artists come from (optional)
            </Button>
            <Button variant="ghost" onClick={() => setView('share')}>
              Make a share card
            </Button>
          </div>
        </div>
        <p className="tj-note">
          Hours are minutes played divided by 60, summed from your plays. Chapters follow who led each year;
          nothing here says why your listening changed. Years marked * are partly covered.
        </p>
      </div>
    </>
  );
}
