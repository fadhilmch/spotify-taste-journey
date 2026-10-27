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
  y += 110;

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
    const size = fit(data.focus.name, W - pad * 2, 116);
    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${size}px Nunito, system-ui, sans-serif`;
    ctx.fillText(data.focus.name, pad, y + size);
    y += size + 70;
    ctx.fillStyle = '#ffffffe0';
    ctx.font = '700 32px Nunito, system-ui, sans-serif';
    ctx.fillText(focusLine(data.focus), pad, y, W - pad * 2);
    y += 100;
  } else if (bits.artist && data.topArtist) {
    ctx.fillStyle = '#ffffff99';
    ctx.font = '700 32px Nunito, system-ui, sans-serif';
    ctx.fillText('Top artist', pad, y);
    y += 34;
    const size = fit(data.topArtist, W - pad * 2, 116);
    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${size}px Nunito, system-ui, sans-serif`;
    ctx.fillText(data.topArtist, pad, y + size);
    y += size + 70;
  }
  if (data.focus && (bits.track || bits.minutes || bits.genre)) {
    ctx.fillStyle = '#ffffff99';
    ctx.font = '700 30px Nunito, system-ui, sans-serif';
    ctx.fillText(`ACROSS ALL YOUR LISTENING - ${data.rangeLabel.toUpperCase()}`, pad, y);
    y += 70;
  }
  ctx.fillStyle = '#ffffffe0';
  ctx.font = '700 44px Nunito, system-ui, sans-serif';
  if (bits.track && data.topTrack) {
    ctx.fillText(`"${data.topTrack.name}" - ${data.topTrack.artist}`, pad, y, W - pad * 2);
    y += 72;
  }
  if (bits.minutes) {
    ctx.fillText(`${fmtCardMinutes(data.totalMinutes)} listened`, pad, y);
    y += 72;
  }
  if (bits.genre && data.topGenre) {
    ctx.fillText(`Top genre: ${data.topGenre}`, pad, y);
    y += 72;
  }
  if (bits.eras) {
    ctx.fillText(`${data.eraCount} artist eras`, pad, y);
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
