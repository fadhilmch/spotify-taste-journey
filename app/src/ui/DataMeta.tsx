import { coverageLabel, looksLikePartialHistory } from '../data/coverage';
import { useAppStore } from '../state/store';

/**
 * What was loaded, in one line, with the full reading notes behind a
 * disclosure. The story stays at the top of the page; the details stay
 * one tap away.
 */
export function DataMeta() {
  const parseInfo = useAppStore((s) => s.parseInfo);
  const fileReports = useAppStore((s) => s.fileReports);
  const fileName = useAppStore((s) => s.fileName);
  if (!parseInfo) return null;

  const summary = [
    `${parseInfo.eventCount.toLocaleString()} plays`,
    parseInfo.firstTs && parseInfo.lastTs
      ? `${coverageLabel(parseInfo.firstTs)} to ${coverageLabel(parseInfo.lastTs)}`
      : null,
    'read in this tab, never uploaded',
  ]
    .filter(Boolean)
    .join(' · ');

  const notHistory = (fileReports ?? []).filter((r) => r.status === 'not-history');
  const unreadable = (fileReports ?? []).filter((r) => r.status === 'unreadable');
  const names = (list: typeof notHistory) =>
    list
      .slice(0, 4)
      .map((r) => r.name)
      .join(', ') + (list.length > 4 ? `, +${list.length - 4} more` : '');

  return (
    <>
      <details className="tj-meta">
        <summary>
          <span className="tj-meta-line">{summary}</span>
          <span className="tj-meta-how">How this was read</span>
        </summary>
        <div className="tj-meta-body">
          <p>
            {fileName ? `Loaded ${fileName}. ` : ''}
            {parseInfo.eventCount.toLocaleString()} plays read
            {parseInfo.files && parseInfo.files > 1 ? ` from ${parseInfo.files} history files` : ''}
            {parseInfo.format
              ? ` (${parseInfo.format === 'extended' ? 'extended' : 'legacy'} export)`
              : ' (extended and legacy exports combined)'}
            {parseInfo.skipped > 0
              ? `, ${parseInfo.skipped.toLocaleString()} non-music or invalid rows skipped`
              : ''}
            {(parseInfo.duplicates ?? 0) > 0
              ? `, ${parseInfo.duplicates!.toLocaleString()} duplicate rows merged`
              : ''}
            {(parseInfo.crossPackageDuplicates ?? 0) > 0
              ? `, ${parseInfo.crossPackageDuplicates!.toLocaleString()} plays already in your extended history removed`
              : ''}
            . Parsed in this browser tab and never uploaded. Only listening fields (time, track, artist,
            milliseconds played) are read; anything else in the export is ignored.
          </p>
          {notHistory.length > 0 && (
            <p>
              {notHistory.length === 1
                ? '1 file had no listening history and was skipped: '
                : `${notHistory.length} files had no listening history and were skipped: `}
              {names(notHistory)}.
            </p>
          )}
          {unreadable.length > 0 && (
            <p>
              {unreadable.length === 1
                ? '1 file could not be read as JSON and was skipped: '
                : `${unreadable.length} files could not be read as JSON and were skipped: `}
              {names(unreadable)}.
            </p>
          )}
        </div>
      </details>
      {parseInfo.firstTs && looksLikePartialHistory(parseInfo) && (
        <p className="tj-note">
          This looks like Spotify&apos;s 1-year Account data export - request the Extended streaming history
          package for your full history (see the guide).
        </p>
      )}
    </>
  );
}
