export interface PlayAggregate {
  /** Month key, YYYY-MM */
  month: string;
  artist: string;
  track: string;
  ms: number;
}

export type ExportFormat = 'extended' | 'legacy';

/** One music play, kept from the extended export for the deeper stats. */
export interface PlayEvent {
  /** ISO-ish timestamp (extended) or "YYYY-MM-DDTHH:MM" (legacy). */
  ts: string;
  artist: string;
  track: string;
  ms: number;
  /** Spotify's own skipped flag; null when the file does not carry it. */
  skipped: boolean | null;
  reasonEnd: string | null;
  shuffle: boolean | null;
  offline: boolean | null;
  platform: string | null;
}

export interface ParseSummary {
  aggregates: PlayAggregate[];
  events: PlayEvent[];
  /** Valid music plays read from the file. */
  eventCount: number;
  /** Rows skipped (non-music rows such as podcast episodes, or invalid rows). */
  skipped: number;
  format: ExportFormat | null;
  firstTs: string | null;
  lastTs: string | null;
  /** Set only by multi-file parsing: exact duplicate rows removed. */
  duplicates?: number;
  /** Legacy-package plays dropped because the extended package has the same play. */
  crossPackageDuplicates?: number;
  /** Set only by multi-file parsing: how many files were combined. */
  files?: number;
}

export interface MonthBucket {
  key: string;
  label: string;
  short: string;
  minutes: number;
}

export interface ArtistTotal {
  name: string;
  minutes: number;
}
export interface TrackTotal {
  name: string;
  artist: string;
  minutes: number;
}
export interface Era {
  artist: string;
  from: string;
  to: string;
  minutes: number;
}

export interface GenreSlice {
  group: string;
  minutes: number;
}
export interface GenreMix {
  slices: GenreSlice[];
  uncategorized: number;
  total: number;
}

export type ChapterKind = 'first' | 'takeover' | 'comeback' | 'phase';

export interface Chapter {
  kind: ChapterKind;
  artist: string;
  from: string;
  to: string;
  minutes: number;
  /** Artist share of all listening inside the chapter window, 0..1. */
  share: number;
  topTrack: string | null;
  /** True on the final chapter when it runs to the last month on record. */
  current: boolean;
}

export type GenreSource = 'musicbrainz' | 'demo';

/** Where an artist is from, per the metadata source. Not where the user listened. */
export interface ArtistOrigin {
  /** ISO 3166-1 alpha-2 country code when the source gives one. */
  country: string | null;
  /** Free-text area name (city/region/country) for display fallback. */
  area: string | null;
}

export interface ArtistGenre {
  /** Broad groups derived from raw tags; first is primary. */
  groups: string[];
  /** Raw community tags, most-voted first (capped). */
  tags: string[];
  source: GenreSource;
  /** Artist name as returned by the source. */
  matchedName: string;
  /** Origin when the source provides it; absent on older cached entries. */
  origin?: ArtistOrigin;
}

export type View = 'flow' | 'journey' | 'story' | 'map' | 'genres' | 'artists' | 'tracks' | 'share' | 'guide';

export interface Coverage {
  matched: number;
  total: number;
}
