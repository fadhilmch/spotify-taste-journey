import { useAppStore } from '../state/store';
import { Card } from './primitives';
const STEPS: Array<[string, string]> = [
  [
    'Request your export',
    'On spotify.com, open your Account page, then Account Privacy, then Download your data.',
  ],
  [
    'Pick Extended streaming history',
    'That covers the lifetime of your account - the regular account data export only covers the past year.',
  ],
  ["Wait for Spotify's email", 'Spotify emails you a download link to a ZIP when your export is ready.'],
  [
    'Import here',
    'Pick the ZIP itself, or the unzipped Streaming History JSON files together (Ctrl/Cmd-click). Files without listening history are skipped with a note. Everything is read in this tab and never uploaded.',
  ],
];

export function GuideView() {
  const parseInfo = useAppStore((st) => st.parseInfo);
  return (
    <>
      {parseInfo && (
        <p className="tj-note">
          Loaded now: {parseInfo.eventCount.toLocaleString()} plays
          {parseInfo.files && parseInfo.files > 1 ? ` from ${parseInfo.files} files` : ''}.
        </p>
      )}
      <Card className="py-[26px]! text-center">
        <h3 className="m-0 text-[19px] font-extrabold tracking-[-0.02em]">Bring your listening history</h3>
        <p className="mx-auto mt-2 max-w-[520px] text-[13px] leading-[1.55] text-txt-2">
          Spotify's app and Recently Played only cover your most recent tracks. The account data export is the
          only way to get your full lifetime timeline. Four steps:
        </p>
      </Card>
      <Card
        label="How to get your export"
        title="How to get your export"
        aside={<p className="tj-guide-tag">Official Spotify flow</p>}
      >
        <ol className="tj-guide-steps">
          {STEPS.map(([title, body], i) => (
            <li key={title}>
              <span className="tj-guide-num" aria-hidden="true">
                {i + 1}
              </span>
              <div>
                <b>{title}</b>
                <p>{body}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="tj-guide-links">
          Keep the ZIP private: it can contain IP addresses and private-session details. Official Spotify
          guides:{' '}
          <a
            href="https://support.spotify.com/us/article/data-rights-and-privacy-settings/"
            target="_blank"
            rel="noreferrer"
          >
            Data rights and privacy settings
          </a>{' '}
          and{' '}
          <a
            href="https://support.spotify.com/us/article/understanding-your-data/"
            target="_blank"
            rel="noreferrer"
          >
            Understanding your data
          </a>
          .
        </p>
      </Card>
    </>
  );
}
