import React from 'react';
import { artistFacts } from '../data/artistFacts';
import { buildNarrative } from '../data/narrative';
import { filterToMonths, fmtMinutes, rangeMonthKeys, topArtists, topTracks } from '../data/stats';
import type { MonthBucket, PlayAggregate } from '../data/types';
import { useAppStore } from '../state/store';
import { artistBackground } from './theme';
import { Button, Card, CardAside } from './primitives';

function ArtistPanel({ aggs, artist }: { aggs: PlayAggregate[]; artist: string }) {
  const setView = useAppStore((s) => s.setView);
  const setStoryFocus = useAppStore((s) => s.setStoryFocus);
  const facts = React.useMemo(() => artistFacts(aggs, artist), [aggs, artist]);
  const story = React.useMemo(() => buildNarrative(aggs), [aggs]);
  if (!facts) return null;
  const inStory = !!story && story.beats.some((b) => b.artists.includes(artist));
  const max = Math.max(1, ...facts.monthly.map((m) => m.minutes));
  const n = facts.monthly.length;
  const d = facts.monthly
    .map(
      (m, k) =>
        `${k ? 'L' : 'M'}${((k * 300) / Math.max(1, n - 1)).toFixed(1)} ${(46 - (m.minutes / max) * 44).toFixed(1)}`,
    )
    .join(' ');
  return (
    <section className="tj-artist-panel" aria-label={`About ${artist}`}>
      <h3>{artist}</h3>
      <ul className="tj-artist-facts">
        <li>{facts.minutes.toLocaleString('en-US')} minutes played in total</li>
        <li>
          First heard {facts.firstMonth}, last heard {facts.lastMonth}
        </li>
        <li>
          Biggest year {facts.peakYear}, {facts.peakYearMinutes.toLocaleString('en-US')} minutes
        </li>
      </ul>
      <svg
        className="tj-spark"
        viewBox="0 0 300 48"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Minutes per month for ${artist}`}
      >
        <path d={d} />
      </svg>
      {inStory ? (
        <Button
          variant="ghost"
          onClick={() => {
            setStoryFocus(artist);
            setView('flow');
          }}
        >
          Open in the story
        </Button>
      ) : (
        <p className="tj-note">This artist does not lead a chapter of the story.</p>
      )}
    </section>
  );
}

export function ArtistsView({ months, aggs }: { months: MonthBucket[]; aggs: PlayAggregate[] }) {
  const range = useAppStore((s) => s.range);
  const source = useAppStore((s) => s.source);
  const ranged = filterToMonths(aggs, rangeMonthKeys(months, range));
  const artists = topArtists(ranged, 12);
  const [picked, setPicked] = React.useState<string | null>(null);
  const rangeLabel = { '4w': '4 weeks', '6m': '6 months', '1y': '1 year', all: 'All time' }[range] ?? range;

  return (
    <Card
      id="tj-artists-h"
      title="Top artists"
      aside={
        <CardAside>
          {rangeLabel}
          {source === 'demo' ? ' - demo' : ''}
        </CardAside>
      }
    >
      <div className="tj-grid">
        {artists.map((t, i) => (
          <div key={t.name} className="tj-tile">
            <button
              type="button"
              className="tj-tile-btn"
              aria-pressed={picked === t.name}
              onClick={() => setPicked(picked === t.name ? null : t.name)}
            >
              <div className="tj-tile-art" style={{ background: artistBackground(t.name) }} />
              <p className="tj-tile-name">
                {i + 1}. {t.name}
              </p>
              <p className="tj-tile-sub">{fmtMinutes(t.minutes)}</p>
            </button>
          </div>
        ))}
      </div>
      {picked && <ArtistPanel aggs={aggs} artist={picked} />}
    </Card>
  );
}

export function TracksView({ months, aggs }: { months: MonthBucket[]; aggs: PlayAggregate[] }) {
  const range = useAppStore((s) => s.range);
  const source = useAppStore((s) => s.source);
  const ranged = filterToMonths(aggs, rangeMonthKeys(months, range));
  const tracks = topTracks(ranged, 10);
  const rangeLabel = { '4w': '4 weeks', '6m': '6 months', '1y': '1 year', all: 'All time' }[range] ?? range;

  return (
    <Card
      id="tj-tracks-h"
      title="Top tracks"
      aside={
        <CardAside>
          {rangeLabel}
          {source === 'demo' ? ' - demo' : ''}
        </CardAside>
      }
    >
      <ol className="tj-mini tj-tracks">
        {tracks.map((t, i) => (
          <li key={t.artist + t.name}>
            <span className="tj-rank">{i + 1}</span>
            <span className="tj-thumb" style={{ background: artistBackground(t.artist) }} />
            <span className="tj-mini-name">
              {t.name}
              <em>{t.artist}</em>
            </span>
            <span className="tj-mini-val">{fmtMinutes(t.minutes)}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
}
