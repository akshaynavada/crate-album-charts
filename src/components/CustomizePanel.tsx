import { useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { Check, Loader2, RotateCcw, Wand2 } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useFontLink } from "@/components/ThemeScope";
import {
  ACCENT_SWATCHES, FONTS, FONT_IDS, GRID_STYLES, PRESETS, PRESET_IDS, STYLE_KEYS, paletteFromCover, swatchFontsHref,
  type CrateTheme, type ListSettings, type Palette, type PresetId, type ResolvedTheme,
} from "@/lib/theme";

type Props = {
  open: boolean; onOpenChange: (o: boolean) => void;
  theme: CrateTheme; setTheme: Dispatch<SetStateAction<CrateTheme>>; resolved: ResolvedTheme; covers: string[];
  cols: number; setCols: (n: number) => void; rows: number; setRows: (n: number) => void;
  showNames: boolean; setShowNames: (b: boolean) => void;
};

/** Side pane with everything about how the crate looks: layout, album list, theme, colours and style. */
export function CustomizePanel(p: Props) {
  const { theme, setTheme, resolved } = p;
  useFontLink(p.open ? swatchFontsHref() : null);
  const [matching, setMatching] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);

  // Functional updates so quick successive clicks never overwrite each other.
  const set = (patch: Partial<CrateTheme>) => setTheme((prev) => {
    const next: CrateTheme = { ...prev, ...patch };
    for (const k of Object.keys(patch) as (keyof CrateTheme)[]) if (patch[k] === undefined) delete next[k];
    return next;
  });
  const setList = (patch: Partial<ListSettings>) => setTheme((prev) => ({ ...prev, list: { ...(prev.list ?? {}), ...patch } }));
  const pickPreset = (id: PresetId) => setTheme((prev) => {
    const next: CrateTheme = { ...prev, preset: id };
    for (const k of STYLE_KEYS) delete next[k];
    return next;
  });
  const resetStyle = () => pickPreset(theme.preset);
  const hasOverrides = STYLE_KEYS.some((k) => theme[k] !== undefined);

  const setColour = (k: keyof Palette, v: string) => {
    if (k === "accent") { set({ accent: v }); return; }
    set({ palette: { ...resolved.basePalette, accent: (theme.palette ?? PRESETS[theme.preset].palette).accent, [k]: v } });
  };

  const matchCover = async () => {
    const art = p.covers[0];
    if (!art) { setMatchError("Add an album to your #1 spot first."); return; }
    setMatching(true); setMatchError(null);
    try { set({ palette: await paletteFromCover(art), accent: undefined }); }
    catch { setMatchError("Couldn't read that cover's colours. Try again or pick a preset."); }
    setMatching(false);
  };

  const list = resolved.list;
  const listMode = !p.showNames ? "off" : list.pos;

  return (
    <Sheet open={p.open} onOpenChange={p.onOpenChange} modal={false}>
      <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-sm [&>button:last-child]:z-20 [&>button:last-child]:rounded-full [&>button:last-child]:p-1"
        onInteractOutside={(e) => e.preventDefault()}>
        <SheetHeader className="sticky top-0 z-10 border-b border-border bg-background/95 px-5 py-4 backdrop-blur">
          <SheetTitle className="font-display text-2xl font-normal">Customize</SheetTitle>
          <SheetDescription className="text-xs">Changes show live and are saved with your crate.</SheetDescription>
        </SheetHeader>

        <div className="space-y-7 px-5 pb-10 pt-5 text-sm">
          <Section title="Layout">
            {([["Columns", p.cols, p.setCols], ["Rows", p.rows, p.setRows]] as const).map(([l, v, setV]) => (
              <label key={l} className="block">
                <span className="flex justify-between text-xs text-muted-foreground"><span>{l}</span><span className="text-foreground">{v}</span></span>
                <input type="range" min={1} max={10} value={v} onChange={(e) => setV(+e.target.value)} className="mt-1.5 w-full accent-primary" />
              </label>
            ))}
          </Section>

          <Section title="Album list">
            <Chips value={listMode} options={[["off", "Off"], ["below", "Below"], ["side", "Beside"]]}
              onChange={(v) => { if (v === "off") p.setShowNames(false); else { p.setShowNames(true); setList({ pos: v }); } }} />
            {p.showNames && (
              <>
                <Row label="Numbers">
                  <Chips value={list.num} options={[["paren", "1)"], ["dot", "1."], ["hash", "#1"], ["pad", "01"], ["none", "None"]]} onChange={(v) => setList({ num: v })} />
                </Row>
                <Row label="Size">
                  <Chips value={list.size} options={[["sm", "S"], ["md", "M"], ["lg", "L"]]} onChange={(v) => setList({ size: v })} />
                </Row>
                <Row label="Show">
                  <div className="flex flex-wrap gap-1">
                    {([["song", "Song"], ["note", "Description"], ["genre", "Genre"], ["fff", "For fans of"]] as const).map(([k, label]) => (
                      <Toggle key={k} on={list[k]} onClick={() => setList({ [k]: !list[k] })}>{label}</Toggle>
                    ))}
                  </div>
                </Row>
              </>
            )}
          </Section>

          <Section title="Theme">
            <div className="grid grid-cols-2 gap-2">
              {PRESET_IDS.map((id) => <PresetSwatch key={id} id={id} active={theme.preset === id} covers={p.covers} onPick={() => pickPreset(id)} />)}
            </div>
          </Section>

          <Section title="Colours" action={(theme.palette || theme.accent) && <Reset onClick={() => set({ palette: undefined, accent: undefined })} />}>
            <button onClick={matchCover} disabled={matching}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 hover:bg-muted disabled:opacity-60">
              {matching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}Match my #1 album
            </button>
            {matchError && <p className="text-xs text-destructive">{matchError}</p>}
            <div className="grid grid-cols-5 gap-2">
              {([["bg", "Background"], ["surface", "Cards"], ["fg", "Text"], ["muted", "Muted"], ["accent", "Accent"]] as const).map(([k, label]) => (
                <label key={k} className="flex cursor-pointer flex-col items-center gap-1 text-[11px] text-muted-foreground">
                  <span className="relative h-9 w-full overflow-hidden rounded-md border border-border" style={{ background: resolved.basePalette[k] }}>
                    <input type="color" value={resolved.basePalette[k]} onChange={(e) => setColour(k, e.target.value.toLowerCase())} className="absolute inset-0 cursor-pointer opacity-0" aria-label={`${label} colour`} />
                  </span>
                  {label}
                </label>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs text-muted-foreground">Quick accents</span>
              {ACCENT_SWATCHES.map((c) => (
                <button key={c} onClick={() => set({ accent: c })} aria-label={`Accent ${c}`}
                  className="grid h-5 w-5 place-items-center rounded-full border border-border" style={{ background: c }}>
                  {theme.accent === c && <Check className="h-3 w-3 text-black/70" />}
                </button>
              ))}
            </div>
            {resolved.adjusted && <p className="text-xs text-muted-foreground">Some colours were nudged a little so text stays readable.</p>}
          </Section>

          <Section title="Style" action={hasOverrides && <Reset label="Reset to theme" onClick={resetStyle} />}>
            <Row label="Title font">
              <FontSelect value={resolved.displayFont} onChange={(v) => set({ displayFont: v })} />
            </Row>
            <Row label="Text font">
              <FontSelect value={resolved.bodyFont} onChange={(v) => set({ bodyFont: v })} />
            </Row>
            <Row label="Title case">
              <Chips value={resolved.titleCase} options={[["normal", "Aa"], ["upper", "AA"]]} onChange={(v) => set({ titleCase: v })} />
            </Row>
            <Row label="Grid">
              <Chips value={resolved.grid} options={GRID_STYLES.map((g) => [g.id, g.label] as const)} onChange={(v) => set({ grid: v })} />
            </Row>
            <Row label="Cover shape">
              <Chips value={resolved.shape} options={[["square", "Square"], ["circle", "Circle"]]} onChange={(v) => set({ shape: v })} />
            </Row>
            <Slider label="Corners" value={resolved.radius} disabled={resolved.shape === "circle" || resolved.grid === "mosaic"} onChange={(v) => set({ radius: v })} />
            <Slider label="Spacing" value={resolved.gap} disabled={resolved.grid === "mosaic"} onChange={(v) => set({ gap: v })} />
            <Row label="Covers">
              <Chips value={resolved.cover} options={[["normal", "Normal"], ["mono", "B&W"], ["tint", "Ink tint"]]} onChange={(v) => set({ cover: v })} />
            </Row>
            <Row label="Paper grain">
              <Toggle on={resolved.grain} onClick={() => set({ grain: !resolved.grain })}>{resolved.grain ? "On" : "Off"}</Toggle>
            </Row>
          </Section>

          <Section title="Tagline">
            <input value={theme.tagline ?? ""} onChange={(e) => set({ tagline: e.target.value || undefined })} maxLength={120}
              placeholder="Songs for the drive home…"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring" />
          </Section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="flex items-center justify-between text-xs uppercase tracking-widest text-muted-foreground">{title}{action}</h3>
      {children}
    </section>
  );
}
function Row({ label, children }: { label: string; children: ReactNode }) {
  return <div className="flex items-center justify-between gap-3"><span className="shrink-0 text-xs text-muted-foreground">{label}</span>{children}</div>;
}
function Reset({ onClick, label = "Reset" }: { onClick: () => void; label?: string }) {
  return <button onClick={onClick} className="flex items-center gap-1 normal-case tracking-normal hover:text-foreground"><RotateCcw className="h-3 w-3" />{label}</button>;
}
function Chips<T extends string>({ value, options, onChange }: { value: T; options: readonly (readonly [T, string])[]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap justify-end gap-1">
      {options.map(([id, label]) => (
        <button key={id} onClick={() => onChange(id)} aria-pressed={value === id}
          className={`rounded-full border px-2.5 py-1 text-xs ${value === id ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"}`}>{label}</button>
      ))}
    </div>
  );
}
function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} aria-pressed={on}
      className={`rounded-full border px-2.5 py-1 text-xs ${on ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-muted"}`}>{children}</button>
  );
}
function Slider({ label, value, onChange, disabled }: { label: string; value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <label className={`block ${disabled ? "opacity-40" : ""}`}>
      <span className="flex justify-between text-xs text-muted-foreground"><span>{label}</span><span className="text-foreground">{value}px</span></span>
      <input type="range" min={0} max={32} value={value} disabled={disabled} onChange={(e) => onChange(+e.target.value)} className="mt-1.5 w-full accent-primary" />
    </label>
  );
}
function FontSelect({ value, onChange }: { value: (typeof FONT_IDS)[number]; onChange: (v: (typeof FONT_IDS)[number]) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as (typeof FONT_IDS)[number])}
      className="w-44 rounded-lg border border-input bg-background px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring">
      {FONT_IDS.map((id) => <option key={id} value={id}>{FONTS[id].family}</option>)}
    </select>
  );
}

function PresetSwatch({ id, active, covers, onPick }: { id: PresetId; active: boolean; covers: string[]; onPick: () => void }) {
  const p = PRESETS[id];
  const font = FONTS[p.display];
  const circle = "shape" in p && p.shape === "circle";
  const r = circle ? "50%" : Math.min(p.radius, 8);
  return (
    <button onClick={onPick} title={`${p.name}: ${p.vibe}`} aria-label={`${p.name} theme`} aria-pressed={active}
      className={`overflow-hidden rounded-lg border-2 p-2 text-left transition ${active ? "border-foreground" : "border-transparent hover:border-border"}`}
      style={{ background: p.palette.bg, color: p.palette.fg }}>
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          covers[i]
            ? <img key={i} src={covers[i]} alt="" className="aspect-square w-1/3 object-cover" style={{ borderRadius: r }} />
            : <span key={i} className="aspect-square w-1/3" style={{ background: i === 0 ? p.palette.accent : p.palette.surface, borderRadius: r }} />
        ))}
      </div>
      <span className="mt-1.5 block truncate text-[13px] leading-tight" style={{ fontFamily: `"${font.family}", ${font.fallback}` }}>{p.name}</span>
    </button>
  );
}
