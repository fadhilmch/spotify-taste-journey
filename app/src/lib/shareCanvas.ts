import type { CardBits } from '../state/store';

export interface ShareCardData {
  rangeLabel: string;
  topArtist: string | null;
  /** An artist picked from a story chapter. Its numbers cover that artist only, over all time. */
  focus?: { name: string; minutes: number; firstMonth: string; lastMonth: string } | null;
  topTrack: { name: string; artist: string } | null;
  totalMinutes: number;
  topGenre: string | null;
  eraCount: number;
  sourceLabel: string; // 'demo data' or 'my Spotify export'
  genreCredit: string | null; // e.g. 'Genre data: MusicBrainz (CC BY-NC-SA)'
}

/** The line under a chapter artist's name. States its scope: this artist, all time. */
export function focusLine(f: { minutes: number; firstMonth: string; lastMonth: string }): string {
  return `${fmtCardMinutes(f.minutes)} played by this artist, ${f.firstMonth} to ${f.lastMonth}`;
}

export function fmtCardMinutes(min: number): string {
  if (min >= 60000) return `${(min / 60000).toFixed(1)}k hours`;
  if (min >= 1000) return `${(min / 1000).toFixed(1)}k minutes`;
  return `${min} minutes`;
}

/**
 * Renders the share card on a canvas (1080x1350). Everything is drawn locally;
 * no history data leaves the device.
 */
export function renderShareCard(canvas: HTMLCanvasElement, data: ShareCardData, bits: CardBits): void {
  const W = 1080;
  const H = 1350;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported in this browser.');

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#1ed76022');
  bg.addColorStop(0.25, '#121212');
  bg.addColorStop(1, '#000000');
  ctx.fillStyle = '#121212';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const pad = 96;
  let y = pad + 40;

  ctx.fillStyle = '#1ed760';
  ctx.font = '700 34px Nunito, system-ui, sans-serif';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(`MY TASTE JOURNEY - ${data.rangeLabel.toUpperCase()}`, pad, y);
  // The artist sits in the upper-middle of the card; the figures are anchored above the footer.
  y = 400;

  const wrap = (text: string, maxWidth: number, maxLines: number): string[] => {
    const words = text.split(/\s+/).filter(Boolean);
    const out: string[] = [];
    let cur = '';
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (cur && ctx.measureText(next).width > maxWidth) {
        out.push(cur);
        cur = w;
      } else cur = next;
    }
    if (cur) out.push(cur);
    if (out.length > maxLines) {
      const kept = out.slice(0, maxLines);
      let last = kept[maxLines - 1] ?? '';
      while (last.length > 1 && ctx.measureText(`${last}...`).width > maxWidth) last = last.slice(0, -1);
      kept[maxLines - 1] = `${last}...`;
      return kept;
    }
    // A single unbroken word wider than the box still has to fit.
    return out.map((l) => {
      let t = l;
      while (t.length > 1 && ctx.measureText(t).width > maxWidth) t = t.slice(0, -1);
      return t === l ? l : `${t}...`;
    });
  };
  /** Biggest size that keeps the name on one line, else two lines, else three smaller lines. */
  const headline = (text: string, maxWidth: number, start: number): { size: number; lines: string[] } => {
    for (let size = start; size >= 72; size -= 6) {
      ctx.font = `900 ${size}px Nunito, system-ui, sans-serif`;
      const l = wrap(text, maxWidth, 2);
      if (l.length === 1 || (l.length === 2 && size <= 110 && !l[1]?.endsWith('...'))) {
        if (ctx.measureText(l.join(' ')).width <= maxWidth || l.length === 2) return { size, lines: l };
      }
    }
    ctx.font = '900 60px Nunito, system-ui, sans-serif';
    return { size: 60, lines: wrap(text, maxWidth, 4) };
  };
  const drawHead = (text: string): void => {
    const h = headline(text, W - pad * 2, 150);
    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${h.size}px Nunito, system-ui, sans-serif`;
    h.lines.forEach((l, i) => ctx.fillText(l, pad, y + h.size + i * Math.round(h.size * 1.08)));
    y += h.size + (h.lines.length - 1) * Math.round(h.size * 1.08);
  };

  if (bits.artist && data.focus) {
    ctx.fillStyle = '#ffffff99';
    ctx.font = '700 32px Nunito, system-ui, sans-serif';
    ctx.fillText('Chapter artist', pad, y);
    y += 34;
    drawHead(data.focus.name);
    y += 70;
    ctx.fillStyle = '#ffffffe0';
    ctx.font = '700 32px Nunito, system-ui, sans-serif';
    ctx.fillText(focusLine(data.focus), pad, y, W - pad * 2);
  } else if (bits.artist && data.topArtist) {
    ctx.fillStyle = '#ffffff99';
    ctx.font = '700 32px Nunito, system-ui, sans-serif';
    ctx.fillText('Top artist', pad, y);
    y += 34;
    drawHead(data.topArtist);
  }
  const lines: string[] = [];
  if (bits.track && data.topTrack) lines.push(`"${data.topTrack.name}" - ${data.topTrack.artist}`);
  if (bits.minutes) lines.push(`${fmtCardMinutes(data.totalMinutes)} listened`);
  if (bits.genre && data.topGenre) lines.push(`Top genre: ${data.topGenre}`);
  if (bits.eras) lines.push(`${data.eraCount} artist eras`);
  ctx.font = '700 44px Nunito, system-ui, sans-serif';
  const rows = lines.flatMap((l) => wrap(l, W - pad * 2, 3));
  const label =
    data.focus && lines.length > 0 ? `ACROSS ALL YOUR LISTENING - ${data.rangeLabel.toUpperCase()}` : null;
  // Block height: optional label, then one 72 px row per line; its last baseline sits 130 px above the footer.
  const blockTop = H - pad - 130 - (rows.length > 0 ? (rows.length - 1) * 72 : 0) - (label ? 70 : 0);
  if (rows.length > 0) {
    ctx.fillStyle = '#ffffff22';
    ctx.fillRect(pad, blockTop - 70, W - pad * 2, 2);
  }
  let ys = blockTop;
  if (label) {
    ctx.fillStyle = '#ffffff99';
    ctx.font = '700 30px Nunito, system-ui, sans-serif';
    ctx.fillText(label, pad, ys);
    ys += 70;
  }
  ctx.fillStyle = '#ffffffe0';
  ctx.font = '700 44px Nunito, system-ui, sans-serif';
  for (const line of rows) {
    ctx.fillText(line, pad, ys);
    ys += 72;
  }

  ctx.fillStyle = '#ffffff80';
  ctx.font = '700 30px Nunito, system-ui, sans-serif';
  let footer = `taste journey - ${data.sourceLabel}`;
  if (data.genreCredit) footer += ` | ${data.genreCredit}`;
  ctx.fillText(footer, pad, H - pad, W - pad * 2);
}

export function downloadShareCard(canvas: HTMLCanvasElement, filename: string): void {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}
