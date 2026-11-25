import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { JourneyView } from '../ui/JourneyView';
import { artistEras, buildMonths } from '../data/stats';
import type { PlayAggregate } from '../data/types';

const ag = (month: string, artist: string, ms: number): PlayAggregate =>
  ({ month, artist, track: 't', album: 'a', ms, plays: 1 }) as unknown as PlayAggregate;

// A leads 3 months, B 1 month, C 2 months, D 1 month.
const aggs = [
  ag('2024-01', 'A', 9e6),
  ag('2024-02', 'A', 9e6),
  ag('2024-03', 'A', 9e6),
  ag('2024-04', 'B', 9e6),
  ag('2024-05', 'C', 9e6),
  ag('2024-06', 'C', 9e6),
  ag('2024-07', 'D', 9e6),
];

describe('JourneyView artist eras', () => {
  it('draws one ribbon segment per era and lists only 2+ month eras', () => {
    const months = buildMonths(aggs);
    const eras = artistEras(months, aggs);
    render(<JourneyView months={months} aggs={aggs} />);
    const group = screen.getByRole('group', { name: /Artist eras/ });
    expect(group.querySelectorAll('button')).toHaveLength(eras.length);
    expect(screen.getByRole('button', { name: /^A, Jan 2024 to Mar 2024/ })).toBeInTheDocument();
    const items = document.querySelectorAll('.tj-era-list li');
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain('3 months');
    expect(screen.getByText('Plus 2 one-month leads')).toBeInTheDocument();
  });
});
