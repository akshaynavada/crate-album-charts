import { useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { Check, Loader2, RotateCcw, Trash2, Wand2, X } from "lucide-react";
import { HexColorPicker } from "react-colorful";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useFontLink } from "@/components/ThemeScope";
import { useBackToClose } from "@/lib/use-back-to-close";
import {
  ACCENT_SWATCHES, COVER_SIZES, FONTS, FONT_IDS, GRID_STYLES, PRESETS, PRESET_IDS, STYLE_KEYS, paletteFromCover, swatchFontsHref,
  type CoverSize, type CrateTheme, type ListSettings, type Palette, type PresetId, type ResolvedTheme,
} from "@/lib/theme";

type Props = {
  open: boolean; onOpenChange: (o: boolean) => void;
  theme: CrateTheme; setTheme: Dispatch<SetStateAction<CrateTheme>>; resolved: ResolvedTheme; covers: string[];
  count: number; setCount: (n: number) => void;
  /** Changes when the "More spots" square is clicked: show Layout and focus "How many". */
  focusCount?: number;
  showNames: boolean; setShowNames: (b: boolean) => void;
  onClear: () => void;
  title: string; setTitle: (t: string) => void;
};

/** Side pane with everything about how the crate looks: layout, album list, theme, colours and style. */
export function CustomizePanel(p: Props) {
  const { theme, setTheme, resolved } = p;
  useFontLink(p.open ? swatchFontsHref() : null);
  const [matching, setMatching] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);

  // Everything as it was when the pane opened, so Discard can put it back.
  type Snap = { title: string; theme: CrateTheme; count: number; showNames: boolean };
  const [snap, setSnap] = useState<Snap | null>(null);
  useEffect(() => {
    if (p.open) setSnap({ title: p.title, theme, count: p.count, showNames: p.showNames });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.open]);
  const dirty = !!snap && JSON.stringify(snap) !== JSON.stringify({ title: p.title, theme, count: p.count, showNames: p.showNames });
  const discard = () => {
    if (snap) { p.setTitle(snap.title); setTheme(snap.theme); p.setCount(snap.count); p.setShowNames(snap.showNames); }
    setConfirming(false);
    p.onOpenChange(false);
  };
  // Closing (X, Esc or Discard) throws changes away, so ask first when there are any.
  const [confirming, setConfirming] = useState(false);
  const requestClose = () => (dirty ? setConfirming(true) : p.onOpenChange(false));
  useBackToClose(p.open, requestClose);
  const [tab, setTab] = useState<"layout" | "theme" | "style">("layout");
  const countRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!p.focusCount) return;
    setTab("layout");
    // Wait for the pane to open and the tab to render.
    const t = setTimeout(() => { const el = countRef.current; if (!el) return; el.scrollIntoView({ block: "center", behavior: "smooth" }); el.focus({ preventScroll: true }); el.select(); }, 350);
    return () => clearTimeout(t);
  }, [p.focusCount]);

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
    <>
    <Sheet open={p.open} onOpenChange={(o) => (o ? p.onOpenChange(true) : requestClose())} modal={false}>
      <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-sm [&>button:first-child]:hidden"
        onInteractOutside={(e) => e.preventDefault()}>
        <SheetHeader className="sticky top-0 z-10 border-b border-border bg-background/95 px-5 py-4 text-left backdrop-blur">
          <div className="flex items-center justify-between">
            <SheetTitle className="font-display text-2xl font-normal">Customize</SheetTitle>
            <button onClick={requestClose} aria-label="Close" title={dirty ? "Close and discard changes" : "Close"}
              className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
          <SheetDescription className="sr-only">Layout, album list, theme and style for your crate.</SheetDescription>
          <div role="tablist" className="mt-2 grid grid-cols-3 rounded-full bg-muted p-1 text-sm">
            {([["layout", "Layout"], ["theme", "Theme"], ["style", "Style"]] as const).map(([id, label]) => (
              <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
                className={`rounded-full py-1.5 transition ${tab === id ? "bg-background font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{label}</button>
            ))}
          </div>
        </SheetHeader>

        <div className="space-y-7 px-5 pb-10 pt-5 text-sm">
          {tab === "layout" && <>
          <Section title="Title">
            <input value={p.title} onChange={(e) => p.setTitle(e.target.value)} maxLength={80} aria-label="Chart title"
              onBlur={() => p.setTitle(p.title.trim())} placeholder="Title (optional)"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring" />
            <input value={theme.tagline ?? ""} onChange={(e) => set({ tagline: e.target.value || undefined })} maxLength={120} aria-label="Tagline"
              placeholder="Tagline (optional): Songs for the drive home…"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring" />
          </Section>

          <Section title="Albums">
            <Row label="How many">
              <CountInput value={p.count} onChange={p.setCount} inputRef={countRef} />
            </Row>
            <Row label="Cover size">
              <Chips value={resolved.coverSize} options={(Object.keys(COVER_SIZES) as CoverSize[]).map((k) => [k, COVER_SIZES[k].label] as const)} onChange={(v) => set({ coverSize: v })} />
            </Row>
            <p className="text-xs text-muted-foreground">Rows fill in to fit the screen, so it looks right on phones and big screens.</p>
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
                <Row label="Show top">
                  <TopN value={list.top} max={p.count} onChange={(n) => setList({ top: n })} />
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

          <Section title="Start over">
            <button onClick={p.onClear}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-destructive/50 px-3 py-2 text-destructive hover:bg-destructive/10">
              <Trash2 className="h-4 w-4" />Clear chart
            </button>
          </Section>
          </>}

          {tab === "theme" && <>
          <Section title="Preset">
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
                <ColourSwatch key={k} label={label} value={resolved.basePalette[k]} onChange={(v) => setColour(k, v)} />
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

          </>}

          {tab === "style" && (
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
          )}
        </div>
        <div className="sticky bottom-0 z-10 flex items-center gap-2 border-t border-border bg-background/95 px-5 py-3 backdrop-blur max-sm:pb-14">
          {/* Phones: buttons sit on the left and higher up, clear of the host badge in the bottom-right corner. */}
          <span className="mr-auto text-xs text-muted-foreground max-sm:order-last max-sm:hidden">{dirty ? "Unsaved changes" : "No changes yet"}</span>
          <button onClick={() => setConfirming(true)} disabled={!dirty}
            className="rounded-full border border-border px-4 py-1.5 text-sm hover:bg-muted disabled:opacity-40">Discard</button>
          <button onClick={() => p.onOpenChange(false)}
            className="rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">{dirty ? "Save" : "Done"}</button>
        </div>
      </SheetContent>
    </Sheet>
    <AlertDialog open={confirming} onOpenChange={setConfirming}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Discard your changes?</AlertDialogTitle>
          <AlertDialogDescription>Your crate goes back to how it looked when you opened Customize.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep editing</AlertDialogCancel>
          <AlertDialogAction onClick={discard} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Discard</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

/** Colour square that opens a picker popover; clicking anywhere else or pressing Esc closes it. */
function ColourSwatch({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex flex-col items-center gap-1 text-[11px] text-muted-foreground" aria-label={`${label} colour`}>
          <span className={`h-9 w-full rounded-md border ${open ? "border-foreground ring-2 ring-ring" : "border-border"}`} style={{ background: value }} />
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="center" className="w-auto space-y-2 p-3">
        <HexColorPicker color={value} onChange={(v) => onChange(v.toLowerCase())} />
        <div className="flex items-center gap-2">
          <input value={text} spellCheck={false} maxLength={7} aria-label={`${label} hex`}
            onChange={(e) => { const v = e.target.value.trim(); setText(v); if (/^#[0-9a-fA-F]{6}$/.test(v)) onChange(v.toLowerCase()); }}
            className="w-24 rounded-md border border-input bg-background px-2 py-1 font-mono text-xs uppercase outline-none focus:ring-2 focus:ring-ring" />
          <button onClick={() => setOpen(false)} className="ml-auto rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">Done</button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** "All" or a number of albums to list. */
function TopN({ value, max, onChange }: { value: number; max: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[0, 5, 10].filter((n) => n < max).map((n) => (
        <button key={n} onClick={() => onChange(n)} aria-pressed={value === n}
          className={`rounded-full border px-2.5 py-1 text-xs ${value === n ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"}`}>{n || "All"}</button>
      ))}
      <input type="number" min={1} max={max} value={value || ""} placeholder="#" aria-label="Number of albums to list"
        onChange={(e) => { const n = Math.floor(+e.target.value); onChange(Number.isFinite(n) && n > 0 ? Math.min(n, 100) : 0); }}
        className="w-14 rounded-full border border-input bg-background px-2 py-1 text-center text-xs outline-none focus:ring-2 focus:ring-ring" />
    </div>
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

/** Number of albums in the chart (1–100), with − / + buttons for thumbs. */
function CountInput({ value, onChange, inputRef }: { value: number; onChange: (n: number) => void; inputRef?: React.Ref<HTMLInputElement> }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = (n: number) => onChange(Math.max(1, Math.min(100, Math.round(n))));
  const btn = "grid h-8 w-8 place-items-center rounded-full border border-border text-base hover:bg-muted disabled:opacity-40";
  return (
    <div className="flex items-center gap-1.5">
      <button onClick={() => commit(value - 1)} disabled={value <= 1} aria-label="Fewer albums" className={btn}>−</button>
      <input ref={inputRef} inputMode="numeric" value={text} aria-label="Number of albums"
        onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 3); setText(v); if (+v >= 1) commit(+v); }}
        onBlur={() => setText(String(value))}
        className="w-14 rounded-full border border-input bg-background px-2 py-1.5 text-center text-sm outline-none focus:ring-2 focus:ring-ring" />
      <button onClick={() => commit(value + 1)} disabled={value >= 100} aria-label="More albums" className={btn}>+</button>
    </div>
  );
}
