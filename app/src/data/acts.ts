import type { HabitBeat } from './habits';
import type { StoryBeat } from './narrative';

/**
 * The Story as an exhibition in three acts. This file only decides which chapter goes in which
 * act and in what order; the chapters themselves come from narrative.ts (years) and habits.ts.
 * Chapters not listed here (days, starts, sessions, albums) stay on the Habits page only.
 */

export type ActId = 'prologue' | 'past' | 'habits' | 'origins';

export interface Act {
  id: ActId;
  /** Roman numeral shown before the title; null for the prologue. */
  numeral: string | null;
  title: string;
  /** One line under the act heading. */
  intro: string;
}

export const ACTS: Record<ActId, Act> = {
  prologue: { id: 'prologue', numeral: null, title: 'Prologue', intro: '' },
  past: {
    id: 'past',
    numeral: 'I',
    title: 'Who you were',
    intro: 'The years, the names that carried them, and the ones you left behind.',
  },
  habits: {
    id: 'habits',
    numeral: 'II',
    title: 'How you listen',
    intro: 'Not what you played, but how: the hour, the skip, the song on repeat.',
  },
  origins: {
    id: 'origins',
    numeral: 'III',
    title: 'Where it comes from',
    intro: 'The places your artists come from, and a card to take with you.',
  },
};

export type StoryItem =
  { act: ActId; kind: 'year'; beat: StoryBeat } | { act: ActId; kind: 'habit'; beat: HabitBeat };

/** Habit chapters in Act II, in this order. */
const ACT_TWO = ['habit-hours', 'habit-skips', 'habit-loops'];

/**
 * Order every chapter into acts. Year beats keep their order; `open` is the prologue.
 * Act I: year chapters, constants, river, discoveries, left behind, then an artist chapter opened
 * from the library. Act II: hours, forward, loops. Act III: the country map when there is one,
 * otherwise the origins step, then the share card.
 */
export function storyActs(beats: StoryBeat[], extras: HabitBeat[]): StoryItem[] {
  const byId = new Map(extras.map((b) => [b.id, b]));
  const habit = (act: ActId, id: string): StoryItem[] => {
    const b = byId.get(id);
    return b ? [{ act, kind: 'habit', beat: b }] : [];
  };
  const out: StoryItem[] = [];
  for (const b of beats) out.push({ act: b.kind === 'open' ? 'prologue' : 'past', kind: 'year', beat: b });
  out.push(
    ...habit('past', 'habit-river'),
    ...habit('past', 'habit-new'),
    ...habit('past', 'habit-returned'),
  );
  for (const b of extras) if (b.kind === 'artist') out.push({ act: 'past', kind: 'habit', beat: b });
  for (const id of ACT_TWO) out.push(...habit('habits', id));
  const map = habit('origins', 'habit-countrymap');
  out.push(...(map.length > 0 ? map : habit('origins', 'step-origins')));
  out.push(...habit('origins', 'step-share'));
  return out;
}
