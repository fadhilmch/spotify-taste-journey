#!/usr/bin/env node
// Resumable MusicBrainz artist lookup. Sends artist names ONLY. Runs locally; nothing is uploaded elsewhere.
// Usage: node enrich-musicbrainz.mjs <folder-with-Streaming_History*.json> [cache.jsonl]
// Safe to stop (Ctrl+C) and re-run: names already in the cache are skipped.
// Keep the cache file private. Core data is CC0; tags/genres are CC BY-NC-SA 3.0 (musicbrainz.org/doc/About/Data_License).
import { readdirSync, readFileSync, appendFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
const cache = process.argv[3] ?? 'artists.jsonl';
if (!dir) {
  console.error('usage: node enrich-musicbrainz.mjs <history-folder> [cache.jsonl]');
  process.exit(1);
}
const UA = 'TasteJourney-personal/0.1 ( https://github.com/fadhilmch/spotify-taste-journey )';
const GAP_MS = 1100; // MusicBrainz limit: 1 request per second per IP

const minutes = new Map();
const unreadable = [];
let jsonFiles;
try {
  jsonFiles = readdirSync(dir).filter((f) => /\.json$/i.test(f));
} catch {
  console.error(`Cannot read the folder "${dir}".`);
  process.exit(1);
}
for (const f of jsonFiles) {
  let rows;
  try {
    rows = JSON.parse(readFileSync(join(dir, f), 'utf8'));
  } catch {
    unreadable.push(f);
    continue;
  }
  if (!Array.isArray(rows)) {
    unreadable.push(f);
    continue;
  }
  for (const r of rows) {
    const n = r.master_metadata_album_artist_name ?? r.artistName;
    const ms = r.ms_played ?? r.msPlayed ?? 0;
    if (n && ms > 0) minutes.set(n, (minutes.get(n) ?? 0) + ms / 60000);
  }
}
const names = [...minutes].sort((a, b) => b[1] - a[1]);
if (unreadable.length > 0)
  console.log(
    `Warning: ${unreadable.length} .json file(s) could not be read as a list and were ignored: ${unreadable.join(', ')}`,
  );
if (names.length === 0) {
  console.error(
    'No artist names found. Point the script at the folder with your Streaming_History_Audio_*.json files.',
  );
  process.exit(1);
}
const done = new Set();
if (existsSync(cache)) {
  // An interrupted run can leave a half-written last line; drop it so the next row starts on its own line.
  const raw = readFileSync(cache, 'utf8');
  if (raw.length > 0 && !raw.endsWith('\n')) {
    writeFileSync(cache, raw.slice(0, raw.lastIndexOf('\n') + 1));
    console.log('Removed an incomplete last line from the cache (it will be fetched again).');
  }
}
if (existsSync(cache))
  for (const l of readFileSync(cache, 'utf8').split('\n')) {
    try {
      done.add(JSON.parse(l).q);
    } catch {
      /* ignore partial line */
    }
  }
const cachedNow = () => names.filter(([nm]) => done.has(nm)).length;
console.log(`${names.length} artists in your history, ${cachedNow()} already in the cache`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let last = 0,
  n = 0;
const failed = [];
for (const [name, min] of names) {
  if (done.has(name)) continue;
  const url =
    'https://musicbrainz.org/ws/2/artist/?fmt=json&limit=5&query=' +
    encodeURIComponent(`artist:"${name.replace(/"/g, '')}"`);
  let d = null;
  for (let a = 0; a < 6 && !d; a++) {
    await sleep(Math.max(0, GAP_MS - (Date.now() - last)));
    last = Date.now();
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'application/json' },
        signal: AbortSignal.timeout(30000),
      });
      if (res.ok) d = await res.json();
      else await sleep(5000 * (a + 1));
    } catch {
      await sleep(5000 * (a + 1));
    }
  }
  if (!d) {
    failed.push(name);
    console.log(`gave up on one artist after retries (${failed.length} so far); re-run to retry`);
    continue;
  }
  const cands = (d.artists ?? []).slice(0, 5).map((x) => ({
    id: x.id,
    name: x.name,
    'sort-name': x['sort-name'],
    score: x.score,
    type: x.type,
    gender: x.gender,
    country: x.country,
    disambiguation: x.disambiguation,
    'life-span': x['life-span'],
    tags: x.tags,
    genres: x.genres,
    isnis: x.isnis,
    ipis: x.ipis,
    area: x.area?.name,
    begin_area: x['begin-area']?.name,
    aliases: (x.aliases ?? []).map((al) => al.name).slice(0, 10),
  }));
  appendFileSync(cache, JSON.stringify({ q: name, min, count: d.count, cands }) + '\n');
  done.add(name);
  if (++n % 25 === 0) console.log(`${cachedNow()}/${names.length}`);
}
const total = cachedNow();
if (failed.length > 0 || total < names.length) {
  console.log(
    `INCOMPLETE: ${total}/${names.length} cached, ${names.length - total} artists missing. Run the same command again to retry them.`,
  );
  process.exit(2);
}
console.log(`COMPLETE: ${total}/${names.length} cached in ${cache}`);
