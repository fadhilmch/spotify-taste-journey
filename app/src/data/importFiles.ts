import { unzipSync, strFromU8 } from 'fflate';
import type { ExportFormat } from './types';

/**
 * Turns whatever a person picks - the whole export ZIP, a few JSON files, or
 * an entire unzipped export folder - into the listening-history texts the
 * parser understands, plus a per-file report of what was recognized.
 *
 * Spotify lets people request different packages (Account data, Extended
 * streaming history, Technical log information), so an export can contain
 * anything from lifetime history to one year of history plus playlists,
 * payments and search queries. Files are recognized by their contents, never
 * by filename.
 */

export interface PickedFile {
  name: string;
  text: string;
}

export type FileStatus = 'loaded' | 'not-history' | 'unreadable';

export interface FileReport {
  name: string;
  status: FileStatus;
  /** Which history schema the rows matched; absent for non-history files. */
  format?: ExportFormat;
  /** Rows in the file (history files only). */
  rows?: number;
}

/** Detect the history schema of one parsed JSON document. */
function classifyJson(json: unknown): { format: ExportFormat; rows: number } | null {
  if (!Array.isArray(json) || json.length === 0) return null;
  // Sample the first rows; real history files are uniform.
  let extended = 0;
  let legacy = 0;
  const sample = json.slice(0, 50);
  for (const row of sample) {
    if (typeof row !== 'object' || row === null || Array.isArray(row)) continue;
    const r = row as Record<string, unknown>;
    if (typeof r.ts === 'string' && typeof r.ms_played === 'number') extended += 1;
    else if (typeof r.endTime === 'string' && typeof r.msPlayed === 'number') legacy += 1;
  }
  if (extended > 0 && extended >= legacy) return { format: 'extended', rows: json.length };
  if (legacy > 0) return { format: 'legacy', rows: json.length };
  return null;
}

/**
 * Classify one picked file by its JSON contents and hand back the parsed
 * document, so callers (the worker) do not parse a large file twice.
 */
export function classifyFileParsed(file: PickedFile): { report: FileReport; json?: unknown } {
  let json: unknown;
  try {
    json = JSON.parse(file.text);
  } catch {
    return { report: { name: file.name, status: 'unreadable' } };
  }
  const hit = classifyJson(json);
  if (hit === null) return { report: { name: file.name, status: 'not-history' } };
  return { report: { name: file.name, status: 'loaded', format: hit.format, rows: hit.rows }, json };
}

/** Classify one picked file by its JSON contents. */
export function classifyFile(file: PickedFile): FileReport {
  return classifyFileParsed(file).report;
}

/**
 * Hard bounds on ZIP extraction. `unzipSync` decompresses every accepted
 * entry into memory, so a hostile or broken archive must be stopped before
 * unbounded allocation: caps on entry count, per-entry uncompressed size and
 * total uncompressed size. Defaults are far beyond any real Spotify export
 * (a heavy lifetime history is tens of MB of JSON).
 */
export interface ZipLimits {
  maxEntries: number;
  maxEntryBytes: number;
  maxTotalBytes: number;
}
export const DEFAULT_ZIP_LIMITS: ZipLimits = {
  maxEntries: 2000,
  maxEntryBytes: 128 * 1024 * 1024,
  maxTotalBytes: 512 * 1024 * 1024,
};

/** Basename of a ZIP entry, without any folder path. */
function baseName(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1] || path;
}

/**
 * Extract the JSON texts from a Spotify export ZIP. Folders inside the ZIP
 * are flattened to entry basenames; macOS metadata and non-JSON entries are
 * ignored. Throws when the file is not a readable ZIP.
 */
export function extractZipJson(bytes: Uint8Array, limits: ZipLimits = DEFAULT_ZIP_LIMITS): PickedFile[] {
  // The filter runs before any decompression, so oversize or excess entries
  // are rejected from metadata alone (name, compressed and original size).
  let seen = 0;
  let acceptedBytes = 0;
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes, {
      filter: (info) => {
        if (info.name.endsWith('/')) return false;
        if (info.name.startsWith('__MACOSX/')) return false;
        if (!/\.json$/i.test(info.name)) return false;
        seen += 1;
        if (seen > limits.maxEntries) {
          throw new Error(
            `That ZIP has more than ${limits.maxEntries} JSON files - that does not look like a Spotify export.`,
          );
        }
        if (info.originalSize > limits.maxEntryBytes) {
          throw new Error(
            `"${baseName(info.name)}" is too large to read here. Unzip it on your computer and check it is a real Spotify export file.`,
          );
        }
        acceptedBytes += info.originalSize;
        if (acceptedBytes > limits.maxTotalBytes) {
          throw new Error(
            'That ZIP unpacks to more data than the app can read in a browser tab. Pick the Streaming History JSON files individually instead.',
          );
        }
        return true;
      },
    });
  } catch (err) {
    if (err instanceof Error && /JSON files|too large|more data/.test(err.message)) throw err;
    throw new Error('That ZIP file could not be read. Try unzipping it and picking the JSON files instead.', {
      cause: err,
    });
  }
  const out: PickedFile[] = [];
  for (const [path, data] of Object.entries(entries)) {
    out.push({ name: baseName(path), text: strFromU8(data) });
  }
  if (out.length === 0) {
    throw new Error('That ZIP contains no JSON files. Pick the Spotify export ZIP or its JSON files.');
  }
  return out;
}

/** True when a picked file looks like a ZIP archive (by name). */
export function isZipName(name: string): boolean {
  return /\.zip$/i.test(name);
}
