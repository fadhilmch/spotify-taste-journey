import { gunzipSync, strFromU8 } from 'fflate';
import { normalizeArtistName } from './genreService';
import type { ArtistOrigin } from './types';

/**
 * Import of a MusicBrainz collection file made by scripts/enrich-musicbrainz.mjs.
 *
 * The file stays on the user's device: it is read in the browser, never uploaded
 * and never bundled. Only CC0 fields (country, area) are used from it. Community
 * tags in the file are ignored on purpose (CC BY-NC-SA, see docs/musicbrainz-collection.md).
 *
 * A match is accepted only when ALL of these hold, so a wrong guess is left
 * unmapped instead of placed on the map:
 *  - the top candidate has score 100,
 *  - its name or one of its aliases equals the artist name (case/space/apostrophe-insensitive),
 *  - no other candidate also has score 100 (no tie),
 *  - it has a country.
 * That is still a name match, not a verified identity: names are not unique.
 */

export interface CollectionStats {
  /** Artist lines read. Every line lands in exactly one of the counts below, so they add up to this. */
  total: number;
  /** Accepted with a country: these can be pinned. */
  accepted: number;
  /** Accepted through an alias rather than the main name. */
  viaAlias: number;
  noCandidates: number;
  /** Candidates exist but none is a score-100 exact name/alias match. */
  noExactMatch: number;
  /** More than one candidate scored 100. */
  ambiguous: number;
  /** Exact match but MusicBrainz has no country for it. */
  noCountry: number;
  /** Lines that were not valid collection rows. */
  invalid: number;
}

export interface ResolvedCollection {
  /** Keyed by normalized artist name. */
  origins: Record<string, ArtistOrigin>;
  stats: CollectionStats;
}

interface RawCandidate {
  name?: unknown;
  score?: unknown;
  country?: unknown;
  area?: unknown;
  aliases?: unknown;
}

export function emptyStats(): CollectionStats {
  return {
    total: 0,
    accepted: 0,
    viaAlias: 0,
    noCandidates: 0,
    noExactMatch: 0,
    ambiguous: 0,
    noCountry: 0,
    invalid: 0,
  };
}

const isStr = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

/** Turn the raw lines of a collection file into accepted origins, with a count of what was left out. */
export function resolveCollection(text: string): ResolvedCollection {
  const origins: Record<string, ArtistOrigin> = {};
  const stats = emptyStats();

  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    let row: { q?: unknown; cands?: unknown };
    try {
      row = JSON.parse(line) as typeof row;
    } catch {
      stats.invalid += 1;
      continue;
    }
    if (!isStr(row.q) || !Array.isArray(row.cands)) {
      stats.invalid += 1;
      continue;
    }
    const key = normalizeArtistName(row.q);
    stats.total += 1;

    const cands = row.cands as RawCandidate[];
    if (cands.length === 0) {
      stats.noCandidates += 1;
      continue;
    }
    const top = cands.filter((c) => c.score === 100);
    const exact = top.filter(
      (c) =>
        (isStr(c.name) && normalizeArtistName(c.name) === key) ||
        (Array.isArray(c.aliases) && c.aliases.some((a) => isStr(a) && normalizeArtistName(a) === key)),
    );
    if (exact.length === 0) {
      stats.noExactMatch += 1;
      continue;
    }
    if (top.length > 1) {
      stats.ambiguous += 1;
      continue;
    }
    const hit = exact[0];
    if (!isStr(hit.country) || !/^[A-Za-z]{2}$/.test(hit.country)) {
      stats.noCountry += 1;
      continue;
    }
    // Names that differ only by case/spacing share one key; the first accepted one wins.
    origins[key] ??= { country: hit.country.toUpperCase(), area: isStr(hit.area) ? hit.area : null };
    stats.accepted += 1;
    if (!(isStr(hit.name) && normalizeArtistName(hit.name) === key)) stats.viaAlias += 1;
  }
  return { origins, stats };
}

/** Read a picked collection file: plain .jsonl or gzipped .jsonl.gz. */
export async function readCollectionFile(file: File): Promise<ResolvedCollection> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const gz = bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
  const text = gz ? strFromU8(gunzipSync(bytes)) : new TextDecoder().decode(bytes);
  const result = resolveCollection(text);
  if (result.stats.total === 0) {
    throw new Error('No artist rows found. Pick the artists.jsonl file the collection script wrote.');
  }
  return result;
}
