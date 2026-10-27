import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '../state/store';
import type { ParseSummary } from '../data/types';

const summary: ParseSummary = {
  eventCount: 2,
  skipped: 0,
  format: 'extended',
  firstTs: '2024-01-01T10:00:00Z',
  lastTs: '2024-01-02T10:00:00Z',
  aggregates: [
    { month: '2024-01', artist: 'Real Artist', track: 'Song', ms: 120000 },
    { month: '2024-01', artist: 'Real Artist', track: 'Song 2', ms: 60000 },
  ],
  events: [
    {
      ts: '2024-01-01T10:00:00Z',
      artist: 'Real Artist',
      track: 'Song',
      ms: 120000,
      skipped: false,
      reasonEnd: 'trackdone',
      reasonStart: 'trackdone',
      album: 'Album',
      shuffle: true,
      offline: false,
      platform: 'android',
    },
    {
      ts: '2024-01-02T10:00:00Z',
      artist: 'Real Artist',
      track: 'Song 2',
      ms: 60000,
      skipped: null,
      reasonEnd: null,
      reasonStart: null,
      album: null,
      shuffle: null,
      offline: null,
      platform: null,
    },
  ],
};

// Worker shim: resolve immediately with the summary, no real worker thread.
class FakeWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  postMessage() {
    this.onmessage?.({ data: { ok: true, summary, reports: [] } } as MessageEvent);
  }
  terminate() {}
}

describe('privacy: export loading', () => {
  beforeEach(() => {
    vi.stubGlobal('Worker', FakeWorker);
    useAppStore.getState().reset();
  });

  it('loads an export without any network call until genre lookup is enabled', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ artists: [] }), { status: 200 }));
    const file = { name: 'Streaming_History_Audio_0.json', text: async () => '[]' } as File;
    await useAppStore.getState().loadFile(file);
    const s = useAppStore.getState();
    expect(s.source).toBe('export');
    expect(s.matchState).toBe('idle');
    expect(fetchSpy).not.toHaveBeenCalled();
    await s.startMatching();
    expect(useAppStore.getState().matchState).not.toBe('idle');
    fetchSpy.mockRestore();
  });
});
