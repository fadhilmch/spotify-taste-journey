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

  const fit = (text: string, maxWidth: number, start: number): number => {
    let size = start;
    ctx.font = `900 ${size}px Nunito, system-ui, sans-serif`;
    while (size > 40 && ctx.measureText(text).width > maxWidth) {
      size -= 6;
      ctx.font = `900 ${size}px Nunito, system-ui, sans-serif`;
    }
    return size;
  };

  if (bits.artist && data.focus) {
    ctx.fillStyle = '#ffffff99';
    ctx.font = '700 32px Nunito, system-ui, sans-serif';
    ctx.fillText('Chapter artist', pad, y);
    y += 34;
    const size = fit(data.focus.name, W - pad * 2, 150);
    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${size}px Nunito, system-ui, sans-serif`;
    ctx.fillText(data.focus.name, pad, y + size);
    y += size + 70;
    ctx.fillStyle = '#ffffffe0';
    ctx.font = '700 32px Nunito, system-ui, sans-serif';
    ctx.fillText(focusLine(data.focus), pad, y, W - pad * 2);
  } else if (bits.artist && data.topArtist) {
    ctx.fillStyle = '#ffffff99';
    ctx.font = '700 32px Nunito, system-ui, sans-serif';
    ctx.fillText('Top artist', pad, y);
    y += 34;
    const size = fit(data.topArtist, W - pad * 2, 150);
    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${size}px Nunito, system-ui, sans-serif`;
    ctx.fillText(data.topArtist, pad, y + size);
  }
  const lines: string[] = [];
  if (bits.track && data.topTrack) lines.push(`"${data.topTrack.name}" - ${data.topTrack.artist}`);
  if (bits.minutes) lines.push(`${fmtCardMinutes(data.totalMinutes)} listened`);
  if (bits.genre && data.topGenre) lines.push(`Top genre: ${data.topGenre}`);
  if (bits.eras) lines.push(`${data.eraCount} artist eras`);
  const label =
    data.focus && lines.length > 0 ? `ACROSS ALL YOUR LISTENING - ${data.rangeLabel.toUpperCase()}` : null;
  // Block height: optional label, then one 72 px row per line; its last baseline sits 130 px above the footer.
  const blockTop = H - pad - 130 - (lines.length > 0 ? (lines.length - 1) * 72 : 0) - (label ? 70 : 0);
  if (lines.length > 0) {
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
  for (const line of lines) {
    ctx.fillText(line, pad, ys, W - pad * 2);
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
