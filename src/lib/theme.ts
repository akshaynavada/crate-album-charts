import { z } from "zod";
import type { CSSProperties } from "react";

/* ------------------------------------------------------------------ fonts */

/** Allowlisted Google Fonts. `q` is the css2 `family=` value. */
export const FONTS = {
  "instrument-serif": { family: "Instrument Serif", q: "Instrument+Serif:ital@0;1", fallback: "serif" },
  "dm-sans": { family: "DM Sans", q: "DM+Sans:wght@400;500;700", fallback: "sans-serif" },
  "archivo-black": { family: "Archivo Black", q: "Archivo+Black", fallback: "sans-serif" },
  "courier-prime": { family: "Courier Prime", q: "Courier+Prime:wght@400;700", fallback: "monospace" },
  "permanent-marker": { family: "Permanent Marker", q: "Permanent+Marker", fallback: "cursive" },
  "space-mono": { family: "Space Mono", q: "Space+Mono:wght@400;700", fallback: "monospace" },
  unbounded: { family: "Unbounded", q: "Unbounded:wght@400;700", fallback: "sans-serif" },
  "space-grotesk": { family: "Space Grotesk", q: "Space+Grotesk:wght@400;500;700", fallback: "sans-serif" },
  "bebas-neue": { family: "Bebas Neue", q: "Bebas+Neue", fallback: "sans-serif" },
  "ibm-plex-mono": { family: "IBM Plex Mono", q: "IBM+Plex+Mono:wght@400;500;700", fallback: "monospace" },
  oswald: { family: "Oswald", q: "Oswald:wght@400;600", fallback: "sans-serif" },
  "source-serif": { family: "Source Serif 4", q: "Source+Serif+4:wght@400;600", fallback: "serif" },
  fraunces: { family: "Fraunces", q: "Fraunces:ital,wght@0,400;1,400", fallback: "serif" },
  caveat: { family: "Caveat", q: "Caveat:wght@500;700", fallback: "cursive" },
  michroma: { family: "Michroma", q: "Michroma", fallback: "sans-serif" },
  inter: { family: "Inter", q: "Inter:wght@400;500;700", fallback: "sans-serif" },
  syne: { family: "Syne", q: "Syne:wght@500;700", fallback: "sans-serif" },
} as const;
type FontId = keyof typeof FONTS;

export const fontsHref = (ids: FontId[], text?: string) =>
  `https://fonts.googleapis.com/css2?${[...new Set(ids)].map((id) => `family=${FONTS[id].q}`).join("&")}&display=swap${text ? `&text=${encodeURIComponent(text)}` : ""}`;

/* ---------------------------------------------------------------- presets */

export type GridStyle = "tight" | "gapped" | "polaroid" | "tilt" | "mosaic";
export type Palette = { bg: string; surface: string; fg: string; muted: string; accent: string };
type Preset = {
  name: string; vibe: string; palette: Palette;
  display: FontId; body: FontId; grid: GridStyle; radius: number; gap: number;
};

export const PRESETS = {
  crate: { name: "Crate", vibe: "The original late-night dark", palette: { bg: "#08090b", surface: "#121316", fg: "#eeeff1", muted: "#9c9ea3", accent: "#e8e9eb" }, display: "instrument-serif", body: "dm-sans", grid: "gapped", radius: 6, gap: 8 },
  "dollar-bin": { name: "Dollar Bin", vibe: "Thrift-store vinyl in kraft boxes", palette: { bg: "#cdb088", surface: "#e4d2ae", fg: "#2a1e12", muted: "#6b5640", accent: "#c2412d" }, display: "archivo-black", body: "courier-prime", grid: "tilt", radius: 2, gap: 8 },
  c90: { name: "C90", vibe: "A mixtape for a crush", palette: { bg: "#1e1b2e", surface: "#2b2740", fg: "#f4ebdd", muted: "#a69fbf", accent: "#ff7a3d" }, display: "permanent-marker", body: "space-mono", grid: "gapped", radius: 4, gap: 12 },
  warehouse: { name: "4AM Warehouse", vibe: "Neon, smoke and a kick drum", palette: { bg: "#07060b", surface: "#12101c", fg: "#ede9ff", muted: "#8a84a8", accent: "#39ff88" }, display: "unbounded", body: "space-grotesk", grid: "tight", radius: 0, gap: 2 },
  xerox: { name: "Xerox Zine", vibe: "Photocopied, stapled, DIY", palette: { bg: "#f2f0ea", surface: "#ffffff", fg: "#111111", muted: "#555555", accent: "#ff3b1f" }, display: "bebas-neue", body: "ibm-plex-mono", grid: "gapped", radius: 0, gap: 10 },
  "blue-hour": { name: "Blue Hour", vibe: "Late-’50s jazz sleeves", palette: { bg: "#0f2a44", surface: "#16365a", fg: "#f3eedc", muted: "#9fb2c8", accent: "#e8b33a" }, display: "oswald", body: "source-serif", grid: "mosaic", radius: 0, gap: 0 },
  "listening-room": { name: "Listening Room", vibe: "Walnut hi-fi and a warm tube amp", palette: { bg: "#2b1d14", surface: "#3a281c", fg: "#f5e6cf", muted: "#bfa88a", accent: "#d98e3a" }, display: "fraunces", body: "dm-sans", grid: "gapped", radius: 10, gap: 12 },
  polaroid: { name: "Sunday Morning", vibe: "Pastel polaroids on the fridge", palette: { bg: "#fbf3e4", surface: "#ffffff", fg: "#2d2a26", muted: "#7a7268", accent: "#e86a92" }, display: "caveat", body: "dm-sans", grid: "polaroid", radius: 2, gap: 14 },
  "burned-cd": { name: "Burned CD", vibe: "Y2K chrome and a Sharpie", palette: { bg: "#dce3ea", surface: "#f4f7fa", fg: "#0b1b2b", muted: "#5b6b7b", accent: "#2f6bff" }, display: "michroma", body: "inter", grid: "gapped", radius: 999, gap: 10 },
  riso: { name: "Riso Press", vibe: "Two-colour risograph print", palette: { bg: "#fff8ec", surface: "#ffefd6", fg: "#1d3fbb", muted: "#6e7bc4", accent: "#ff48b0" }, display: "syne", body: "space-grotesk", grid: "gapped", radius: 0, gap: 8 },
} satisfies Record<string, Preset>;
export type PresetId = keyof typeof PRESETS;
export const PRESET_IDS = Object.keys(PRESETS) as PresetId[];

export const GRID_STYLES: { id: GridStyle; label: string }[] = [
  { id: "tight", label: "Tight" }, { id: "gapped", label: "Gapped" }, { id: "polaroid", label: "Polaroid" },
  { id: "tilt", label: "Tilted" }, { id: "mosaic", label: "Mosaic" },
];

export const ACCENT_SWATCHES = ["#ff5a5f", "#ff9f1c", "#ffd23f", "#3ddc97", "#2ec4ff", "#5b5bff", "#c86bff", "#ff6fb5"];

/* ----------------------------------------------------------------- schema */

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const themeSchema = z.object({
  v: z.literal(1),
  preset: z.enum(PRESET_IDS as [PresetId, ...PresetId[]]),
  /** Full palette from "Match my #1"; stored so every visitor sees the same colours. */
  palette: z.object({ bg: hex, surface: hex, fg: hex, muted: hex, accent: hex }).optional(),
  accent: hex.optional(),
  grid: z.enum(["tight", "gapped", "polaroid", "tilt", "mosaic"]).optional(),
  tagline: z.string().max(120).optional(),
});
export type CrateTheme = z.infer<typeof themeSchema>;
export const DEFAULT_THEME: CrateTheme = { v: 1, preset: "crate" };
export const parseTheme = (x: unknown): CrateTheme => themeSchema.safeParse(x).data ?? DEFAULT_THEME;

/* ------------------------------------------------------------ colour math */

const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
const toHex = (c: number[]) => `#${c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`;
export const mix = (a: string, b: string, t: number) => { const x = rgb(a), y = rgb(b); return toHex(x.map((v, i) => v + (y[i]! - v) * t)); };
const lum = (h: string) => {
  const [r, g, b] = rgb(h).map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
export const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x! + 0.05) / (y! + 0.05); };

/** Nudges `c` toward `toward` until it reaches `min` contrast against `bg`. */
function ensureContrast(c: string, bg: string, toward: string, min: number) {
  let out = c;
  for (let t = 0.1; contrast(out, bg) < min && t <= 1; t += 0.1) out = mix(c, toward, t);
  return out;
}

export type ResolvedTheme = {
  preset: PresetId; palette: Palette; grid: GridStyle; adjusted: boolean; light: boolean;
  style: CSSProperties; attrs: Record<string, string>; fontHref: string; tagline: string;
};

export function resolveTheme(input: CrateTheme | undefined): ResolvedTheme {
  const t = input ?? DEFAULT_THEME;
  const p = PRESETS[t.preset] ?? PRESETS.crate;
  const base = t.palette ?? p.palette;
  const light = lum(base.bg) > 0.4;
  const rawAccent = t.accent ?? base.accent;
  const accent = ensureContrast(rawAccent, base.bg, base.fg, 3);
  const muted = ensureContrast(base.muted, base.bg, base.fg, 4.5);
  const palette = { ...base, accent, muted };
  const grid = t.grid ?? p.grid;
  const onAccent = contrast("#0b0b0c", accent) >= contrast("#fafaf7", accent) ? "#0b0b0c" : "#fafaf7";
  const d = FONTS[p.display], b = FONTS[p.body];
  const style = {
    "--background": base.bg, "--foreground": base.fg,
    "--card": base.surface, "--card-foreground": base.fg,
    "--popover": base.surface, "--popover-foreground": base.fg,
    "--primary": accent, "--primary-foreground": onAccent,
    "--secondary": mix(base.surface, base.fg, 0.08), "--secondary-foreground": base.fg,
    "--muted": mix(base.surface, base.fg, 0.06), "--muted-foreground": muted,
    "--accent": mix(base.surface, base.fg, 0.1), "--accent-foreground": base.fg,
    "--border": mix(base.bg, base.fg, 0.15), "--input": mix(base.bg, base.fg, 0.18), "--ring": accent,
    "--crate-display": `"${d.family}", ${d.fallback}`, "--crate-sans": `"${b.family}", ${b.fallback}`,
    "--crate-radius": `${grid === "mosaic" ? 0 : Math.min(p.radius, 999)}px`,
    "--crate-gap": `${grid === "tight" ? 2 : grid === "mosaic" ? 0 : p.gap}px`,
    "--shadow-record": light ? "0 20px 40px -24px rgb(0 0 0 / 0.35)" : "0 20px 50px -20px rgb(0 0 0 / 0.8)",
    colorScheme: light ? "light" : "dark",
  } as CSSProperties;
  return {
    preset: t.preset, palette, grid, light, adjusted: accent !== rawAccent, style,
    attrs: { "data-preset": t.preset, "data-grid": grid },
    fontHref: fontsHref([p.display, p.body]),
    tagline: t.tagline?.trim() ?? "",
  };
}

/** Every preset's display font, limited to the letters in the preset names (tiny request for the swatches). */
export const swatchFontsHref = () =>
  fontsHref(PRESET_IDS.map((id) => PRESETS[id].display), [...new Set(PRESET_IDS.map((id) => PRESETS[id].name).join(""))].join(""));

/* ----------------------------------------------------- palette from cover */

const toHsl = ([r, g, b]: number[]) => {
  r! /= 255; g! /= 255; b! /= 255;
  const mx = Math.max(r!, g!, b!), mn = Math.min(r!, g!, b!), l = (mx + mn) / 2, dl = mx - mn;
  if (!dl) return [0, 0, l] as const;
  const s = dl / (1 - Math.abs(2 * l - 1));
  const h = mx === r ? ((g! - b!) / dl) % 6 : mx === g ? (b! - r!) / dl + 2 : (r! - g!) / dl + 4;
  return [(h * 60 + 360) % 360, s, l] as const;
};
const fromHsl = (h: number, s: number, l: number) => {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return toHex([(r + m) * 255, (g + m) * 255, (b + m) * 255]);
};

/**
 * Builds a dark palette from an album cover (Apple's artwork CDN allows CORS). Uses a separate small
 * image URL so a cached non-CORS response for the big cover can't taint the canvas.
 */
export async function paletteFromCover(art: string): Promise<Palette> {
  // Apple: .../600x600bb.jpg   Deezer: .../1000x1000-000000-80-0-0.jpg
  const src = art.replace(/\/\d+x\d+bb\./, "/64x64bb.").replace(/\/\d+x\d+-(\d+-\d+-\d+-\d+\.jpg)$/, "/64x64-$1");
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = src;
  await img.decode();
  const cv = document.createElement("canvas");
  cv.width = cv.height = 48;
  const ctx = cv.getContext("2d")!;
  ctx.drawImage(img, 0, 0, 48, 48);
  const data = ctx.getImageData(0, 0, 48, 48).data; // throws if CORS ever fails
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < data.length; i += 4) {
    const key = ((data[i]! >> 4) << 8) | ((data[i + 1]! >> 4) << 4) | (data[i + 2]! >> 4);
    const e = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    e.n++; e.r += data[i]!; e.g += data[i + 1]!; e.b += data[i + 2]!;
    buckets.set(key, e);
  }
  const top = [...buckets.values()].sort((a, b) => b.n - a.n).slice(0, 12).map((e) => ({ n: e.n, hsl: toHsl([e.r / e.n, e.g / e.n, e.b / e.n]) }));
  const dominant = top[0]!.hsl;
  // Accent: the most vivid colour that isn't too dark or washed out, weighted by how much of the cover it fills.
  const vivid = [...top].sort((a, b) => b.hsl[1] * Math.sqrt(b.n) * (b.hsl[2] > 0.15 && b.hsl[2] < 0.9 ? 1 : 0.2) - a.hsl[1] * Math.sqrt(a.n) * (a.hsl[2] > 0.15 && a.hsl[2] < 0.9 ? 1 : 0.2))[0]!.hsl;
  const h = dominant[0], s = Math.min(dominant[1], 0.45);
  return {
    bg: fromHsl(h, s, 0.08),
    surface: fromHsl(h, s, 0.13),
    fg: fromHsl(h, Math.min(s, 0.2), 0.94),
    muted: fromHsl(h, Math.min(s, 0.15), 0.68),
    accent: fromHsl(vivid[0], Math.max(vivid[1], 0.55), 0.62),
  };
}
