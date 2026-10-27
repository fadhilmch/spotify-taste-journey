import { artistFacts } from '../data/artistFacts';
import React from 'react';
import { downloadShareCard, renderShareCard, type ShareCardData } from '../lib/shareCanvas';
import { artistEras, filterToMonths, genreMix, rangeMonthKeys, topArtists, topTracks } from '../data/stats';
import type { MonthBucket, PlayAggregate } from '../data/types';
import { useAppStore, type CardBits } from '../state/store';
import { Button, Card, CardAside, Checkbox } from './primitives';

export function ShareView({ months, aggs }: { months: MonthBucket[]; aggs: PlayAggregate[] }) {
  const range = useAppStore((s) => s.range);
  const source = useAppStore((s) => s.source);
  const genres = useAppStore((s) => s.genres);
  const shareFocus = useAppStore((s) => s.shareFocus);
  const cardBits = useAppStore((s) => s.cardBits);
  const toggleCardBit = useAppStore((s) => s.toggleCardBit);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [canvasError, setCanvasError] = React.useState<string | null>(null);

  const rangeLabel = { '4w': '4 weeks', '6m': '6 months', '1y': '1 year', all: 'All time' }[range] ?? range;
  const ranged = filterToMonths(aggs, rangeMonthKeys(months, range));
  const total = Math.round(ranged.reduce((s, a) => s + a.ms, 0) / 60000);
  const topArtist = topArtists(ranged, 1)[0] ?? null;
  const topTrack = topTracks(ranged, 1)[0] ?? null;
  const mix = genreMix(ranged, genres);
  const topGenre = mix.slices[0]?.group ?? null;
  const eraCount = artistEras(months, aggs).length;
  const hasMbGenres = Object.values(genres).some((g) => g.source === 'musicbrainz');

  const focusFacts = shareFocus ? artistFacts(aggs, shareFocus) : null;
  const data: ShareCardData = {
    rangeLabel,
    topArtist: topArtist?.name ?? null,
    focus: focusFacts
      ? {
          name: focusFacts.artist,
          minutes: focusFacts.minutes,
          firstMonth: focusFacts.firstMonth,
          lastMonth: focusFacts.lastMonth,
        }
      : null,
    topTrack: topTrack ? { name: topTrack.name, artist: topTrack.artist } : null,
    totalMinutes: total,
    topGenre,
    eraCount,
    sourceLabel: source === 'demo' ? 'demo data' : 'my Spotify export',
    genreCredit: hasMbGenres ? 'Genre data: MusicBrainz (CC BY-NC-SA)' : null,
  };

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      renderShareCard(canvas, data, { ...cardBits, genre: false });
      setCanvasError(null);
    } catch (err) {
      setCanvasError(err instanceof Error ? err.message : String(err));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, aggs, genres, cardBits, source, shareFocus]);

  return (
    <Card id="tj-share-h" title="Share card" aside={<CardAside>You pick what goes on it</CardAside>}>
      {shareFocus && (
        <p className="tj-note">
          Started from the chapter on {shareFocus}. The artist line covers that artist over all time. The
          lines under "Across all your listening" are whole-history figures.
        </p>
      )}
      <div className="tj-sharewrap">
        {canvasError ? (
          <p className="tj-note tj-note-error" role="alert">
            The card preview needs canvas support: {canvasError}
          </p>
        ) : (
          <canvas ref={canvasRef} className="tj-card-canvas" aria-label="Preview of the share card" />
        )}
        <div className="tj-cardopts">
          {(
            [
              ['artist', focusFacts ? 'Chapter artist' : 'Top artist'],
              ['track', 'Top track'],
              ['minutes', 'Minutes'],
              ['eras', 'Era count'],
            ] as Array<[keyof CardBits, string]>
          ).map(([k, label]) => (
            <Checkbox key={k} label={label} checked={cardBits[k]} onChange={() => toggleCardBit(k)} />
          ))}
          <Button
            disabled={!!canvasError}
            onClick={() => canvasRef.current && downloadShareCard(canvasRef.current, 'taste-journey.png')}
          >
            Download PNG
          </Button>
          <p className="tj-note">
            The card is drawn on your device and saved as a PNG for iMessage, Instagram stories, wherever.
            Nothing is posted for you, and your raw history never appears on it.
          </p>
        </div>
      </div>
    </Card>
  );
}
