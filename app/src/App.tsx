import React from 'react';
import { buildMonths, filterToMonths, rangeMonthKeys } from './data/stats';
import { NEXT_STEP, takeaway } from './data/takeaways';
import type { View } from './data/types';
import { useAppStore } from './state/store';
import { RediscoverView } from './ui/RediscoverView';
import { ArtistsView, TracksView } from './ui/ListsView';
import { GenresView } from './ui/GenresView';
import { FlowView } from './ui/FlowView';
import { GuideView } from './ui/GuideView';
import { MethodView } from './ui/MethodView';
import { JourneyView } from './ui/JourneyView';
import { MapView } from './ui/MapView';
import { PlayerBar } from './ui/PlayerBar';
import { Chip, Tab } from './ui/primitives';
import { DataMeta } from './ui/DataMeta';
import { StoryLead, StoryNext } from './ui/StoryLead';
import { ShareView } from './ui/ShareView';
import { SourceBar } from './ui/SourceBar';
import { StoryView } from './ui/StoryView';
import { ErrorState, LoadingState, Onboarding } from './ui/states';

const RANGES = [
  { id: '4w', label: 'Last month' },
  { id: '6m', label: '6 months' },
  { id: '1y', label: '1 year' },
  { id: 'all', label: 'All time' },
];

/** Four places to be. Story is the spine; Explore and Library hold the rest. */
type SectionId = 'story' | 'explore' | 'library' | 'share' | 'about';
const SECTIONS: Array<{ id: SectionId; label: string; views: Array<[View, string]> }> = [
  { id: 'story', label: 'Story', views: [['flow', 'Story']] },
  {
    id: 'explore',
    label: 'Explore',
    views: [
      ['rediscover', 'Rediscover'],
      ['journey', 'Month by month'],
      ['story', 'Habits'],
      ['map', 'World'],
      ['genres', 'Spectrum'],
    ],
  },
  {
    id: 'library',
    label: 'Library',
    views: [
      ['artists', 'Artists'],
      ['tracks', 'Tracks'],
    ],
  },
  { id: 'share', label: 'Share', views: [['share', 'Share']] },
  {
    id: 'about',
    label: 'About',
    views: [
      ['guide', 'Get your export'],
      ['method', 'How this is counted'],
    ],
  },
];

const sectionOf = (v: View) => SECTIONS.find((s) => s.views.some(([id]) => id === v)) ?? SECTIONS[0];

/** Pages that read the month picked in the player bar. */
const PLAYER_VIEWS: ReadonlySet<View> = new Set<View>(['journey', 'genres']);

/** Pages that need no loaded data. */
const STATIC_VIEWS: ReadonlySet<View> = new Set<View>(['guide', 'method']);

/** Only these views change with the time-range chips; hide the chips elsewhere. */
const RANGE_VIEWS: ReadonlySet<View> = new Set<View>([
  'journey',
  'map',
  'genres',
  'artists',
  'tracks',
  'share',
]);

/** One honest line per view - editorial headers instead of filler cards. */
const VIEW_HEADS: Partial<Record<View, { title: string; blurb: string }>> = {
  flow: {
    title: 'Your listening, as one story',
    blurb: 'Scroll through the years: who led, who came back, and the quiet stretches.',
  },
  rediscover: {
    title: 'Rediscover your music',
    blurb:
      'Artists you played a lot and left, your top artists year by year, and how much you explore. Covers all your years.',
  },
  journey: {
    title: 'Your listening, month by month',
    blurb: 'Minutes over time, who led each month, and the eras between them.',
  },
  story: {
    title: 'Your habits and discoveries',
    blurb: 'When you listen, how you start and skip, sessions, loops and new artists. Covers all your years.',
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
  const events = useAppStore((s) => s.events);
  const clearError = useAppStore((s) => s.clearError);
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);
  const range = useAppStore((s) => s.range);
  const setRange = useAppStore((s) => s.setRange);

  const genres = useAppStore((s) => s.genres);
  const section = sectionOf(view);
  // Sub-page chips for sections with more than one page (Explore, Library, About).
  const sectionChips = section.views.length > 1 && (
    <div className="tj-ranges" role="group" aria-label={`${section.label} views`}>
      {section.views.map(([id, label]) => (
        <Chip key={id} on={view === id} onClick={() => setView(id)}>
          {label}
        </Chip>
      ))}
    </div>
  );
  const leadText = React.useMemo(() => {
    const ranged = RANGE_VIEWS.has(view)
      ? filterToMonths(aggregates, rangeMonthKeys(buildMonths(aggregates), range))
      : aggregates;
    return takeaway(view, ranged, buildMonths(aggregates), genres).lead;
  }, [view, range, aggregates, genres]);
  const months = React.useMemo(() => buildMonths(aggregates), [aggregates]);

  return (
    <div className="tj">
      <div className="tj-chrome">
        <div className="tj-side">
          <p className="tj-brand">Taste Journey</p>
          <nav className="tj-nav" aria-label="Sections">
            {SECTIONS.map((sec) => (
              <Tab
                key={sec.id}
                on={section.id === sec.id}
                onClick={() => section.id !== sec.id && setView(sec.views[0][0])}
              >
                {sec.label}
              </Tab>
            ))}
          </nav>
          {source === 'demo' && <p className="tj-demo-pill">Demo data</p>}
        </div>

        <div className="tj-main">
          {(source !== null || STATIC_VIEWS.has(view)) && <SourceBar />}

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

          {!loading && !error && STATIC_VIEWS.has(view) && sectionChips}
          {!loading && !error && view === 'guide' && <GuideView />}
          {!loading && !error && view === 'method' && <MethodView />}

          {!loading && !error && !STATIC_VIEWS.has(view) && source === null && <Onboarding />}

          {!loading && !error && !STATIC_VIEWS.has(view) && source !== null && aggregates.length > 0 && (
            <>
              <DataMeta />
              {sectionChips}
              {RANGE_VIEWS.has(view) && (
                <div className="tj-ranges" role="group" aria-label="Time range">
                  {RANGES.map((r) => (
                    <Chip key={r.id} on={range === r.id} onClick={() => setRange(r.id)}>
                      {r.label}
                    </Chip>
                  ))}
                </div>
              )}
              {VIEW_HEADS[view] && (
                <header className="tj-viewhead">
                  <h2>{VIEW_HEADS[view]!.title}</h2>
                  <p>{VIEW_HEADS[view]!.blurb}</p>
                </header>
              )}
              {view !== 'flow' && leadText && <StoryLead key={view + range} text={leadText} />}
              <div className="tj-viewbody" key={view}>
                {view === 'flow' && <FlowView aggs={aggregates} events={events} />}
                {view === 'rediscover' && <RediscoverView aggs={aggregates} />}
                {view === 'journey' && <JourneyView months={months} aggs={aggregates} />}
                {view === 'story' && <StoryView months={months} aggs={aggregates} />}
                {view === 'map' && <MapView months={months} aggs={aggregates} />}
                {view === 'genres' && <GenresView months={months} aggs={aggregates} />}
                {view === 'artists' && <ArtistsView months={months} aggs={aggregates} />}
                {view === 'tracks' && <TracksView months={months} aggs={aggregates} />}
                {view === 'share' && <ShareView months={months} aggs={aggregates} />}
              </div>
              {NEXT_STEP[view] && (
                <StoryNext
                  question={NEXT_STEP[view]!.question}
                  action={NEXT_STEP[view]!.action}
                  onGo={() => {
                    setView(NEXT_STEP[view]!.to);
                    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                    window.scrollTo({ top: 0, behavior: calm ? 'auto' : 'smooth' });
                  }}
                />
              )}
            </>
          )}
        </div>
      </div>

      {source !== null && aggregates.length > 0 && PLAYER_VIEWS.has(view) && (
        <PlayerBar months={months} aggs={aggregates} />
      )}
    </div>
  );
}
