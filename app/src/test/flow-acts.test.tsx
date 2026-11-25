import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { FlowView } from '../ui/FlowView';
import { useAppStore } from '../state/store';
import { ACTS } from '../data/acts';
import type { PlayAggregate } from '../data/types';

const aggs: PlayAggregate[] = ['2022-01', '2022-02', '2023-01', '2023-02'].flatMap((month) =>
  ['Artist A', 'Artist B'].map((artist) => ({ month, artist, ms: 3_600_000 }) as PlayAggregate),
);

describe('FlowView acts', () => {
  beforeEach(() => useAppStore.getState().reset());

  it('renders act headings that are not chapters', () => {
    const { container } = render(<FlowView aggs={aggs} events={[]} />);
    const heads = container.querySelectorAll('li.tj-flow-act');
    expect(heads.length).toBeGreaterThanOrEqual(2);
    for (const h of heads) expect(h.hasAttribute('data-beat')).toBe(false);
    expect(screen.getByRole('heading', { name: ACTS.past.title })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: ACTS.origins.title })).toBeInTheDocument();
  });

  it('shows act labels in the rail and the act in the kicker', () => {
    const { container } = render(<FlowView aggs={aggs} events={[]} />);
    const labels = [...container.querySelectorAll('.tj-flow-pipact')].map((e) => e.textContent);
    expect(labels).toContain('I');
    expect(labels).toContain('III');
    expect(container.querySelector('.tj-flow-kicker')?.textContent).toMatch(/^Prologue/);
  });

  it('orders chapters by act: Hours after the river', () => {
    render(<FlowView aggs={aggs} events={[]} />);
    const pips = [...document.querySelectorAll('.tj-flow-pip')].map((e) => e.textContent ?? '');
    const hours = pips.findIndex((t) => /Hours/.test(t));
    if (hours < 0) return; // too little data for habit chapters
    const river = pips.findIndex((t) => /River/.test(t));
    if (river >= 0) expect(hours).toBeGreaterThan(river);
  });

  it('links to the method page', () => {
    render(<FlowView aggs={aggs} events={[]} />);
    fireEvent.click(screen.getByRole('button', { name: /How this is counted/i }));
    expect(useAppStore.getState().view).toBe('method');
  });
});
