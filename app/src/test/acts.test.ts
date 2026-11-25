import { describe, expect, it } from 'vitest';
import { storyActs } from '../data/acts';
import type { HabitBeat } from '../data/habits';
import type { StoryBeat } from '../data/narrative';

const year = (id: string, kind: StoryBeat['kind']): StoryBeat => ({
  id,
  kind,
  label: id,
  title: id,
  big: 1,
  unit: '',
  caption: '',
  from: 0,
  to: 0,
  artists: [],
});
const habit = (id: string, kind?: HabitBeat['kind']): HabitBeat => ({
  id,
  kind,
  label: id,
  title: id,
  big: '1',
  unit: '',
  caption: '',
  values: [],
  labels: [],
  peak: -1,
});

describe('storyActs', () => {
  const beats = [year('open', 'open'), year('run-2017-A', 'lead'), year('constants', 'constants')];
  const extras = [
    habit('habit-hours'),
    habit('habit-days'),
    habit('habit-skips'),
    habit('habit-picks'),
    habit('habit-new'),
    habit('habit-sessions'),
    habit('habit-loops'),
    habit('habit-albums'),
    habit('habit-river', 'river'),
    habit('habit-returned', 'returned'),
    habit('artist-X', 'artist'),
    habit('step-origins', 'origins'),
    habit('step-share', 'share'),
  ];

  it('orders chapters into acts and leaves the rest to the Habits page', () => {
    const items = storyActs(beats, extras);
    expect(items.map((i) => `${i.act}:${i.beat.id}`)).toEqual([
      'prologue:open',
      'past:run-2017-A',
      'past:constants',
      'past:habit-river',
      'past:habit-new',
      'past:habit-returned',
      'past:artist-X',
      'habits:habit-hours',
      'habits:habit-skips',
      'habits:habit-loops',
      'origins:step-origins',
      'origins:step-share',
    ]);
  });

  it('uses the country map instead of the origins step when there is one', () => {
    const items = storyActs(beats, [...extras, habit('habit-countrymap', 'map')]);
    const ids = items.filter((i) => i.act === 'origins').map((i) => i.beat.id);
    expect(ids).toEqual(['habit-countrymap', 'step-share']);
  });

  it('skips chapters that the data could not support', () => {
    const items = storyActs([year('open', 'open')], [habit('step-share', 'share')]);
    expect(items.map((i) => i.beat.id)).toEqual(['open', 'step-share']);
  });
});
