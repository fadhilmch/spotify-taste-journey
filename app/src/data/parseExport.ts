import type { ExportFormat, ParseSummary, PlayAggregate, PlayEvent } from './types';

/**
 * Parses Spotify account-data exports into month/artist/track aggregates.
 *
 * Supported shapes:
 * - Extended streaming history (Streaming_History_Audio_*.json):
 *   { ts, ms_played, master_metadata_track_name, master_metadata_album_artist_name, ... }
 * - Legacy "endsong" history (endsong_*.json):
 *   { endTime: "YYYY-MM-DD HH:MM", msPlayed, trackName, artistName }
 *
 * Rows without a track and artist name (podcast episodes, audiobooks,
 * unknown-track rows) are skipped and counted. Only listening fields are
 * read; any other fields in the export (IP addresses, device info, ...) are
 * ignored and never stored.
 */

interface ExtendedRow {
  ts?: unknown;
  ms_played?: unknown;
  master_metadata_track_name?: unknown;
  master_metadata_album_artist_name?: unknown;
  skipped?: unknown;
  reason_end?: unknown;
  reason_start?: unknown;
  master_metadata_album_album_name?: unknown;
  shuffle?: unknown;
  offline?: unknown;
  platform?: unknown;
}

interface LegacyRow {
  endTime?: unknown;
  msPlayed?: unknown;
  trackName?: unknown;
  artistName?: unknown;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function detectFormat(row: unknown): ExportFormat | null {
  if (!isRecord(row)) return null;
  if (typeof row.ts === 'string' && typeof row.ms_played === 'number') return 'extended';
  if (typeof row.endTime === 'string' && typeof row.msPlayed === 'number') return 'legacy';
  return null;
}

/** "2019-03-04 21:05" -> "2019-03" ; ISO strings slice to the same key. */
function monthKey(ts: string): string | null {
  const key = ts.slice(0, 7);
  return /^\d{4}-\d{2}$/.test(key) ? key : null;
}

export function parseStreamingHistory(json: unknown): ParseSummary {
  if (!Array.isArray(json)) {
    throw new Error('This file is not a Spotify streaming-history export (expected a JSON array).');
  }
  return parseRows(json);
}

/**
 * Key identifying one play for exact-duplicate removal. Spotify export files
 * overlap at their boundaries, so combining several files without this doubles
 * those plays. Same track + artist + ms at the same second is one play.
 */
function rowKey(row: unknown): string | null {
  const format = detectFormat(row);
  if (format === 'extended') {
    const r = row as ExtendedRow;
    return `e|${String(r.ts)}|${String(r.master_metadata_album_artist_name)}|${String(r.master_metadata_track_name)}|${String(r.ms_played)}`;
  }
  if (format === 'legacy') {
    const r = row as LegacyRow;
    return `l|${String(r.endTime)}|${String(r.artistName)}|${String(r.trackName)}|${String(r.msPlayed)}`;
  }
  return null;
}

/**
 * Parse several export files into one combined summary. Rows are concatenated
 * (filenames carry no meaning - files can span any period), exact duplicate
 * rows are removed once, and the result goes through the same fold as a
 * single file. Returns duplicate/file counts in the optional summary fields.
 */
/**
 * Minute-precision key used to reconcile the same play appearing in both
 * history packages. The legacy "Account data" history ends timestamps at the
 * minute, so an exact extended match needs the same track, artist, minute and
 * milliseconds. Anything short of that keeps the legacy row: dropping real
 * plays is worse than keeping a possible duplicate.
 */
function crossPackageKey(row: unknown): string | null {
  const format = detectFormat(row);
  if (format === 'extended') {
    const r = row as ExtendedRow;
    return `${String(r.ts).slice(0, 16)}|${String(r.master_metadata_album_artist_name)}|${String(r.master_metadata_track_name)}|${String(r.ms_played)}`;
  }
  if (format === 'legacy') {
    const r = row as LegacyRow;
    return `${String(r.endTime).replace(' ', 'T')}|${String(r.artistName)}|${String(r.trackName)}|${String(r.msPlayed)}`;
  }
  return null;
}

/**
 * Parse several export files into one combined summary. Rows are concatenated
 * (filenames carry no meaning - files can span any period), exact duplicate
 * rows are removed once, and the result goes through the same fold as a
 * single file. When both history packages are present, legacy rows that
 * exactly match an extended play are dropped as the same play told twice;
 * unmatched legacy rows are always kept. Returns duplicate/file counts in the
 * optional summary fields.
 */
export function parseStreamingHistoryMulti(jsonArrays: unknown[]): ParseSummary {
  if (jsonArrays.length === 0) {
    throw new Error('Pick at least one Streaming_History_Audio JSON file from your Spotify export.');
  }
  const seen = new Set<string>();
  let duplicates = 0;
  const rows: unknown[] = [];
  const arrays: unknown[][] = [];
  for (const json of jsonArrays) {
    if (!Array.isArray(json)) {
      throw new Error('This file is not a Spotify streaming-history export (expected a JSON array).');
    }
    arrays.push(json);
  }
  for (const json of arrays) {
    for (const row of json) {
      const key = rowKey(row);
      if (key !== null) {
        if (seen.has(key)) {
          duplicates += 1;
          continue;
        }
        seen.add(key);
      }
      rows.push(row);
    }
  }
  // Cross-package reconciliation, strictly one-to-one: each surviving
  // extended play can absorb exactly one identical legacy play. A multiset
  // (key -> remaining count) keeps repeated rows honest - two identical
  // legacy rows cannot both be dropped against a single extended row.
  const extendedCounts = new Map<string, number>();
  for (const row of rows) {
    if (detectFormat(row) === 'extended') {
      const key = crossPackageKey(row);
      if (key !== null) extendedCounts.set(key, (extendedCounts.get(key) ?? 0) + 1);
    }
  }
  let crossPackageDuplicates = 0;
  let reconciled = rows;
  if (extendedCounts.size > 0) {
    reconciled = [];
    for (const row of rows) {
      if (detectFormat(row) === 'legacy') {
        const key = crossPackageKey(row);
        const remaining = key !== null ? (extendedCounts.get(key) ?? 0) : 0;
        if (key !== null && remaining > 0) {
          extendedCounts.set(key, remaining - 1);
          crossPackageDuplicates += 1;
          continue;
        }
      }
      reconciled.push(row);
    }
  }
  const summary = parseRows(reconciled);
  summary.duplicates = duplicates;
  if (crossPackageDuplicates > 0) summary.crossPackageDuplicates = crossPackageDuplicates;
  summary.files = jsonArrays.length;
  return summary;
}

function parseRows(json: unknown[]): ParseSummary {
  let format: ExportFormat | null = null;
  let formatMixed = false;
  let eventCount = 0;
  let skipped = 0;
  let firstTs: string | null = null;
  let lastTs: string | null = null;
  const acc = new Map<string, PlayAggregate>();
  const events: PlayEvent[] = [];

  for (const row of json) {
    const rowFormat = detectFormat(row);
    if (rowFormat === null) {
      skipped += 1;
      continue;
    }
    if (format === null) format = rowFormat;
    else if (format !== rowFormat) formatMixed = true;
    let ts: string;
    let ms: number;
    let track: unknown;
    let artist: unknown;
    let ev: PlayEvent | null = null;
    if (rowFormat === 'extended') {
      const r = row as ExtendedRow;
      ts = r.ts as string;
      ms = r.ms_played as number;
      track = r.master_metadata_track_name;
      artist = r.master_metadata_album_artist_name;
      ev = {
        ts,
        artist: artist as string,
        track: track as string,
        ms,
        skipped: typeof r.skipped === 'boolean' ? r.skipped : null,
        reasonEnd: typeof r.reason_end === 'string' ? r.reason_end : null,
        reasonStart: typeof r.reason_start === 'string' ? r.reason_start : null,
        album:
          typeof r.master_metadata_album_album_name === 'string' && r.master_metadata_album_album_name !== ''
            ? r.master_metadata_album_album_name
            : null,
        shuffle: typeof r.shuffle === 'boolean' ? r.shuffle : null,
        offline: typeof r.offline === 'boolean' ? r.offline : null,
        platform: typeof r.platform === 'string' ? r.platform : null,
      };
    } else {
      const r = row as LegacyRow;
      ts = (r.endTime as string).replace(' ', 'T');
      ms = r.msPlayed as number;
      track = r.trackName;
      artist = r.artistName;
    }
    if (typeof track !== 'string' || typeof artist !== 'string' || track === '' || artist === '') {
      skipped += 1;
      continue;
    }
    const month = monthKey(ts);
    if (month === null || !(ms > 0)) {
      skipped += 1;
      continue;
    }
    eventCount += 1;
    if (firstTs === null || ts < firstTs) firstTs = ts;
    if (lastTs === null || ts > lastTs) lastTs = ts;
    const key = `${month}${artist}${track}`;
    const cur = acc.get(key);
    if (cur) cur.ms += ms;
    else acc.set(key, { month, artist, track, ms });
    events.push(
      ev ?? {
        ts,
        artist,
        track,
        ms,
        skipped: null,
        reasonEnd: null,
        reasonStart: null,
        album: null,
        shuffle: null,
        offline: null,
        platform: null,
      },
    );
  }

  if (eventCount === 0) {
    throw new Error(
      'No music plays found in this file. Pick a Streaming_History_Audio JSON file from your Spotify export.',
    );
  }
  return {
    aggregates: [...acc.values()],
    events,
    eventCount,
    skipped,
    format: formatMixed ? null : format,
    firstTs,
    lastTs,
  };
}
