# Collecting artist metadata from MusicBrainz

`app/scripts/enrich-musicbrainz.mjs` looks up each artist in your own Spotify export on MusicBrainz and saves the raw results to a local file. It needs Node 18 or newer and no installs.

```
node app/scripts/enrich-musicbrainz.mjs <folder-with-Streaming_History_Audio_*.json> artists.jsonl
```

## Privacy

- Only artist names are sent to musicbrainz.org. Like any web request, it also sees your IP address and the script's user-agent line, which names this project.
- Run it locally. The output file contains your artist names, so keep it private and never commit it. `artists.jsonl` and `history/` are in `.gitignore` for that reason.

## Behaviour

- Pace: about one request per second, MusicBrainz's published limit. Each request times out after 30 seconds and retries up to 6 times with growing waits. A full library takes hours; the time depends on your connection.
- Resumable: stop with Ctrl+C and run the same command again. Artists already in the file are skipped. A half-written last line is removed first.
- The last line says `COMPLETE: N/N` or `INCOMPLETE: ... artists missing` (exit code 2). Counts only include artists in the history you pointed at. If it finds no artist names it exits with code 1.

## What the file holds

Per artist name, up to five raw search candidates with their score and fields (country, area, type, life-span, tags, ISNI/IPI where present). It does not pick the right candidate. A later step may accept a match only when the top candidate has score 100, its name or an alias equals the name exactly and no other candidate ties. That is still a name match, not a verified identity, because names are not unique.

## Licence

Country, area, type and life-span are CC0. Tags and genres are CC BY-NC-SA 3.0 (https://musicbrainz.org/doc/About/Data_License). The search returns community tags, not MusicBrainz's curated genre list. Do not ship tags in the app without checking the licence.
