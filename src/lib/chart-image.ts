import type { Cell } from "@/lib/chart-types";
import { FONTS, formatRank, mix, type ResolvedTheme } from "@/lib/theme";

/**
 * Draws a chart as a shareable image (title, covers in the chart's colours and fonts, the numbered
 * album list and a link back), all in the browser on a canvas. Covers come from Apple's and Deezer's
 * CDNs, which allow CORS; each is requested with an extra query so a cached non-CORS copy of the same
 * URL (from the page's own <img>) can't taint the canvas. A cover that fails to load is drawn as a blank tile.
 */

const W = 1080; // layout width in CSS pixels; drawn at 2x
const SCALE = 2;
const PAD = 64;

type Opts = { cells: Cell[]; title: string; theme: ResolvedTheme; showList: boolean; link?: string | undefined };

function loadCover(art: string): Promise<HTMLImageElement | null> {
  const big = art.replace(/\/\d+x\d+bb\./, "/600x600bb.").replace(/\/\d+x\d+-(\d+-\d+-\d+-\d+\.jpg)$/, "/500x500-$1");
  const src = `${big}${big.includes("?") ? "&" : "?"}crate-img=1`;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width <= max || !line) line = next;
    else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1]!;
    while (last.length > 1 && ctx.measureText(`${last}…`).width > max) last = last.slice(0, -1);
    kept[maxLines - 1] = `${last.trimEnd()}…`;
    return kept;
  }
  return lines;
}

function fit(ctx: CanvasRenderingContext2D, text: string, max: number) {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
}

/** Columns for N covers: a roughly square block, at least 2 and at most 10 across. */
const columnsFor = (n: number) => (n <= 4 ? Math.max(n, 1) : Math.min(10, Math.max(2, Math.ceil(Math.sqrt(n * 1.2)))));

export async function renderChartImage({ cells, title, theme, showList, link }: Opts): Promise<HTMLCanvasElement> {
  const { palette, shape, grid, cover } = theme;
  const display = `"${FONTS[theme.displayFont].family}", ${FONTS[theme.displayFont].fallback}`;
  const body = `"${FONTS[theme.bodyFont].family}", ${FONTS[theme.bodyFont].fallback}`;
  const heading = theme.titleCase === "upper" ? title.toUpperCase() : title;
  // Make sure the chart's web fonts are ready before measuring text with them.
  await Promise.all([
    document.fonts.load(`72px ${display}`, heading || "Crate").catch(() => {}),
    document.fonts.load(`500 26px ${body}`).catch(() => {}),
    document.fonts.load(`26px ${body}`).catch(() => {}),
  ]);

  const n = cells.length;
  const cols = columnsFor(n);
  const rows = Math.ceil(n / cols);
  const inner = W - PAD * 2;
  const gap = grid === "mosaic" ? 0 : Math.round(Math.max(theme.gap, 2) * (cols > 6 ? 1 : 1.5));
  const cellW = (inner - gap * (cols - 1)) / cols;
  const polaroid = grid === "polaroid";
  const cellH = polaroid ? cellW * 1.2 : cellW;
  const radius = shape === "circle" ? cellW / 2 : grid === "mosaic" ? 0 : theme.radius * (cellW / 160);

  const probe = document.createElement("canvas").getContext("2d")!;
  // Title block
  const titleSize = heading.length > 40 ? 56 : 72;
  probe.font = `${titleSize}px ${display}`;
  const titleLines = heading ? wrap(probe, heading, inner, 3) : [];
  probe.font = `26px ${body}`;
  const tagLines = theme.tagline ? wrap(probe, theme.tagline, inner, 2) : [];
  let y = PAD;
  const titleTop = y;
  y += titleLines.length * titleSize * 1.05;
  const tagTop = y + (titleLines.length ? 14 : 0);
  if (tagLines.length) y = tagTop + tagLines.length * 34;
  const gridTop = titleLines.length || tagLines.length ? y + 40 : y;
  y = gridTop + rows * cellH + (rows - 1) * gap;

  // Album list: up to 3 columns of 10; past 30 albums the rest are summed up as "+N more".
  const listed = showList ? cells.flatMap((c, i) => (c && (!theme.list.top || i < theme.list.top) ? [{ c, i }] : [])) : [];
  const shown = listed.slice(0, 30);
  const listCols = shown.length <= 6 ? 1 : shown.length <= 16 ? 2 : 3;
  const perCol = Math.ceil(shown.length / listCols);
  const lineH = listCols === 3 ? 30 : 34;
  const listTop = y + 48;
  if (shown.length) y = listTop + perCol * lineH + (listed.length > shown.length ? lineH : 0);
  const footerTop = y + 48;
  const H = footerTop + 30 + PAD;

  const canvas = document.createElement("canvas");
  canvas.width = W * SCALE;
  canvas.height = Math.round(H * SCALE);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(SCALE, SCALE);
  ctx.textBaseline = "top";

  // Background with the same soft accent glow as the page.
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, W * 0.8);
  glow.addColorStop(0, `${palette.accent}1f`);
  glow.addColorStop(1, `${palette.accent}00`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Title and tagline
  ctx.fillStyle = theme.preset === "outrun" ? palette.accent : palette.fg;
  ctx.font = `${titleSize}px ${display}`;
  titleLines.forEach((l, i) => ctx.fillText(l, PAD, titleTop + i * titleSize * 1.05));
  ctx.fillStyle = mix(palette.fg, palette.bg, 0.2);
  ctx.font = `26px ${body}`;
  tagLines.forEach((l, i) => ctx.fillText(l, PAD, tagTop + i * 34));

  // Covers
  const images = await Promise.all(cells.map((c) => (c ? loadCover(c.album.art) : Promise.resolve(null))));
  const empty = mix(palette.surface, palette.fg, 0.06);
  cells.forEach((c, i) => {
    const x = PAD + (i % cols) * (cellW + gap);
    const top = gridTop + Math.floor(i / cols) * (cellH + gap);
    let ix = x, iy = top, iw = cellW;
    if (polaroid && c) {
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.35)"; ctx.shadowBlur = 16; ctx.shadowOffsetY = 6;
      ctx.fillStyle = "#fdfcf8";
      roundRect(ctx, x, top, cellW, cellH, 3);
      ctx.fill();
      ctx.restore();
      ix = x + cellW * 0.06; iy = top + cellW * 0.06; iw = cellW * 0.88;
    }
    ctx.save();
    if (shape === "circle") { ctx.beginPath(); ctx.arc(ix + iw / 2, iy + iw / 2, iw / 2, 0, Math.PI * 2); }
    else roundRect(ctx, ix, iy, iw, iw, polaroid ? 0 : radius);
    ctx.clip();
    const img = images[i];
    if (c && img) {
      if (cover === "mono") ctx.filter = "grayscale(1) contrast(1.3)";
      ctx.drawImage(img, ix, iy, iw, iw);
      ctx.filter = "none";
      if (cover === "tint") {
        ctx.globalCompositeOperation = "multiply"; ctx.globalAlpha = 0.3;
        ctx.fillStyle = palette.accent; ctx.fillRect(ix, iy, iw, iw);
        ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
      }
    } else {
      ctx.fillStyle = empty;
      ctx.fillRect(ix, iy, iw, iw);
    }
    ctx.restore();
    if (shape === "circle" && c) {
      // CD spindle hole
      ctx.fillStyle = palette.bg;
      ctx.beginPath(); ctx.arc(ix + iw / 2, iy + iw / 2, iw * 0.085, 0, Math.PI * 2); ctx.fill();
    }
    if (polaroid && c) {
      ctx.fillStyle = "#2d2a26";
      ctx.font = `${Math.max(12, cellW * 0.08)}px ${display}`;
      ctx.fillText(fit(ctx, c.album.name, iw), ix, iy + iw + cellW * 0.03);
    }
  });

  // Album list
  if (shown.length) {
    const colW = (inner - (listCols - 1) * 32) / listCols;
    const size = listCols === 3 ? 19 : 22;
    shown.forEach(({ c, i }, k) => {
      const x = PAD + Math.floor(k / perCol) * (colW + 32);
      const ly = listTop + (k % perCol) * lineH;
      const rank = formatRank(i + 1, theme.list.num);
      let cx = x;
      if (rank) {
        ctx.font = `${size}px ${display}`;
        ctx.fillStyle = palette.accent;
        ctx.fillText(rank, x, ly);
        cx = x + Math.max(ctx.measureText(rank).width + 10, size * 1.7);
      }
      const room = x + colW - cx;
      ctx.font = `500 ${size}px ${body}`;
      ctx.fillStyle = palette.fg;
      const artist = fit(ctx, c.album.artist, room * 0.6);
      ctx.fillText(artist, cx, ly);
      const aw = ctx.measureText(artist).width;
      ctx.font = `${size}px ${body}`;
      ctx.fillStyle = palette.muted;
      ctx.fillText(fit(ctx, ` — ${c.album.name}`, room - aw), cx + aw, ly);
    });
    if (listed.length > shown.length) {
      ctx.font = `${size}px ${body}`;
      ctx.fillStyle = palette.muted;
      ctx.fillText(`+ ${listed.length - shown.length} more`, PAD, listTop + perCol * lineH);
    }
  }

  // Footer: link back to the chart
  ctx.strokeStyle = mix(palette.bg, palette.fg, 0.15);
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(PAD, footerTop - 20); ctx.lineTo(W - PAD, footerTop - 20); ctx.stroke();
  ctx.font = `italic 28px ${FONTS["instrument-serif"].family}, serif`;
  ctx.fillStyle = palette.fg;
  ctx.fillText("Crate", PAD, footerTop);
  ctx.font = `20px ${body}`;
  ctx.fillStyle = palette.muted;
  const linkText = link ? link.replace(/^https?:\/\//, "") : "Make your own album chart";
  ctx.textAlign = "right";
  ctx.fillText(fit(ctx, `🎧 ${linkText}`, inner - 120), W - PAD, footerTop + 6);
  ctx.textAlign = "left";
  return canvas;
}

export const canvasBlob = (canvas: HTMLCanvasElement, type: "image/png" | "image/jpeg") =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't make the image"))), type, 0.92));

export const imageFileName = (title: string) =>
  `${title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "crate-chart"}.jpg`;
