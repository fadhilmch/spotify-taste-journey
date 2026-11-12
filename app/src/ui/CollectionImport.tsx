import React from 'react';
import { useAppStore } from '../state/store';
import { Button, Card, FileInput } from './primitives';

/**
 * Optional import of a collection file made by scripts/enrich-musicbrainz.mjs.
 * The file is read on this device only. Only country (CC0) is used from it;
 * artists are pinned only on a strict name match, the rest stay unmapped.
 */
export function CollectionImport() {
  const origins = useAppStore((s) => s.origins);
  const stats = useAppStore((s) => s.collectionStats);
  const error = useAppStore((s) => s.collectionError);
  const loadCollection = useAppStore((s) => s.loadCollection);
  const ref = React.useRef<HTMLInputElement>(null);
  const mapped = Object.keys(origins).length;
  const aggregates = useAppStore((s) => s.aggregates);
  const inHistory = React.useMemo(() => new Set(aggregates.map((a) => a.artist)).size, [aggregates]);

  return (
    <Card id="tj-collection-h" title="Already collected your artists from MusicBrainz?">
      <p className="tj-note">
        Pick the <code>artists.jsonl</code> file the collection script wrote (a <code>.gz</code> copy works
        too). It is read on this device only and nothing is sent anywhere. Only each artist&apos;s country is
        used, and only when the name matches exactly with one clear top result.
      </p>
      <FileInput
        inputRef={ref}
        accept=".jsonl,.json,.gz,.txt"
        label="Choose artist collection file"
        onFiles={(files) => void loadCollection(files[0])}
      />
      <Button className="mt-2.5" onClick={() => ref.current?.click()}>
        {stats ? 'Choose a different file' : 'Choose collection file'}
      </Button>
      {stats && !error && (
        <p className="tj-note" role="status">
          {mapped} of your {inHistory} artists placed on the map. Left off rather than guessed (file totals):{' '}
          {stats.noCandidates} not found, {stats.noExactMatch + stats.ambiguous} without one clear match,{' '}
          {stats.noCountry} with no country on record.
        </p>
      )}
      {error && (
        <p className="tj-note tj-note-error" role="alert">
          {error}
        </p>
      )}
    </Card>
  );
}
