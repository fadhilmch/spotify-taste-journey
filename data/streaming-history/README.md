# Personal streaming history (sanitized)

Fadhil's own Spotify Extended Streaming History, requested from Spotify on
2026-10-21 and added here for real-data testing of the Taste Journey import.
Covers October 2016 to October 2026.

Only music plays are included, with the fields the app actually reads:

- `ts`, `ms_played`
- `master_metadata_track_name`, `master_metadata_album_artist_name`,
  `master_metadata_album_album_name`, `spotify_track_uri`
- `reason_start`, `reason_end`, `shuffle`, `skipped`, `offline`

Removed before committing, in line with the repo's privacy rules:

- Podcast episodes, audiobooks and video history (the app only uses music rows)
- IP addresses, connection country and platform/device fields
- Private-session (incognito) plays and all private-session metadata
- A small number of rows whose content is personal rather than musical

173,169 plays remain. The original export stays private and is not part of
this repository.
