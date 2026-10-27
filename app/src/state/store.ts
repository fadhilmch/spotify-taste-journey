import { create } from 'zustand';
import { buildDemoAggregates, buildDemoEvents, DEMO_GENRES } from '../data/demoData';
import { matchArtists } from '../data/genreService';
import type { ParseSummary } from '../data/types';
import { extractZipJson, isZipName, type FileReport, type PickedFile } from '../data/importFiles';
import { uniqueArtists } from '../data/stats';
import type { ArtistGenre, PlayAggregate, PlayEvent, View } from '../data/types';

export type Source = 'demo' | 'export' | null;
export type MatchState = 'idle' | 'matching' | 'done' | 'error';

export interface CardBits {
  artist: boolean;
  track: boolean;
  minutes: boolean;
  genre: boolean;
  eras: boolean;
}

interface AppState {
  source: Source;
  fileName: string | null;
  parseInfo: Omit<ParseSummary, 'aggregates' | 'events'> | null;
  /** Per picked file: recognized as listening history or skipped, and why. */
  fileReports: FileReport[] | null;
  aggregates: PlayAggregate[];
  events: PlayEvent[];
  genres: Record<string, ArtistGenre>;
  genresAreDemo: boolean;
  matchState: MatchState;
  matchProgress: { done: number; total: number };
  matchError: string | null;
  loading: boolean;
  error: string | null;
  view: View;
  range: string;
  month: string | null;
  playing: boolean;
  cardBits: CardBits;

  loadDemo: () => void;
  loadFile: (file: File) => Promise<void>;
  loadFiles: (files: File[]) => Promise<void>;
  loadProgress: { done: number; total: number } | null;
  startMatching: () => Promise<void>;
  setView: (v: View) => void;
  /** Artist the story should scroll to when it opens. */
  libraryArtist: string | null;
  setLibraryArtist: (a: string | null) => void;
  storyFocus: string | null;
  setStoryFocus: (a: string | null) => void;
  setRange: (r: string) => void;
  setMonth: (m: string) => void;
  setPlaying: (p: boolean) => void;
  toggleCardBit: (k: keyof CardBits) => void;
  clearError: () => void;
  reset: () => void;
}

let matchAbort: AbortController | null = null;

// Raw errors (SyntaxError from JSON.parse, URL/Worker failures) mean nothing to
// someone picking a file - translate them into what to do next.
export function friendlyImportError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (
    /streaming-history export|No music plays found|No listening history found|ZIP|too large|more data than|more than \d+ JSON files/i.test(
      msg,
    )
  )
    return msg;
  if (/JSON|Unexpected token|parse/i.test(msg)) {
    return 'That file is not valid JSON. Pick a Streaming_History_Audio JSON file from your Spotify export.';
  }
  return 'Those files could not be read as a Spotify export. Pick the Spotify export ZIP or its Streaming_History JSON files.';
}

export const useAppStore = create<AppState>((set, get) => ({
  source: null,
  fileName: null,
  parseInfo: null,
  fileReports: null,
  aggregates: [],
  events: [],
  genres: {},
  genresAreDemo: false,
  matchState: 'idle',
  matchProgress: { done: 0, total: 0 },
  matchError: null,
  loading: false,
  loadProgress: null,
  error: null,
  view: 'flow',
  libraryArtist: null,
  storyFocus: null,
  range: 'all',
  month: null,
  playing: false,
  cardBits: { artist: true, track: true, minutes: true, genre: true, eras: false },

  loadDemo: () => {
    matchAbort?.abort();
    const aggregates = buildDemoAggregates();
    set({
      source: 'demo',
      fileName: null,
      parseInfo: null,
      fileReports: null,
      aggregates,
      events: buildDemoEvents(),
      genres: { ...DEMO_GENRES },
      genresAreDemo: true,
      matchState: 'done',
      matchProgress: { done: 0, total: 0 },
      matchError: null,
      loading: false,
      error: null,
      month: null,
      playing: false,
    });
  },

  loadFile: async (file: File) => get().loadFiles([file]),

  loadFiles: async (files: File[]) => {
    matchAbort?.abort();
    set({ loading: true, error: null, playing: false, loadProgress: null });
    try {
      // Unpack any ZIPs first: the picker accepts the whole export archive,
      // loose JSON files, or a mix of both.
      const picked: PickedFile[] = [];
      for (const f of files) {
        if (isZipName(f.name)) {
          if (f.size > 512 * 1024 * 1024) {
            throw new Error(
              'That ZIP is too large to read here. Unzip it and pick the Streaming History JSON files instead.',
            );
          }
          picked.push(...extractZipJson(new Uint8Array(await f.arrayBuffer())));
        } else {
          picked.push({ name: f.name, text: await f.text() });
        }
      }
      const result = await new Promise<{ summary: ParseSummary; reports: FileReport[] }>(
        (resolve, reject) => {
          const worker = new Worker(new URL('../workers/parseWorker.ts', import.meta.url), {
            type: 'module',
          });
          worker.onmessage = (
            e: MessageEvent<{
              ok?: boolean;
              summary?: ParseSummary;
              reports?: FileReport[];
              error?: string;
              progress?: { done: number; total: number };
            }>,
          ) => {
            if (e.data.progress) {
              set({ loadProgress: e.data.progress });
              return;
            }
            worker.terminate();
            if (e.data.ok && e.data.summary && e.data.reports) {
              resolve({ summary: e.data.summary, reports: e.data.reports });
            } else {
              reject(new Error(e.data.error ?? 'Could not parse this file.'));
            }
          };
          worker.onerror = () => {
            worker.terminate();
            reject(new Error('Could not parse this file.'));
          };
          worker.postMessage(picked);
        },
      );
      const { summary, reports } = result;
      const { aggregates, events, ...parseInfo } = summary;
      set({
        source: 'export',
        fileName: files.length === 1 ? files[0].name : `${files.length} files`,
        parseInfo,
        fileReports: reports,
        aggregates,
        events,
        genres: {},
        genresAreDemo: false,
        matchState: 'idle',
        matchProgress: { done: 0, total: 0 },
        matchError: null,
        loading: false,
        error: null,
        month: null,
        loadProgress: null,
      });
      // No genre matching here on purpose: matching sends artist names to
      // MusicBrainz, so it only starts after explicit opt-in (Genres view).
    } catch (err) {
      set({ loading: false, loadProgress: null, error: friendlyImportError(err) });
    }
  },

  startMatching: async () => {
    const { aggregates, matchState } = get();
    if (aggregates.length === 0 || matchState === 'matching') return;
    matchAbort?.abort();
    const controller = new AbortController();
    matchAbort = controller;
    const names = uniqueArtists(aggregates);
    set({ matchState: 'matching', matchProgress: { done: 0, total: names.length }, matchError: null });
    try {
      const found = await matchArtists(names, {
        signal: controller.signal,
        onProgress: (done, total) => {
          set((s) => ({ matchProgress: { done, total }, genres: { ...s.genres } }));
        },
      });
      if (controller.signal.aborted) return;
      set((s) => ({ genres: { ...s.genres, ...found }, matchState: 'done' }));
    } catch (err) {
      if (controller.signal.aborted) return;
      set({
        matchState: 'error',
        matchError: err instanceof Error ? err.message : 'Genre matching failed.',
      });
    }
  },

  setView: (view) => set({ view }),
  setLibraryArtist: (libraryArtist) => set({ libraryArtist }),
  setStoryFocus: (storyFocus) => set({ storyFocus }),
  setRange: (range) => set({ range }),
  setMonth: (month) => set({ month }),
  setPlaying: (playing) => set({ playing }),
  toggleCardBit: (k) => set((s) => ({ cardBits: { ...s.cardBits, [k]: !s.cardBits[k] } })),

  clearError: () => set({ error: null }),
  reset: () => {
    matchAbort?.abort();
    set({
      source: null,
      fileName: null,
      parseInfo: null,
      fileReports: null,
      aggregates: [],
      events: [],
      genres: {},
      genresAreDemo: false,
      matchState: 'idle',
      matchProgress: { done: 0, total: 0 },
      matchError: null,
      loading: false,
      loadProgress: null,
      error: null,
      month: null,
      playing: false,
    });
  },
}));
