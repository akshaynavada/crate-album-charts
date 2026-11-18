import { useState } from "react";
import { Check, Loader2, Wand2, X } from "lucide-react";
import {
  ACCENT_SWATCHES, FONTS, GRID_STYLES, PRESETS, PRESET_IDS, paletteFromCover, swatchFontsHref,
  type CrateTheme, type PresetId, type ResolvedTheme,
} from "@/lib/theme";
import { useFontLink } from "@/components/ThemeScope";

/** Editor sidebar card: presets, accent, "Match my #1", grid style, tagline. */
export function ThemePanel({ theme, setTheme, resolved, covers }: {
  theme: CrateTheme; setTheme: (t: CrateTheme) => void; resolved: ResolvedTheme; covers: string[];
}) {
  useFontLink(swatchFontsHref());
  const [matching, setMatching] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);
  const set = (patch: Partial<CrateTheme>) => {
    const next = { ...theme, ...patch };
    for (const k of Object.keys(patch) as (keyof CrateTheme)[]) if (patch[k] === undefined) delete next[k];
    setTheme(next);
  };

  const matchCover = async () => {
    const art = covers[0];
    if (!art) { setMatchError("Add an album to your #1 spot first."); return; }
    setMatching(true); setMatchError(null);
    try {
      set({ palette: await paletteFromCover(art), accent: undefined });
    } catch {
      setMatchError("Couldn't read that cover's colours. Try again or pick a preset.");
    }
    setMatching(false);
  };

  const accentNow = theme.accent ?? (theme.palette ?? PRESETS[theme.preset].palette).accent;

  return (
    <div className="space-y-5 rounded-2xl border border-border bg-card p-5 text-sm">
      <div>
        <span className="text-xs uppercase tracking-widest text-muted-foreground">Theme</span>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5 lg:grid-cols-2">
          {PRESET_IDS.map((id) => <PresetSwatch key={id} id={id} active={theme.preset === id && !theme.palette} covers={covers}
            onPick={() => setTheme({ v: 1, preset: id, ...(theme.tagline ? { tagline: theme.tagline } : {}) })} />)}
        </div>
      </div>

      <div>
        <span className="flex items-center justify-between text-xs uppercase tracking-widest text-muted-foreground">
          <span>Colours from your #1</span>
          {theme.palette && <button onClick={() => set({ palette: undefined })} className="normal-case tracking-normal hover:text-foreground">Undo</button>}
        </span>
        <button onClick={matchCover} disabled={matching}
          className={`mt-2 flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 hover:bg-muted disabled:opacity-60 ${theme.palette ? "border-primary" : "border-border"}`}>
          {matching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          {theme.palette ? "Matched to your #1 · redo" : "Match my #1 album"}
        </button>
        {theme.palette && (
          <div className="mt-2 flex gap-1">
            {Object.values(theme.palette).map((c, i) => <span key={i} className="h-4 flex-1 rounded-sm border border-border" style={{ background: c }} />)}
          </div>
        )}
        {matchError && <p className="mt-1 text-xs text-destructive">{matchError}</p>}
      </div>

      <div>
        <span className="flex items-center justify-between text-xs uppercase tracking-widest text-muted-foreground">
          <span>Accent</span>
          {theme.accent && <button onClick={() => set({ accent: undefined })} className="normal-case tracking-normal hover:text-foreground">Reset</button>}
        </span>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {ACCENT_SWATCHES.map((c) => (
            <button key={c} onClick={() => set({ accent: c })} aria-label={`Accent ${c}`}
              className="grid h-6 w-6 place-items-center rounded-full border border-border" style={{ background: c }}>
              {theme.accent === c && <Check className="h-3.5 w-3.5 text-black/70" />}
            </button>
          ))}
          <label className="relative h-6 w-6 cursor-pointer overflow-hidden rounded-full border border-border bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)]" title="Custom colour">
            <input type="color" value={accentNow} onChange={(e) => set({ accent: e.target.value.toLowerCase() })} className="absolute inset-0 cursor-pointer opacity-0" />
          </label>
        </div>
        {resolved.adjusted && <p className="mt-1.5 text-xs text-muted-foreground">Adjusted a little so it stays readable on this background.</p>}
      </div>

      <div>
        <span className="text-xs uppercase tracking-widest text-muted-foreground">Grid style</span>
        <div className="mt-2 flex flex-wrap gap-1">
          {GRID_STYLES.map((g) => (
            <button key={g.id} onClick={() => set({ grid: g.id === PRESETS[theme.preset].grid ? undefined : g.id })}
              className={`rounded-full border px-2.5 py-1 text-xs ${resolved.grid === g.id ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"}`}>
              {g.label}
            </button>
          ))}
        </div>
      </div>

      <label className="block">
        <span className="flex items-center justify-between text-xs uppercase tracking-widest text-muted-foreground">
          <span>Tagline</span>
          {theme.tagline && <button onClick={() => set({ tagline: undefined })} aria-label="Clear tagline" className="hover:text-foreground"><X className="h-3.5 w-3.5" /></button>}
        </span>
        <input value={theme.tagline ?? ""} onChange={(e) => set({ tagline: e.target.value || undefined })} maxLength={120}
          placeholder="Songs for the drive home…"
          className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring" />
      </label>
    </div>
  );
}

function PresetSwatch({ id, active, covers, onPick }: { id: PresetId; active: boolean; covers: string[]; onPick: () => void }) {
  const p = PRESETS[id];
  const font = FONTS[p.display];
  return (
    <button onClick={onPick} title={`${p.name}: ${p.vibe}`} aria-label={`${p.name} theme`} aria-pressed={active}
      className={`overflow-hidden rounded-lg border-2 p-2 text-left transition ${active ? "border-foreground" : "border-transparent hover:border-border"}`}
      style={{ background: p.palette.bg, color: p.palette.fg }}>
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          covers[i]
            ? <img key={i} src={covers[i]} alt="" className="aspect-square w-1/3 object-cover" style={{ borderRadius: Math.min(p.radius, 999) > 100 ? "50%" : p.radius / 2 }} />
            : <span key={i} className="aspect-square w-1/3" style={{ background: i === 0 ? p.palette.accent : p.palette.surface, borderRadius: Math.min(p.radius, 999) > 100 ? "50%" : p.radius / 2 }} />
        ))}
      </div>
      <span className="mt-1.5 block truncate text-[13px] leading-tight" style={{ fontFamily: `"${font.family}", ${font.fallback}` }}>{p.name}</span>
    </button>
  );
}
