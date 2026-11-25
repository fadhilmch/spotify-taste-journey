import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OptInGate, estimateLookup } from '../ui/OptIn';
import { useAppStore } from '../state/store';
import type { PlayAggregate } from '../data/types';

describe('OptInGate estimate', () => {
  it('rounds the pacing to a readable duration', () => {
    expect(estimateLookup(3600)).toBe('roughly 1 hour');
    expect(estimateLookup(300)).toBe('roughly 5 minutes');
    expect(estimateLookup(10000)).toBe('roughly 3 hours');
  });

  it('shows the artist count and time for the loaded library', () => {
    useAppStore.getState().reset();
    const aggregates = Array.from({ length: 3600 }, (_, i) => ({ artist: `Artist ${i}` }) as PlayAggregate);
    useAppStore.setState({ aggregates, matchState: 'idle' });
    render(<OptInGate what="Genres" plural />);
    const note = screen.getByTestId('optin-estimate');
    expect(note.textContent).toContain('About 3,600 artists');
    expect(note.textContent).toContain('roughly 1 hour');
  });
});
