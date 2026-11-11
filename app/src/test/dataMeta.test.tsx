import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataMeta } from '../ui/DataMeta';
import { useAppStore } from '../state/store';

const summary = {
  eventCount: 2181,
  skipped: 12,
  format: 'extended' as const,
  firstTs: '2020-01-05T10:00:00Z',
  lastTs: '2025-12-20T10:00:00Z',
  duplicates: 3,
  files: 2,
};

describe('DataMeta', () => {
  it('shows one compact line and keeps the reading notes behind a disclosure', async () => {
    useAppStore.getState().reset();
    useAppStore.setState({
      parseInfo: summary,
      fileName: '2 files',
      fileReports: [{ name: 'Playlist1.json', status: 'not-history' as const }],
    });
    const user = userEvent.setup();
    render(<DataMeta />);

    // Collapsed: one line with the count, coverage and privacy fact.
    const line = document.querySelector('.tj-meta-line')!;
    expect(line.textContent).toContain('2,181 plays');
    expect(line.textContent).toContain('read in this tab, never uploaded');
    const details = line.closest('details')!;
    expect(details.open).toBe(false);

    // Expanded: the full breakdown is there, including skipped rows and files.
    await user.click(screen.getByText('How this was read'));
    expect(details.open).toBe(true);
    expect(screen.getByText(/non-music or invalid rows skipped/)).toBeInTheDocument();
    expect(
      screen.getByText(/1 file had no listening history and was skipped: Playlist1.json/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Only listening fields/)).toBeInTheDocument();
  });

  it('renders nothing when no export is loaded', () => {
    useAppStore.getState().reset();
    const { container } = render(<DataMeta />);
    expect(container).toBeEmptyDOMElement();
  });
});
