import React from 'react';
import { buildMonths } from './data/stats';
import { coverageLabel, looksLikePartialHistory } from './data/coverage';
import type { View } from './data/types';
import { useAppStore } from './state/store';
import { ArtistsView, TracksView } from './ui/ListsView';
import { GenresView } from './ui/GenresView';
import { FlowView } from './ui/FlowView';
import { GuideView } from './ui/GuideView';
import { JourneyView } from './ui/JourneyView';
import { MapView } from './ui/MapView';
import { PlayerBar } from './ui/PlayerBar';
import { Chip, Tab } from './ui/primitives';
import { ShareView } from './ui/ShareView';
import { SourceBar } from './ui/SourceBar';
import { StoryView } from './ui/StoryView';
import { ErrorState, LoadingState, Onboarding } from './ui/states';

const RANGES = [
  { id: '4w', label: '4 weeks' },
  { id: '6m', label: '6 months' },
  { id: '1y', label: '1 year' },
  { id: 'all', label: 'All time' },
];

const TABS: Array<[View, string]> = [
  ['flow', 'The story'],
  ['journey', 'Journey'],
  ['story', 'Story'],
  ['map', 'World'],
  ['genres', 'Spectrum'],
  ['artists', 'Artists'],
  ['tracks', 'Tracks'],
  ['share', 'Share'],
  ['guide', 'Guide'],
];

/** One honest line per view - editorial headers instead of filler cards. */
const VIEW_HEADS: Partial<Record<View, { title: string; blurb: string }>> = {
  flow: {
    title: 'Your listening, as one story',
    blurb:
      'Scroll through the years: who led, who came back, and the quiet stretches - all counted from your plays.',
  },
  journey: {
    title: 'Your listening, month by month',
    blurb: 'Minutes over time, who led each month, and the eras between them.',
  },
  story: {
    title: 'Your story in chapters',
    blurb: 'Eras, discoveries, sessions and habits - computed from your plays, nothing invented.',
  },
  share: {
    title: 'Share a card',
    blurb: 'A PNG drawn on this device. You choose what it shows; nothing is uploaded.',
  },
  map: {
    title: 'Travel the world through your music',
    blurb: 'Every artist you play comes from somewhere. Follow where your listening has taken you.',
  },
  genres: {
    title: 'Your genre spectrum',
    blurb: 'The mix of what you listen to, how it moves over time, and what sits inside each group.',
  },
};

export default function App() {
  const source = useAppStore((s) => s.source);
  const loading = useAppStore((s) => s.loading);
  const loadProgress = useAppStore((s) => s.loadProgress);
  const error = useAppStore((s) => s.error);
  const aggregates = useAppStore((s) => s.aggregates);
  const parseInfo = useAppStore((s) => s.parseInfo);
  const fileReports = useAppStore((s) => s.fileReports);
  const clearError = useAppStore((s) => s.clearError);
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);
  const range = useAppStore((s) => s.range);
  const setRange = useAppStore((s) => s.setRange);
  const month = useAppStore((s) => s.month);
  const setMonth = useAppStore((s) => s.setMonth);
  const playing = useAppStore((s) => s.playing);
  const setPlaying = useAppStore((s) => s.setPlaying);

  const months = React.useMemo(() => buildMonths(aggregates), [aggregates]);

  // Playback: advance the selected month on a timer.
  React.useEffect(() => {
    if (!playing || months.length === 0) return;
    const t = setInterval(() => {
      const idx = months.findIndex((m) => m.key === (month ?? months[months.length - 1].key));
      const cur = idx < 0 ? months.length - 1 : idx;
      if (cur >= months.length - 1) {
        setPlaying(false);
      } else {
        setMonth(months[cur + 1].key);
      }
    }, 900);
    return () => clearInterval(t);
  }, [playing, months, month, setMonth, setPlaying]);

  return (
    <div className="tj">
      <div className="tj-chrome">
        <div className="tj-side">
          <p className="tj-brand">Taste Journey</p>
          <nav className="tj-nav" aria-label="Views">
            {TABS.map(([id, label]) => (
              <Tab key={id} on={view === id} onClick={() => setView(id)}>
                {label}
              </Tab>
            ))}
          </nav>
          {source === 'demo' && <p className="tj-demo-pill">Demo data</p>}
        </div>

        <div className="tj-main">
          {(source !== null || view === 'guide') && <SourceBar />}

          {loading && (
            <LoadingState
              label={
                loadProgress && loadProgress.total > 1
                  ? `Reading your export in this tab - file ${loadProgress.done} of ${loadProgress.total}. Nothing is uploaded.`
                  : 'Reading your export in this tab - nothing is uploaded.'
              }
            />
          )}
          {error && (
            <ErrorState
              title="That file did not work"
              detail={
                error +
                (source !== null ? ' Nothing was replaced - the data you were viewing is still loaded.' : '')
              }
              onRetry={clearError}
              retryLabel={
                source === 'export'
                  ? 'Back to your export'
                  : source === 'demo'
                    ? 'Back to demo data'
                    : 'Back to start'
              }
            />
          )}

          {!loading && !error && view === 'guide' && <GuideView />}

          {!loading && !error && view !== 'guide' && source === null && <Onboarding />}

          {!loading && !error && view !== 'guide' && source !== null && aggregates.length > 0 && (
            <>
              {parseInfo && (
                <>
                  <p className="tj-note">
                    {parseInfo.eventCount.toLocaleString()} plays read
                    {parseInfo.files && parseInfo.files > 1 ? ` from ${parseInfo.files} history files` : ''}
                    {parseInfo.format
                      ? ` (${parseInfo.format === 'extended' ? 'extended' : 'legacy'} export)`
                      : ' (extended and legacy exports combined)'}
                    {parseInfo.skipped > 0
                      ? `, ${parseInfo.skipped.toLocaleString()} non-music or invalid rows skipped`
                      : ''}
                    {(parseInfo.duplicates ?? 0) > 0
                      ? `, ${parseInfo.duplicates!.toLocaleString()} duplicate rows merged`
                      : ''}
                    {(parseInfo.crossPackageDuplicates ?? 0) > 0
                      ? `, ${parseInfo.crossPackageDuplicates!.toLocaleString()} plays already in your extended history removed`
                      : ''}
                    .
                  </p>
                  {fileReports &&
                    (() => {
                      const notHistory = fileReports.filter((r) => r.status === 'not-history');
                      const unreadable = fileReports.filter((r) => r.status === 'unreadable');
                      const names = (list: typeof notHistory) =>
                        list
                          .slice(0, 4)
                          .map((r) => r.name)
                          .join(', ') + (list.length > 4 ? `, +${list.length - 4} more` : '');
                      return (
                        <>
                          {notHistory.length > 0 && (
                            <p className="tj-note">
                              {notHistory.length === 1
                                ? '1 file had no listening history and was skipped: '
                                : `${notHistory.length} files had no listening history and were skipped: `}
                              {names(notHistory)}.
                            </p>
                          )}
                          {unreadable.length > 0 && (
                            <p className="tj-note">
                              {unreadable.length === 1
                                ? '1 file could not be read as JSON and was skipped: '
                                : `${unreadable.length} files could not be read as JSON and were skipped: `}
                              {names(unreadable)}.
                            </p>
                          )}
                        </>
                      );
                    })()}
                  {parseInfo.firstTs && parseInfo.lastTs && (
                    <p className="tj-note">
                      Covers {coverageLabel(parseInfo.firstTs)} to {coverageLabel(parseInfo.lastTs)}.
                      {looksLikePartialHistory(parseInfo)
                        ? " This looks like Spotify's 1-year Account data export - request the Extended streaming history package for your full history (see the guide)."
                        : ''}
                    </p>
                  )}
                </>
              )}
              <div className="tj-ranges" role="group" aria-label="Time range">
                {RANGES.map((r) => (
                  <Chip key={r.id} on={range === r.id} onClick={() => setRange(r.id)}>
                    {r.label}
                  </Chip>
                ))}
              </div>
              {VIEW_HEADS[view] && (
                <header className="tj-viewhead">
                  <h2>{VIEW_HEADS[view]!.title}</h2>
                  <p>{VIEW_HEADS[view]!.blurb}</p>
                </header>
              )}
              {view === 'flow' && <FlowView aggs={aggregates} />}
              {view === 'journey' && <JourneyView months={months} aggs={aggregates} />}
              {view === 'story' && <StoryView months={months} aggs={aggregates} />}
              {view === 'map' && <MapView months={months} aggs={aggregates} />}
              {view === 'genres' && <GenresView months={months} aggs={aggregates} />}
              {view === 'artists' && <ArtistsView months={months} aggs={aggregates} />}
              {view === 'tracks' && <TracksView months={months} aggs={aggregates} />}
              {view === 'share' && <ShareView months={months} aggs={aggregates} />}
            </>
          )}
        </div>
      </div>

      {source !== null && aggregates.length > 0 && <PlayerBar months={months} aggs={aggregates} />}
    </div>
  );
}
