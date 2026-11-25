/** Stable display colors for genre groups and artists. */
export const GROUP_HUES: Record<string, number> = {
  Rock: 4,
  Pop: 300,
  Electronic: 96,
  'R&B & soul': 262,
  Jazz: 210,
  'Folk & acoustic': 160,
  'Ambient & classical': 190,
  'Hip-hop': 46,
  'Latin & world': 330,
};

export function groupHue(group: string): number {
  return GROUP_HUES[group] ?? 0;
}

export function artistHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

export function artistBackground(name: string): string {
  const hue = artistHue(name);
  return `hsl(${hue} 28% 30%)`;
}
