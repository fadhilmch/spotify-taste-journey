import { useAppStore } from '../state/store';
import { Button, Card } from './primitives';

/**
 * The explicit MusicBrainz opt-in gate, shared by World and Spectrum.
 * Nothing is fetched until the user enables it; copy states exactly what
 * leaves the device (artist names only) and what comes back.
 */
export function OptInGate({ what, plural = false }: { what: string; plural?: boolean }) {
  const matchState = useAppStore((s) => s.matchState);
  const matchProgress = useAppStore((s) => s.matchProgress);
  const matchError = useAppStore((s) => s.matchError);
  const startMatching = useAppStore((s) => s.startMatching);

  return (
    <>
      {matchState === 'idle' && (
        <Card
          id="tj-optin-h"
          title={`${what} ${plural ? 'stay' : 'stays'} off until you enable ${plural ? 'them' : 'it'}`}
          className="border-[hsl(45_90%_50%/0.35)]!"
        >
          <p className="tj-note">
            Genre tags and artist origins come from MusicBrainz, a public music encyclopedia. Enabling this
            sends each artist&apos;s name - only the name, never your plays, dates, or the file itself - to
            musicbrainz.org, one request per artist at about one per second. Matches are cached on this
            device. Until then, everything below stays uncategorized rather than guessed.
          </p>
          <Button className="mt-2.5" onClick={() => void startMatching()}>
            Enable MusicBrainz lookup
          </Button>
        </Card>
      )}
      {matchState === 'matching' && (
        <p className="tj-note" role="status">
          Matching with MusicBrainz - {matchProgress.done} of {matchProgress.total} artists, paced at about
          one request per second. Unmatched artists stay uncategorized.
        </p>
      )}
      {matchState === 'error' && (
        <p className="tj-note tj-note-error" role="alert">
          Matching stopped{matchError ? `: ${matchError}` : ''}.{' '}
          <button type="button" className="tj-linkbtn" onClick={() => void startMatching()}>
            Resume
          </button>
        </p>
      )}
    </>
  );
}
