import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Music2, Play, Pause, Disc3, Share2, Check, SlidersHorizontal, Pencil, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePlayer } from "@/lib/use-player";
import { fetchAlbum, splitFff, type AlbumTrack } from "@/lib/itunes";
import { searchDeezerAlbums } from "@/lib/deezer.functions";
import { refreshPreviews } from "@/lib/deezer-previews";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Crate — Album Chart Maker with Song Previews" },
      { name: "description", content: "Build a beautiful grid of your favorite albums and hook a song preview to each one." },
      { property: "og:title", content: "Crate — Album Chart Maker" },
      { property: "og:description", content: "Build a beautiful album grid and hook a song preview to each album." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

import type { Album, Track, Cell, PickDetails } from "@/lib/chart-types";
import { createChart, saveChart } from "@/lib/charts.functions";
import { DEFAULT_THEME, parseTheme, resolveTheme, type CrateTheme } from "@/lib/theme";
import { ThemeScope } from "@/components/ThemeScope";
import { CustomizePanel } from "@/components/CustomizePanel";
import { RankList } from "@/components/RankList";
import { BrandIcon } from "@/components/BrandIcon";
const SHARE = "crate-share-v1";
const PUBLIC_ORIGIN = "https://crate-album-charts.lovable.app";
/**
 * Share links must point at the public site: Lovable's editor preview (id-preview--…) is login-gated and
 * localhost only works on this machine. A custom domain or the published site keeps its own origin.
 */
const shareOrigin = () => {
  const h = window.location.hostname;
  const isPreview = h.startsWith("id-preview--") || h.endsWith(".lovableproject.com") || h === "localhost" || h === "127.0.0.1";
  return isPreview ? PUBLIC_ORIGIN : window.location.origin;
};

const STORE = "crate-chart-v1";
const SEARCH_IN = "crate-search-in";
type SearchIn = "auto" | "apple" | "deezer";
const SEARCH_OPTIONS: { id: SearchIn; label: string; hint: string }[] = [
  { id: "auto", label: "Auto", hint: "Apple Music, or Deezer when Apple finds nothing" },
  { id: "apple", label: "Apple", hint: "Apple Music only" },
  { id: "deezer", label: "Deezer", hint: "Deezer only" },
];
const big = (u: string) => u.replace("100x100bb", "600x600bb");

function Index() {
  const [title, setTitle] = useState("My Top Albums");
  const [cols, setCols] = useState(4);
  const [rows, setRows] = useState(4);
  const [cells, setCells] = useState<Cell[]>(Array(100).fill(null));
  const [selected, setSelected] = useState(0);
  const [showNames, setShowNames] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [shareInfo, setShareInfo] = useState<{ id: string; token: string } | null>(null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Album[]>([]);
  const [searching, setSearching] = useState(false);
  /** Where to search. "auto" = Apple, falling back to Deezer when Apple finds nothing. */
  const [searchIn, setSearchIn] = useState<SearchIn>("auto");
  /** Which catalog the results on screen came from. */
  const [resultSrc, setResultSrc] = useState<"apple" | "deezer">("apple");
  const [picker, setPicker] = useState<number | null>(null);
  const [customizing, setCustomizing] = useState(false);
  const [theme, setTheme] = useState<CrateTheme>(DEFAULT_THEME);
  const resolved = useMemo(() => resolveTheme(theme), [theme]);
  const player = usePlayer();
  const { playing, play, stop } = player;
  const drag = useRef<number | null>(null);

  useEffect(() => {
    try {
      const d = JSON.parse(localStorage.getItem(STORE) || "null");
      setShareInfo(JSON.parse(localStorage.getItem(SHARE) || "null"));
      const s = localStorage.getItem(SEARCH_IN);
      if (s === "auto" || s === "apple" || s === "deezer") setSearchIn(s);
      if (d) { setTitle(d.title); setCols(d.cols); setRows(d.rows); setCells([...d.cells, ...Array(100).fill(null)].slice(0, 100)); setShowNames(d.showNames ?? true); setTheme(parseTheme(d.theme)); }
    } catch {}
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    const ids = cells.flatMap((c) => (c?.track?.src === "deezer" && typeof c.track.id === "number" ? [c.track.id] : []));
    if (ids.length) refreshPreviews(ids).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);
  useEffect(() => {
    if (loaded) localStorage.setItem(STORE, JSON.stringify({ title, cols, rows, cells, showNames, theme }));
  }, [title, cols, rows, cells, showNames, theme, loaded]);
  useEffect(() => {
    // While the Customize pane is open, changes are a draft: the shared page updates once they're saved.
    if (!loaded || !shareInfo || customizing) return;
    const t = setTimeout(() => {
      saveChart({ data: { ...shareInfo, data: { title, cols, rows, showNames, cells: cells.slice(0, cols * rows), theme } } }).catch(() => {});
    }, 800);
    return () => clearTimeout(t);
  }, [title, cols, rows, cells, showNames, theme, loaded, shareInfo, customizing]);

  useEffect(() => {
    if (!q.trim()) { setResults([]); setResultSrc("apple"); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      setSearching(true);
      let found: Album[] = [];
      let src: "apple" | "deezer" = searchIn === "deezer" ? "deezer" : "apple";
      if (src === "apple") {
        try {
          const r = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=album&limit=24`);
          const j = await r.json();
          found = j.results.map((a: any) => ({ id: a.collectionId, name: a.collectionName, artist: a.artistName, art: big(a.artworkUrl100) }));
        } catch {}
      }
      // Apple's album search has gaps; in Auto, fall back to Deezer when it finds nothing.
      if (searchIn === "deezer" || (searchIn === "auto" && !found.length)) {
        found = await searchDeezerAlbums({ data: { q } }).catch(() => []);
        src = "deezer";
      }
      if (cancelled) return;
      setResults(found); setResultSrc(src); setSearching(false);
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q, searchIn]);

  const chooseSearchIn = (s: SearchIn) => {
    setSearchIn(s);
    try { localStorage.setItem(SEARCH_IN, s); } catch {}
  };

  const [copied, setCopied] = useState(false);
  const share = async () => {
    const data = { title, cols, rows, showNames, cells: cells.slice(0, total), theme };
    let info = shareInfo;
    if (!info) {
      info = await createChart({ data: { data } });
      localStorage.setItem(SHARE, JSON.stringify(info)); setShareInfo(info);
    } else await saveChart({ data: { ...info, data } });
    const url = `${shareOrigin()}/c/${info.id}`;
    if (navigator.share) { try { await navigator.share({ title, url }); return; } catch {} }
    await navigator.clipboard.writeText(url);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const total = cols * rows;
  // A search result only goes into the chart once Save is pressed in the song picker.
  const [pending, setPending] = useState<{ idx: number; album: Album } | null>(null);
  const place = (album: Album) => {
    let idx = selected < total ? selected : 0;
    if (cells[idx]) { const e = cells.findIndex((c, i) => i < total && !c); if (e >= 0) idx = e; }
    setPending({ idx, album });
    setPicker(idx);
  };
  const pickerCell: Cell = picker === null ? null : pending && pending.idx === picker ? { album: pending.album } : (cells[picker] ?? null);
  const closePicker = () => { stop(); setPicker(null); setPending(null); };
  const savePick = (t: Track | undefined, extra: Required<PickDetails>) => {
    if (picker !== null && pickerCell) {
      const next = cells.map((x, j) => (j === picker ? { ...pickerCell, track: t ?? pickerCell.track, ...extra } : x));
      setCells(next);
      if (pending) { const after = next.findIndex((c, i) => i < total && !c); setSelected(after >= 0 ? after : picker); }
    }
    closePicker();
  };
  const update = (i: number, c: Cell) => setCells((p) => p.map((x, j) => (j === i ? c : x)));
  const swap = (a: number, b: number) => setCells((p) => { const n = [...p]; const t = n[a] ?? null; n[a] = n[b] ?? null; n[b] = t; return n; });

  const filled = cells.slice(0, total).map((c, i) => ({ c, i })).filter((x) => x.c);

  return (
    // On wide screens, make room for the Customize pane so the live preview stays visible.
    <div className={`min-h-screen transition-[padding] duration-300 ${customizing ? "lg:pr-[24rem]" : ""}`}>
      <header className="mx-auto flex max-w-[1600px] items-center gap-3 px-6 pt-8">
        <Disc3 className="h-7 w-7 text-primary" />
        <span className="font-display text-3xl italic">Crate</span>
        <span className="ml-2 text-sm text-muted-foreground">album charts that sound like you</span>
      </header>

      <main className="mx-auto grid max-w-[1600px] gap-6 px-4 py-6 md:px-6 lg:grid-cols-[300px_1fr]">
        <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-2xl border border-border bg-card p-5">
            <label className="text-xs uppercase tracking-widest text-muted-foreground">Find albums</label>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Artist or album…"
                className="w-full rounded-lg border border-input bg-background py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div role="radiogroup" aria-label="Search in" className="mt-2 flex items-center gap-1 text-xs">
              <span className="mr-1 text-muted-foreground">Audio Source</span>
              {SEARCH_OPTIONS.map((o) => (
                <button key={o.id} role="radio" aria-checked={searchIn === o.id} onClick={() => chooseSearchIn(o.id)} title={o.hint}
                  className={`rounded-full border px-2.5 py-0.5 ${searchIn === o.id ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
                  {o.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Click a cell, then pick an album. Drag cells to reorder.</p>
            <div className="mt-4 grid max-h-56 lg:max-h-[46vh] grid-cols-4 lg:grid-cols-3 gap-2 overflow-y-auto pr-1">
              {searching && <p className="col-span-full text-sm text-muted-foreground">Searching…</p>}
              {!searching && q.trim() && results.length === 0 && (
                <p className="col-span-full text-sm text-muted-foreground">
                  No albums found {searchIn === "auto" ? "on Apple Music or Deezer" : searchIn === "apple" ? "on Apple Music. Try Deezer or Auto." : "on Deezer. Try Apple or Auto."}
                </p>
              )}
              {!searching && searchIn === "auto" && resultSrc === "deezer" && results.length > 0 && <p className="col-span-full text-xs text-muted-foreground">Not on Apple's search, showing results from Deezer.</p>}
              {results.map((a) => (
                <button key={a.id} onClick={() => place(a)} title={`${a.name} — ${a.artist}`}
                  className="group relative aspect-square overflow-hidden rounded-md">
                  <img src={a.art} alt={a.name} className="h-full w-full object-cover transition group-hover:scale-105" loading="lazy" />
                  <span className="absolute inset-x-0 bottom-0 bg-background/80 p-1 text-[10px] leading-tight opacity-0 transition group-hover:opacity-100 line-clamp-2">{a.name}</span>
                </button>
              ))}
            </div>
            {!searching && q.trim() && searchIn === "auto" && resultSrc === "apple" && results.length > 0 && (
              <button onClick={() => chooseSearchIn("deezer")} className="mt-3 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                Can't find it? Search Deezer instead
              </button>
            )}
          </div>

          <div className="space-y-4 rounded-2xl border border-border bg-card p-5 text-sm">
            <label className="block">
              <span className="text-xs uppercase tracking-widest text-muted-foreground">Title</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)}
                className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring" />
            </label>
            <button onClick={() => setCustomizing(true)}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 hover:bg-muted">
              <SlidersHorizontal className="h-4 w-4" />Customize layout & theme
            </button>
            <button onClick={() => { if (confirm("Clear the whole chart?")) { setCells(Array(100).fill(null)); stop(); } }}
              className="text-xs text-muted-foreground underline-offset-4 hover:text-destructive hover:underline">Clear chart</button>
          </div>
        </aside>

        <ThemeScope as="section" theme={resolved} className="overflow-hidden rounded-3xl border border-border p-4 shadow-record md:p-6">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="crate-title font-display text-5xl leading-none md:text-6xl">{title}</h1>
              {resolved.tagline && <p className="mt-3 text-sm text-muted-foreground">{resolved.tagline}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button onClick={() => setCustomizing(true)} aria-label="Customize" title="Customize layout & theme"
                className="flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-2 text-sm hover:bg-muted">
                <SlidersHorizontal className="h-4 w-4" /><span className="hidden sm:inline">Customize</span>
              </button>
              <button onClick={share} className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}{copied ? "Link copied" : "Share"}
              </button>
            </div>
          </div>
          <div className={`flex flex-col gap-8 ${showNames && resolved.list.pos === "side" ? "lg:flex-row lg:items-start" : ""}`}>
            <div className="crate-grid grid min-w-0 flex-1" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
              {cells.slice(0, total).map((c, i) => {
                const key = `cell-${i}`;
                const isPlaying = playing === key;
                return (
                  <div key={i} draggable={!!c} data-index={i} data-filled={c ? "" : undefined} data-playing={isPlaying ? "" : undefined}
                    onDragStart={() => (drag.current = i)} onDragOver={(e) => e.preventDefault()}
                    onDrop={() => { if (drag.current !== null) swap(drag.current, i); drag.current = null; }}
                    onClick={() => (c ? (c.track ? play(key, c.track) : setPicker(i)) : setSelected(i))}
                    className={`crate-cell group relative aspect-square cursor-pointer overflow-hidden ${c ? "" : "border border-dashed"} ${selected === i && !c ? "border-primary bg-accent" : "border-border bg-muted/40 hover:bg-muted"}`}>
                    {c ? (
                      <>
                        <img src={c.album.art} alt={c.album.name} className={`crate-cover h-full w-full object-cover ${isPlaying ? "scale-105" : ""}`} />
                        <div className={`crate-overlay absolute inset-0 flex flex-col justify-end bg-background/70 p-2 transition ${isPlaying ? "opacity-100" : "opacity-0 [@media(hover:hover)]:group-hover:opacity-100"}`}>
                          <div className="flex items-end gap-2">
                            {c.track ? (isPlaying ? <Pause className="h-6 w-6 shrink-0 text-primary" /> : <Play className="h-6 w-6 shrink-0 text-primary" />) : null}
                            <p className="line-clamp-2 text-xs leading-tight">{c.track ? c.track.name : "Pick a song"}</p>
                          </div>
                        </div>
                        {/* Mouse: edit and remove appear on hover. Touch: only edit is shown; remove lives in the edit window. */}
                        <button onClick={(e) => { e.stopPropagation(); setPicker(i); }} aria-label={`Edit ${c.album.name}`} title="Edit song & details"
                          className="crate-btn-l absolute left-1.5 top-1.5 z-[3] grid h-7 w-7 place-items-center rounded-full bg-card/95 text-foreground shadow transition hover:text-primary [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); if (isPlaying) stop(); update(i, null); }} aria-label={`Remove ${c.album.name}`} title="Remove"
                          className="crate-btn-r absolute right-1.5 top-1.5 z-[3] hidden [@media(hover:hover)]:grid h-7 w-7 place-items-center rounded-full bg-destructive text-destructive-foreground shadow transition hover:bg-destructive/85 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        {c.track && !isPlaying && (
                          <span className="crate-badge absolute bottom-1.5 left-1.5 rounded-full bg-primary p-1 text-primary-foreground group-hover:opacity-0"><Music2 className="h-2.5 w-2.5" /></span>
                        )}
                        {isPlaying && (
                          <span className="crate-badge absolute bottom-2 left-2 flex h-4 items-end gap-0.5">
                            {[0, 0.2, 0.4].map((d) => <span key={d} className="eq-bar w-1 h-full rounded bg-primary" style={{ animationDelay: `${d}s` }} />)}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="flex h-full items-center justify-center font-display text-2xl text-muted-foreground/50">{i + 1}</span>
                    )}
                  </div>
                );
              })}
            </div>
            {showNames && (
              <RankList cells={cells.slice(0, total)} list={resolved.list} onOpen={(i) => setPicker(i)}
                onPlay={(i) => { const t = cells[i]?.track; if (t) play(`cell-${i}`, t); }} isPlaying={(i) => playing === `cell-${i}`} />
            )}
          </div>
        </ThemeScope>
      </main>

      <CustomizePanel open={customizing} onOpenChange={setCustomizing} theme={theme} setTheme={setTheme} resolved={resolved}
        covers={filled.map((x) => x.c!.album.art)} cols={cols} setCols={setCols} rows={rows} setRows={setRows}
        showNames={showNames} setShowNames={setShowNames} />
      <SongPicker idx={picker} cell={pickerCell} player={player} isNew={!!pending} onClose={closePicker} onPick={savePick}
        onRemove={() => { if (picker !== null) update(picker, null); closePicker(); }} />
    </div>
  );
}

function SongPicker({ idx, cell, onClose, onPick, onRemove, isNew, player }: {
  idx: number | null; cell: Cell; onClose: () => void; onPick: (t: Track | undefined, extra: Required<PickDetails>) => void;
  onRemove: () => void; isNew: boolean;
  player: ReturnType<typeof usePlayer>;
}) {
  const { playing, play } = player;
  const [tracks, setTracks] = useState<AlbumTrack[] | null>(null);
  const [chosen, setChosen] = useState<AlbumTrack | null>(null);
  const [note, setNote] = useState("");
  const [genre, setGenre] = useState("");
  const [fff, setFff] = useState("");
  const [suggestedGenre, setSuggestedGenre] = useState<string | undefined>();
  useEffect(() => {
    if (!cell) return;
    setTracks(null); setChosen(null); setNote(cell.note ?? ""); setGenre(cell.genre ?? ""); setFff(cell.fff ?? ""); setSuggestedGenre(undefined);
    fetchAlbum(cell.album).then((d) => {
      const list = d.tracks.filter((t) => t.preview);
      setTracks(list);
      setSuggestedGenre(d.genre);
      setChosen(list.find((t) => t.id === cell.track?.id) ?? null);
    }).catch(() => setTracks([]));
  }, [idx, cell?.album.id]);
  return (
    <Dialog open={idx !== null && !!cell} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        {cell && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-4">
                <img src={cell.album.art} alt="" className="h-16 w-16 rounded-md" />
                <div>
                  <DialogTitle className="font-display text-2xl font-normal">{cell.album.name}</DialogTitle>
                  <p className="text-sm text-muted-foreground">{cell.album.artist} · hook a song to this album</p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <BrandIcon name={cell.album.src === "deezer" ? "Deezer" : "Apple Music"} className="h-3 w-3" />
                    Tracks and previews from {cell.album.src === "deezer" ? "Deezer" : "Apple Music"}
                  </p>
                </div>
              </div>
            </DialogHeader>
            <ul className="max-h-72 space-y-1 overflow-y-auto">
              {tracks === null && <li className="text-sm text-muted-foreground">Loading songs…</li>}
              {tracks?.length === 0 && <li className="text-sm text-muted-foreground">No previews available for this album.</li>}
              {tracks?.map((t, n) => (
                <li key={t.id} onClick={() => setChosen(t)}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm ${chosen?.id === t.id ? "bg-accent" : "hover:bg-muted"}`}>
                  <span className="w-5 text-muted-foreground">{n + 1}</span>
                  <span className="flex-1 truncate">{t.name}</span>
                  <button onClick={(e) => { e.stopPropagation(); play(`pick-${t.id}`, t); }} className="rounded-full p-1.5 hover:text-primary" aria-label={`Play ${t.name}`}>
                    {playing === `pick-${t.id}` ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </button>
                </li>
              ))}
            </ul>
            <div className="space-y-3 border-t border-border pt-4">
              <label className="block text-sm">
                <span className="text-xs uppercase tracking-widest text-muted-foreground">Description <span className="normal-case tracking-normal">(optional)</span></span>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={280} rows={2} placeholder="A few words about this album…"
                  className="mt-2 w-full resize-none rounded-lg border border-input bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring" />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="flex items-baseline justify-between text-xs uppercase tracking-widest text-muted-foreground">
                    <span>Genre <span className="normal-case tracking-normal">(optional)</span></span>
                  </span>
                  <input value={genre} onChange={(e) => setGenre(e.target.value)} maxLength={60} placeholder={suggestedGenre ?? "e.g. Dream pop"}
                    className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring" />
                </label>
                <label className="block text-sm">
                  <span className="text-xs uppercase tracking-widest text-muted-foreground">For fans of <span className="normal-case tracking-normal">(optional)</span></span>
                  <input value={fff} onChange={(e) => setFff(e.target.value)} maxLength={200} placeholder="Artists, comma separated"
                    className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring" />
                </label>
              </div>
              <button onClick={() => onPick(chosen ? { id: chosen.id, name: chosen.name, preview: chosen.preview, start: 0, ...(chosen.src ? { src: chosen.src } : {}) } : undefined, { note: note.trim(), genre: genre.trim(), fff: splitFff(fff).join(", ") })}
                className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">{isNew ? "Add to chart" : "Save"}</button>
              {!isNew && (
                <button onClick={onRemove}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-destructive/40 px-4 py-2 text-sm text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-4 w-4" />Remove from chart
                </button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
