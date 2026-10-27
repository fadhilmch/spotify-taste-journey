import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { useAppStore } from '../state/store';

describe('App', () => {
  it('starts empty, then loads the demo and switches views', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByText(/Your listening, turned into a journey/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Try the demo journey' }));
    expect(screen.getAllByText(/invented demo data/i).length).toBeGreaterThan(0);
    // The story flow is the first view: one chapter-by-chapter scroll.
    expect(screen.getByText('Your listening, as one story')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Play story/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Explore' }));
    await user.click(screen.getByRole('button', { name: 'Month by month' }));
    expect(screen.getByRole('img', { name: /Monthly listening minutes/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Spectrum' }));
    expect(screen.getByRole('img', { name: /Stream of genre share per month/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Uncategorized/i).length).toBeGreaterThan(0);
    // Legend adjacent to the stream names every group.
    expect(screen.getAllByText(/Folk & acoustic/i).length).toBeGreaterThan(0);
    // Browse the mix: open a group to reveal its artists.
    await user.click(screen.getByRole('button', { name: /Uncategorized \d+% - /i }));
    expect(screen.getByText(/never guessed/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Library' }));
    expect(screen.getByText('Top artists')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Tracks' }));
    expect(screen.getByText('Top tracks')).toBeInTheDocument();

    expect(useAppStore.getState().source).toBe('demo');
    expect(useAppStore.getState().genresAreDemo).toBe(true);
  });

  it('renders the Story and Map views on demo data', async () => {
    useAppStore.getState().reset();
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Try the demo journey' }));

    await user.click(screen.getByRole('button', { name: 'Explore' }));
    await user.click(screen.getByRole('button', { name: 'Habits' }));
    expect(screen.getByText('Your habits and discoveries')).toBeInTheDocument();
    expect(screen.getAllByText(/First obsession/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Listening clock/i)).toBeInTheDocument();
    // Listening clock: a 24-hour dial; selecting an hour shows its share.
    expect(
      screen.getByRole('img', { name: /Listening clock: minutes per hour of day/i }),
    ).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: /am: |pm: /i })[0]);
    expect(screen.getByText(/% of listening/i)).toBeInTheDocument();
    // Discoveries: tapping a month reveals the artists first heard then.
    await user.click(screen.getAllByRole('button', { name: /[1-9]\d* new artist/i })[0]);
    expect(screen.getByText(/first listen/i)).toBeInTheDocument();
    expect(screen.getByText(/Narration - not enabled yet/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'World' }));
    expect(
      screen.getByRole('img', { name: /World map with one pin per artist origin country/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Where your music comes from/i)).toBeInTheDocument();
    expect(screen.getByText(/never where you listened/i)).toBeInTheDocument();
    expect(screen.getByText(/no origin on record/i)).toBeInTheDocument();
    // List alternative to the map pins, with accessible country rows.
    const list = screen.getByRole('list', { name: /Origins by country/i });
    await user.click(within(list).getByRole('button', { name: /^Indonesia/ }));
    expect(screen.getAllByText(/Senja Radio/i).length).toBeGreaterThan(0);
  });

  it('shows the import guide from the empty state and the nav', async () => {
    useAppStore.getState().reset();
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'How to get your Spotify export' }));
    expect(useAppStore.getState().view).toBe('guide');
    expect(screen.getByText('Bring your listening history')).toBeInTheDocument();
    expect(screen.getByText('Pick Extended streaming history')).toBeInTheDocument();
    expect(screen.getByText(/read in this tab and never uploaded/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Understanding your data/i })).toHaveAttribute(
      'href',
      'https://support.spotify.com/us/article/understanding-your-data/',
    );

    await user.click(screen.getByRole('button', { name: 'Demo data' }));
    await user.click(screen.getByRole('button', { name: 'Guide' }));
    expect(screen.getByText('How to get your export')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /Monthly listening minutes/i })).not.toBeInTheDocument();
    useAppStore.getState().setView('journey');
  });

  it('switches time ranges', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Demo data' }));
    await user.click(screen.getByRole('button', { name: '6 months' }));
    expect(useAppStore.getState().range).toBe('6m');
  });

  it('shows time-range chips only on views they filter', async () => {
    const user = userEvent.setup();
    useAppStore.getState().setView('flow');
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Demo data' }));
    expect(screen.queryByRole('button', { name: '6 months' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Explore' }));
    expect(screen.getByText('Worth coming back to')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '6 months' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Month by month' }));
    expect(screen.getByRole('button', { name: '6 months' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Library' }));
    expect(screen.getByRole('button', { name: '6 months' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Share' }));
    expect(screen.queryByRole('button', { name: '6 months' })).not.toBeInTheDocument();
  });

  it('ends the story with links into the rest of the app', async () => {
    const user = userEvent.setup();
    useAppStore.getState().setView('flow');
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Demo data' }));
    await user.click(screen.getByRole('button', { name: 'Rediscover artists you left' }));
    expect(useAppStore.getState().view).toBe('rediscover');
    expect(screen.getByRole('button', { name: 'Rediscover' })).toHaveAttribute('aria-pressed', 'true');
  });
  it('shows full four-digit years on the rediscover cards', async () => {
    const user = userEvent.setup();
    useAppStore.getState().setView('flow');
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Demo data' }));
    await user.click(screen.getByRole('button', { name: 'Rediscover artists you left' }));
    const years = document.querySelectorAll('.tj-year');
    expect(years.length).toBeGreaterThan(0);
    years.forEach((y) => expect(y.textContent).toMatch(/^\d{4}$/));
  });

  it('opens an artist panel from the library and jumps back into the story', async () => {
    const user = userEvent.setup();
    useAppStore.getState().setView('flow');
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Demo data' }));
    await user.click(screen.getByRole('button', { name: 'Library' }));
    await user.click(screen.getByRole('button', { name: 'Artists' }));
    const tile = document.querySelector('.tj-tile-btn') as HTMLElement;
    await user.click(tile);
    expect(document.querySelector('.tj-artist-panel')).not.toBeNull();
    expect(screen.getByText(/First heard/)).toBeInTheDocument();
  });

  it('adds habit chapters to the story when play events exist', async () => {
    const user = userEvent.setup();
    useAppStore.getState().setView('flow');
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Demo data' }));
    expect(screen.getByText('When you listen')).toBeInTheDocument();
  });

  it('links a story chapter to its artist in the library', async () => {
    const user = userEvent.setup();
    useAppStore.getState().setView('flow');
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Demo data' }));
    await user.click(screen.getAllByRole('button', { name: /^Library: / })[0]);
    expect(useAppStore.getState().view).toBe('artists');
    expect(document.querySelector('.tj-artist-panel')).not.toBeNull();
  });

  it('has a month strip, an optional origins step with a notice and Skip, and a contextual share chapter', async () => {
    const user = userEvent.setup();
    useAppStore.getState().setView('flow');
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Demo data' }));
    expect(document.querySelectorAll('.tj-strip i').length).toBeGreaterThan(10);
    expect(screen.getByText(/artist names only, one request each to MusicBrainz/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
    expect(screen.getByText('The story always uses all time.')).toBeInTheDocument();
    expect(screen.getAllByText('Locked until you add artist origins')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: /^Make a share card from / }));
    expect(useAppStore.getState().view).toBe('share');
    expect(useAppStore.getState().shareFocus).not.toBeNull();
  });

  it('opens an artist as a chapter from the library', async () => {
    const user = userEvent.setup();
    useAppStore.getState().setView('flow');
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Demo data' }));
    await user.click(screen.getByRole('button', { name: 'Library' }));
    await user.click(screen.getByRole('button', { name: 'Artists' }));
    await user.click(document.querySelector('.tj-tile-btn') as HTMLElement);
    await user.click(screen.getByRole('button', { name: /as a chapter$/ }));
    expect(useAppStore.getState().view).toBe('flow');
    expect(document.querySelector('[data-beat] .tj-flow-links')).not.toBeNull();
    expect(useAppStore.getState().artistChapter).not.toBeNull();
  });
});
