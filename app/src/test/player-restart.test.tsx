import { describe, expect, it, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PlayerBar } from '../ui/PlayerBar';
import { useAppStore } from '../state/store';
import type { MonthBucket, PlayAggregate } from '../data/types';

const months = ['2020-01', '2020-02', '2020-03'].map(
  (key) => ({ key, label: key, minutes: 10 }) as unknown as MonthBucket,
);
const aggs = months.map(
  (m) => ({ month: m.key, artist: 'A', track: 'T', ms: 600000 }) as unknown as PlayAggregate,
);

describe('PlayerBar play', () => {
  beforeEach(() => useAppStore.setState({ month: null, playing: false }));

  it('restarts from the first month when played from the last month', () => {
    render(<PlayerBar months={months} aggs={aggs} />);
    fireEvent.click(screen.getByRole('button', { name: 'Play the journey' }));
    expect(useAppStore.getState().month).toBe('2020-01');
    expect(useAppStore.getState().playing).toBe(true);
  });

  it('keeps the selected month when played from the middle', () => {
    useAppStore.setState({ month: '2020-02' });
    render(<PlayerBar months={months} aggs={aggs} />);
    fireEvent.click(screen.getByRole('button', { name: 'Play the journey' }));
    expect(useAppStore.getState().month).toBe('2020-02');
    expect(useAppStore.getState().playing).toBe(true);
  });
});
