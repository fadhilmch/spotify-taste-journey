import { Card } from './primitives';

type Rule = [term: string, rule: string];

function Rules({ items }: { items: Rule[] }) {
  return (
    <dl>
      {items.map(([t, d]) => (
        <div key={t}>
          <dt>{t}</dt>
          <dd>{d}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Every counting rule in one place, stated as the code does it. */
export function MethodView() {
  return (
    <div className="tj-method flex flex-col gap-4">
      <Card id="tj-m-read-h" title="What is read">
        <ul>
          <li>
            Only listening fields: time, track, artist, album, milliseconds played, how a play started and
            ended, shuffle, offline and platform.
          </li>
          <li>Nothing from your export is uploaded. Files are read in this browser tab.</li>
          <li>
            The one network call is the MusicBrainz lookup, and only if you turn it on. It sends artist names
            and nothing else.
          </li>
          <li>Demo data is invented. It is not anyone&apos;s listening.</li>
        </ul>
      </Card>

      <Card id="tj-m-time-h" title="Time">
        <Rules
          items={[
            ['Hours', 'Milliseconds played divided by 3,600,000.'],
            ['Time zone', 'Times of day use your browser time zone.'],
            [
              'Ranges',
              'Ranges are whole calendar months. "Last month" is the last calendar month in your history, not the last 30 days.',
            ],
            [
              'Partial years',
              'A first or last year that does not cover 12 months is compared per month and marked *.',
            ],
          ]}
        />
      </Card>

      <Card id="tj-m-story-h" title="Story chapters">
        <Rules
          items={[
            ['Chapter', 'A run of years with the same most-played artist.'],
            [
              'Title wording',
              'Set by that artist\'s share of the run\'s hours: 25% or more is "takes over", 10% to 25% is "leads", under 10% is "wide open".',
            ],
            [
              'Quiet year',
              'The full year with the fewest hours per month, if it is at most 75% of the median full year and its top artist has under 5% of its hours. Needs at least 3 full years.',
            ],
          ]}
        />
      </Card>

      <Card id="tj-m-habits-h" title="Habits">
        <Rules
          items={[
            [
              'Forward',
              "A play whose recorded ending is the forward button (reason_end fwdbtn). Spotify's own skipped flag is not used: in some years it is never true while forward endings are recorded.",
            ],
            ['Chosen starts', 'Plays that started from clickrow, playbtn or backbtn.'],
            ['Sessions', 'A new session starts after 30 minutes without a play.'],
            ['Loop', 'The same track 5 or more times in a row, each starting within 30 minutes of the last.'],
            ['Went into an album', '8 or more different tracks from it played.'],
            ['Left behind', 'At least 120 minutes in total and no plays for 12 months or more.'],
            ['Discovery', 'The first month an artist appears in your history.'],
          ]}
        />
      </Card>

      <Card id="tj-m-origins-h" title="Origins and genres">
        <ul>
          <li>
            Both come from MusicBrainz, matched by artist name only. A match is a name match, not a verified
            identity.
          </li>
          <li>
            A match is accepted only if the top result scores 100, its name or alias equals the artist name,
            and no other result also scores 100.
          </li>
          <li>Country is the artist country MusicBrainz records. It is never where you listened.</li>
          <li>Genre groups are broad buckets built from community tags.</li>
          <li>Artists without a confident match stay Uncategorized. Nothing is guessed.</li>
          <li>Licences: country and area data is CC0. Tags are CC BY-NC-SA 3.0.</li>
        </ul>
      </Card>

      <Card id="tj-m-never-h" title="What this never says">
        <p className="tj-note">Why your listening changed. It counts plays. The reasons are yours.</p>
      </Card>
    </div>
  );
}
