import { describe, expect, it } from 'vitest';
import { act, render } from '@testing-library/react';
import { PlayerBar } from '../ui/PlayerBar';
import { buildMonths } from '../data/stats';
import { useAppStore } from '../state/store';
import type { PlayAggregate } from '../data/types';

const ag = (month: string, artist: string): PlayAggregate =>
  ({ month, artist, track: 't', album: 'a', ms: 9e6, plays: 1 }) as unknown as PlayAggregate;

const aggs = [ag('2024-01', 'A'), ag('2024-02', 'A'), ag('2024-03', 'B')];

describe('PlayerBar playback', () => {
  it('pauses when the bar leaves the page, so returning does not restart it', () => {
    const months = buildMonths(aggs);
    act(() => useAppStore.getState().setPlaying(true));
    const { unmount } = render(<PlayerBar months={months} aggs={aggs} />);
    expect(useAppStore.getState().playing).toBe(true);
    unmount();
    expect(useAppStore.getState().playing).toBe(false);
  });

  it('keeps playing across a re-render', () => {
    const months = buildMonths(aggs);
    act(() => useAppStore.getState().setPlaying(true));
    const { rerender, unmount } = render(<PlayerBar months={months} aggs={aggs} />);
    rerender(<PlayerBar months={months} aggs={aggs} />);
    expect(useAppStore.getState().playing).toBe(true);
    unmount();
  });
});
