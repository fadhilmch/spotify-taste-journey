import React from 'react';
import { useAppStore } from '../state/store';
import { FileInput } from './primitives';

export function SourceBar() {
  const source = useAppStore((s) => s.source);
  const loadDemo = useAppStore((s) => s.loadDemo);
  const loadFiles = useAppStore((s) => s.loadFiles);
  const inputRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className="tj-sourcebar">
      <div className="tj-source" role="group" aria-label="Data source">
        <button type="button" className={'tj-src' + (source === 'demo' ? ' is-on' : '')} onClick={loadDemo}>
          Demo data
        </button>
        <button
          type="button"
          className={'tj-src' + (source === 'export' ? ' is-on' : '')}
          onClick={() => inputRef.current?.click()}
        >
          Your export
        </button>
        <FileInput
          inputRef={inputRef}
          accept=".json,.zip,application/json,application/zip"
          label="Choose your Spotify export ZIP or streaming history JSON files"
          onFiles={(fs) => void loadFiles(fs)}
        />
      </div>
      {source === 'demo' && (
        <p className="tj-srcnote">
          Everything below runs on invented demo data - same shape as a real Spotify export, so the screens
          stay identical when yours lands.
        </p>
      )}
    </div>
  );
}
