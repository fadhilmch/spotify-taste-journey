export interface LabelWish {
  artist: string;
  /** Wanted vertical position (the artist's busiest month). */
  y: number;
  /** Wanted horizontal centre (the middle of the artist's band there). */
  cx: number;
}

export interface PlacedLabel {
  artist: string;
  text: string;
  x: number;
  y: number;
}

export const LABEL_SIZE = 11;
export const LABEL_GAP = 15;
const CHAR_W = 6.4;

/** Cut a name so it fits the width, with an ellipsis. */
export function fitName(name: string, maxW: number): string {
  const max = Math.max(4, Math.floor(maxW / CHAR_W));
  return name.length <= max ? name : `${name.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Lay every label out inside the picture: centred on its band, kept inside the left and right
 * edges, at least LABEL_GAP apart vertically, and never pushed past the top or bottom. Every
 * wished label gets a place, so none is dropped.
 */
export function placeLabels(wishes: LabelWish[], width: number, top: number, bottom: number): PlacedLabel[] {
  const sorted = [...wishes].sort((a, b) => a.y - b.y);
  const ys: number[] = [];
  sorted.forEach((w, i) => {
    const want = Math.min(Math.max(w.y, top), bottom);
    ys.push(i === 0 ? want : Math.max(want, ys[i - 1] + LABEL_GAP));
  });
  // If the stack ran past the bottom, move it back up from the end.
  for (let i = ys.length - 1; i >= 0; i -= 1) {
    const limit = i === ys.length - 1 ? bottom : ys[i + 1] - LABEL_GAP;
    if (ys[i] > limit) ys[i] = limit;
  }
  return sorted.map((w, i) => {
    const text = fitName(w.artist, width - 8);
    const half = (text.length * CHAR_W) / 2;
    const x = Math.min(Math.max(w.cx, 4 + half), width - 4 - half);
    return { artist: w.artist, text, x, y: ys[i] };
  });
}
