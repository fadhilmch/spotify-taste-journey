import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FlowView } from '../ui/FlowView';
import { useAppStore } from '../state/store';
import type { PlayAggregate } from '../data/types';

const aggs: PlayAggregate[] = ['2022-01', '2022-02', '2023-01', '2023-02'].flatMap((month) =>
  ['Artist A', 'Artist B'].map((artist) => ({ month, artist, ms: 3_600_000 }) as PlayAggregate),
);

describe('FlowView origins chapter', () => {
  beforeEach(() => useAppStore.getState().reset());

  it('is locked when no origins exist', () => {
    render(<FlowView aggs={aggs} events={[]} />);
    expect(screen.getAllByText(/Locked until you add artist origins/i).length).toBeGreaterThan(0);
  });

  it('is not locked after a collection file adds origins', () => {
    useAppStore.setState({ origins: { 'artist a': { country: 'GB', area: null } } });
    render(<FlowView aggs={aggs} events={[]} />);
    expect(screen.queryByText(/Locked until you add artist origins/i)).toBeNull();
    expect(screen.getByText(/from the collection file you added/i)).toBeInTheDocument();
  });
});
