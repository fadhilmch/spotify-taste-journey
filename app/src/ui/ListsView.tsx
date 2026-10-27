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
  const setArtistChapter = useAppStore((s) => s.setArtistChapter);
  const setStoryFocus = useAppStore((s) => s.setStoryFocus);
  const facts = React.useMemo(() => artistFacts(aggs, artist), [aggs, artist]);
  const story = React.useMemo(() => buildNarrative(aggs), [aggs]);
  if (!facts) return null;
  const chapters = story ? story.beats.filter((b) => b.artists.includes(artist)) : [];
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
        {facts.ledYears.length > 0 && (
          <li>
            Played most of anyone in {facts.ledYears[0]}
            {facts.ledYears.length > 1 ? ` and ${facts.ledYears.length - 1} more year(s)` : ''}
          </li>
        )}
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
      {chapters.length > 0 && (
        <p className="tj-note">In the story: {chapters.map((b) => b.title).join('; ')}</p>
      )}
      <Button
        variant="ghost"
        onClick={() => {
          setArtistChapter(artist);
          setView('flow');
        }}
      >
        Open {artist} as a chapter
      </Button>
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
  // Years each artist was heard, over all history (not just the range), counted from plays.
  const span = React.useMemo(() => {
    const m = new Map<string, [string, string]>();
    for (const a of aggs) {
      const cur = m.get(a.artist);
      if (!cur) m.set(a.artist, [a.month, a.month]);
      else {
        if (a.month < cur[0]) cur[0] = a.month;
        if (a.month > cur[1]) cur[1] = a.month;
      }
    }
    return m;
  }, [aggs]);
  const years = (name: string) => {
    const r = span.get(name);
    if (!r) return '';
    const a = r[0].slice(0, 4);
    const b = r[1].slice(0, 4);
    return a === b ? ` · heard in ${a}` : ` · heard ${a} to ${b}`;
  };
  // Minutes per month for each artist over the whole history, so every tile's line shares one time axis.
  const series = React.useMemo(() => {
    const keys = months.map((m) => m.key);
    const pos = new Map(keys.map((k, i) => [k, i]));
    const out = new Map<string, number[]>();
    for (const a of aggs) {
      const i = pos.get(a.month);
      if (i === undefined) continue;
      let row = out.get(a.artist);
      if (!row) {
        row = new Array<number>(keys.length).fill(0);
        out.set(a.artist, row);
      }
      row[i] += a.ms / 60000;
    }
    return out;
  }, [aggs, months]);
  const spark = (name: string) => {
    const row = series.get(name);
    if (!row || row.length < 2) return null;
    const max = Math.max(1, ...row);
    const d = row
      .map(
        (v, k) =>
          `${k ? 'L' : 'M'}${((k * 100) / (row.length - 1)).toFixed(1)} ${(15 - (v / max) * 14).toFixed(1)}`,
      )
      .join(' ');
    return (
      <svg
        className="tj-tile-spark"
        viewBox="0 0 100 16"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Minutes per month for ${name}, whole history`}
      >
        <path d={d} vectorEffect="non-scaling-stroke" />
      </svg>
    );
  };
  const libraryArtist = useAppStore((st) => st.libraryArtist);
  const setLibraryArtist = useAppStore((st) => st.setLibraryArtist);
  const [picked, setPicked] = React.useState<string | null>(libraryArtist);
  React.useEffect(() => {
    if (libraryArtist) setLibraryArtist(null);
  }, [libraryArtist, setLibraryArtist]);
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
              <p className="tj-tile-sub">
                {fmtMinutes(t.minutes)}
                {years(t.name)}
              </p>
              {spark(t.name)}
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
  const setView = useAppStore((st) => st.setView);
  const setLibraryArtist = useAppStore((st) => st.setLibraryArtist);
  const openArtist = (name: string) => {
    setLibraryArtist(name);
    setView('artists');
  };
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
              <em>
                <button type="button" className="tj-linkbtn" onClick={() => openArtist(t.artist)}>
                  {t.artist}
                </button>
              </em>
            </span>
            <span className="tj-mini-val">{fmtMinutes(t.minutes)}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
}
