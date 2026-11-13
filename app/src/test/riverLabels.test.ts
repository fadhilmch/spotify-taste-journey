import { describe, expect, it } from 'vitest';
import { LABEL_GAP, fitName, placeLabels } from '../ui/riverLabels';

describe('river labels', () => {
  it('places every wished label, spaced apart and inside the picture', () => {
    const wishes = [
      { artist: 'A', y: 100, cx: 160 },
      { artist: 'B', y: 102, cx: 170 },
      { artist: 'C', y: 430, cx: 160 },
      { artist: 'D', y: 432, cx: 160 },
      { artist: 'E', y: 434, cx: 160 },
    ];
    const out = placeLabels(wishes, 320, 25, 430);
    expect(out).toHaveLength(5);
    for (let i = 1; i < out.length; i += 1) expect(out[i].y - out[i - 1].y).toBeGreaterThanOrEqual(LABEL_GAP);
    for (const l of out) {
      expect(l.y).toBeGreaterThanOrEqual(25);
      expect(l.y).toBeLessThanOrEqual(430);
    }
  });
  it('keeps a wide name inside the left and right edges', () => {
    const [l] = placeLabels([{ artist: 'Monochrome Club', y: 50, cx: 310 }], 320, 25, 430);
    expect(l.x + (l.text.length * 6.4) / 2).toBeLessThanOrEqual(316);
    const [m] = placeLabels([{ artist: 'Monochrome Club', y: 50, cx: 2 }], 320, 25, 430);
    expect(m.x - (m.text.length * 6.4) / 2).toBeGreaterThanOrEqual(4 - 0.01);
  });
  it('shortens a name that cannot fit', () => {
    expect(fitName('A very very very very very very long artist name indeed', 100).endsWith('…')).toBe(true);
    expect(fitName('Short', 100)).toBe('Short');
  });
});
