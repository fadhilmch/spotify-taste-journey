import { describe, expect, it } from 'vitest';
import { focusLine } from '../lib/shareCanvas';

describe('focusLine', () => {
  it('says the numbers belong to the artist and gives the span', () => {
    expect(focusLine({ minutes: 8716, firstMonth: '2024-05', lastMonth: '2026-10' })).toBe(
      '8.7k minutes played by this artist, 2024-05 to 2026-10',
    );
  });
});
