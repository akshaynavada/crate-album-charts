import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Cloud, CloudCheck, CloudOff, Plus, Search, Play, Pause, Disc3, Share2, Check, SlidersHorizontal, Pencil, Trash2, Image as ImageIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePlayer } from "@/lib/use-player";
import { fetchAlbum, findAlbumOn, normTitle, splitFff, type AlbumTrack } from "@/lib/itunes";
import { getRelatedArtists, searchDeezerAlbums } from "@/lib/deezer.functions";
import { refreshPreviews } from "@/lib/deezer-previews";
import { findYouTubeVideo } from "@/lib/youtube.functions";
import { findBandcampAlbum, getBandcampRelease, type BandcampRelease } from "@/lib/bandcamp.functions";
import { FullSongPlayer, youTubeId } from "@/components/FullSongPlayer";
import { ListenBar } from "@/components/ListenBar";
import { ChartImageDialog } from "@/components/ChartImageDialog";
import { useBackToClose } from "@/lib/use-back-to-close";

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
import { chartCount, legacyGrid } from "@/lib/chart-types";
import { createChart, openChartForEdit, saveChart } from "@/lib/charts.functions";
import { EditLinkDialog, editLinkFor, readEditLink } from "@/components/EditLinkDialog";
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
  const [count, setCount] = useState(10);
  const [cells, setCells] = useState<Cell[]>(Array(100).fill(null));
  const [selected, setSelected] = useState(0);
  const [showNames, setShowNames] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [shareInfo, setShareInfo] = useState<{ id: string; token: string } | null>(null);
  const [imageOpen, setImageOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Album[]>([]);
  const [searching, setSearching] = useState(false);
  /** Where to search. "auto" = Apple, falling back to Deezer when Apple finds nothing. */
  const [searchIn, setSearchIn] = useState<SearchIn>("auto");
  /** Which catalog the results on screen came from. */
  const [resultSrc, setResultSrc] = useState<"apple" | "deezer">("apple");
  const [picker, setPicker] = useState<number | null>(null);
  const [customizing, setCustomizing] = useState(false);
  const [focusCount, setFocusCount] = useState(0); // bumped to open Customize focused on "How many"
  const [theme, setTheme] = useState<CrateTheme>(DEFAULT_THEME);
  const resolved = useMemo(() => resolveTheme(theme), [theme]);
  const player = usePlayer();
  const { playing, play, stop } = player;

  useEffect(() => {
    try {
      const d = JSON.parse(localStorage.getItem(STORE) || "null");
      setShareInfo(JSON.parse(localStorage.getItem(SHARE) || "null"));
      const s = localStorage.getItem(SEARCH_IN);
      if (s === "auto" || s === "apple" || s === "deezer") setSearchIn(s);
      if (d) applyChart(d);
    } catch {}
    setLoaded(true);
    // Opened from a private edit link (/#edit=<id>:<key>): load that chart into this browser.
    const link = readEditLink(window.location.hash);
    if (link) {
      history.replaceState(null, "", window.location.pathname); // keep the key out of the address bar
      const current = JSON.parse(localStorage.getItem(SHARE) || "null");
      if (current?.id !== link.id && current && !confirm("Open the chart from this link? It replaces the chart in this browser (that one stays saved at its own edit link).")) return;
      openingLink.current = true;
      openChartForEdit({ data: link }).then((d) => {
        if (!d) { alert("That edit link didn't work. It may be mistyped, or the chart was removed."); return; }
        applyChart(d);
        localStorage.setItem(SHARE, JSON.stringify(link)); setShareInfo(link);
      }).catch(() => alert("Couldn't open that edit link. Check your connection and try again."))
        .finally(() => { openingLink.current = false; });
    }
  }, []);
  function applyChart(d: any) {
    setTitle(d.title ?? ""); setCount(chartCount(d)); setCells([...d.cells, ...Array(100).fill(null)].slice(0, 100));
    setShowNames(d.showNames ?? true); setTheme(parseTheme(d.theme));
  }
  useEffect(() => {
    if (!loaded) return;
    const ids = cells.flatMap((c) => (c?.track?.src === "deezer" && typeof c.track.id === "number" ? [c.track.id] : []));
    if (ids.length) refreshPreviews(ids).catch(() => {});
    // Songs picked before YouTube matching existed (or while it was unavailable) get looked up now.
    for (const c of cells) if (c) ensureYouTube(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);
  useEffect(() => {
    if (loaded) localStorage.setItem(STORE, JSON.stringify({ title, ...legacyGrid(count), count, cells, showNames, theme }));
  }, [title, count, cells, showNames, theme, loaded]);
  useEffect(() => {
    // While the Customize pane is open, changes are a draft: the shared page updates once they're saved.
    if (!loaded || !shareInfo || customizing) return;
    const t = setTimeout(() => {
      saveChart({ data: { ...shareInfo, data: chartData() } }).catch(() => {});
    }, 800);
    return () => clearTimeout(t);
  }, [title, count, cells, showNames, theme, loaded, shareInfo, customizing]);

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

  // Every chart gets a saved copy (and so an edit link) as soon as it has an album; after that the autosave above keeps it current.
  const creating = useRef<Promise<{ id: string; token: string }> | null>(null);
  const openingLink = useRef(false);
  const ensureSaved = () => {
    if (shareInfo) return Promise.resolve(shareInfo);
    if (!creating.current) {
      const data = chartData();
      creating.current = createChart({ data: { data } }).then((info) => {
        localStorage.setItem(SHARE, JSON.stringify(info)); setShareInfo(info);
        return info;
      }).finally(() => { creating.current = null; });
    }
    return creating.current;
  };
  const hasAlbum = cells.some((c, i) => c && i < count);
  const [saveFailed, setSaveFailed] = useState(false);
  const retrySave = () => { setSaveFailed(false); ensureSaved().catch(() => setSaveFailed(true)); };
  useEffect(() => {
    if (loaded && !shareInfo && hasAlbum && !openingLink.current && !saveFailed) ensureSaved().catch(() => setSaveFailed(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, shareInfo, hasAlbum]);
  const [editLinkOpen, setEditLinkOpen] = useState(false);
  useBackToClose(editLinkOpen, () => setEditLinkOpen(false));

  const [copied, setCopied] = useState(false);
  const share = async () => {
    const data = chartData();
    const hadInfo = !!shareInfo;
    const info = await ensureSaved();
    if (hadInfo) await saveChart({ data: { ...info, data } });
    const url = `${shareOrigin()}/c/${info.id}`;
    if (navigator.share) { try { await navigator.share({ title: title || "My album chart", url }); return; } catch {} }
    await navigator.clipboard.writeText(url);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const total = count;
  /** What gets saved online: just the chart's spots, plus cols/rows for older readers. */
  function chartData() { return { title, ...legacyGrid(count), count, showNames, cells: cells.slice(0, count), theme }; }
  // Clicking an empty spot makes it the target for the next search pick and jumps to the search box.
  const searchRef = useRef<HTMLInputElement>(null);
  const pickSpot = (i: number) => {
    setSelected(i);
    const el = searchRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.focus({ preventScroll: true });
    el.select();
  };
  const clearChart = () => { if (confirm("Clear the whole chart?")) { setCells(Array(100).fill(null)); stop(); } };
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
  useBackToClose(picker !== null, closePicker);
  const savePick = (t: Track | undefined, extra: Required<PickDetails>) => {
    if (picker !== null && pickerCell) {
      const old = pickerCell.track;
      // Same song as before: keep its YouTube match instead of searching again.
      const track = t ? (old && old.id === t.id && old.yt !== undefined ? { ...t, yt: old.yt } : t) : old;
      const cell = { ...pickerCell, track, ...extra };
      const next = cells.map((x, j) => (j === picker ? cell : x));
      setCells(next);
      ensureYouTube(cell);
      if (pending) { const after = next.findIndex((c, i) => i < total && !c); setSelected(after >= 0 ? after : picker); }
    }
    closePicker();
  };
  // Find each picked song on YouTube once (search quota is small) and save the video id with the chart.
  const ytTried = useRef(new Set<string>());
  function ensureYouTube(c: NonNullable<Cell>) {
    const t = c.track;
    if (!t || t.yt !== undefined) return;
    const key = `${c.album.artist}|${t.name}`;
    if (ytTried.current.has(key)) return;
    ytTried.current.add(key);
    findYouTubeVideo({ data: { artist: c.album.artist, song: t.name } }).then((m) => {
      if (m.status === "unavailable") { ytTried.current.delete(key); return; } // no key or out of quota: try again next visit
      const yt = m.status === "found" ? m.id : "";
      setCells((p) => p.map((x) => (x?.track && x.track.id === t.id && x.track.yt === undefined ? { ...x, track: { ...x.track, yt } } : x)));
    }).catch(() => ytTried.current.delete(key));
  }
  const update = (i: number, c: Cell) => setCells((p) => p.map((x, j) => (j === i ? c : x)));
  /** Drag and drop: the album is inserted at the drop spot and the ones in between shift over.
   *  Dropping on an empty spot just moves it there. */
  const moveTo = (from: number, to: number) => setCells((p) => {
    if (from === to) return p;
    if (!p[to]) return p.map((x, j) => (j === to ? p[from] ?? null : j === from ? null : x));
    const n = [...p];
    const [item] = n.splice(from, 1);
    n.splice(to, 0, item ?? null);
    return n;
  });

  // Reordering (touch and mouse): mobile browsers don't support HTML drag-and-drop, so hold an album for a moment,
  // slide it onto another spot and let go to move it there. A quick swipe still scrolls the page.
  const gridRef = useRef<HTMLDivElement>(null);
  const [touchDrag, setTouchDrag] = useState<{ from: number; over: number | null; x: number; y: number; size: number } | null>(null);
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let from: number | null = null, over: number | null = null, active = false, startX = 0, startY = 0, size = 0;
    const cellAt = (x: number, y: number) => {
      const el = document.elementFromPoint(x, y)?.closest<HTMLElement>(".crate-cell");
      return el && grid.contains(el) ? Number(el.dataset["index"]) : null;
    };
    const reset = () => { if (timer) clearTimeout(timer); timer = null; from = over = null; active = false; setTouchDrag(null); };
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      const el = (e.target as HTMLElement).closest<HTMLElement>(".crate-cell[data-filled]");
      if (!t || e.touches.length > 1 || !el || (e.target as HTMLElement).closest("button")) return;
      from = Number(el.dataset["index"]); startX = t.clientX; startY = t.clientY; size = el.getBoundingClientRect().width;
      timer = setTimeout(() => { active = true; over = from; setTouchDrag({ from: from!, over, x: startX, y: startY, size }); navigator.vibrate?.(15); }, 350);
    };
    const onMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (from === null || !t) return;
      if (!active) { if (Math.hypot(t.clientX - startX, t.clientY - startY) > 8) reset(); return; }
      e.preventDefault(); // stop the page scrolling while dragging
      over = cellAt(t.clientX, t.clientY);
      setTouchDrag({ from, over, x: t.clientX, y: t.clientY, size });
    };
    const onEnd = (e: TouchEvent) => {
      if (active) {
        e.preventDefault(); // no tap/click after a drag
        if (from !== null && over !== null && over !== from) moveRef.current(from, over);
      }
      reset();
    };
    // Mouse: same lifted-cover drag, starting once the pointer moves a few pixels (a plain click still opens the album).
    let suppressClick = false;
    const onMouseDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      const el = (e.target as HTMLElement).closest<HTMLElement>(".crate-cell[data-filled]");
      if (!el || (e.target as HTMLElement).closest("button")) return;
      from = Number(el.dataset["index"]); startX = e.clientX; startY = e.clientY; size = el.getBoundingClientRect().width;
      window.addEventListener("pointermove", onMouseMove);
      window.addEventListener("pointerup", onMouseUp, { once: true });
    };
    const onMouseMove = (e: PointerEvent) => {
      if (from === null) return;
      if (!active) {
        if (Math.hypot(e.clientX - startX, e.clientY - startY) < 6) return;
        active = true;
      }
      e.preventDefault();
      over = cellAt(e.clientX, e.clientY);
      setTouchDrag({ from, over, x: e.clientX, y: e.clientY, size });
    };
    const onMouseUp = () => {
      window.removeEventListener("pointermove", onMouseMove);
      if (active) {
        suppressClick = true; // the click that follows a drag shouldn't open the album
        if (from !== null && over !== null && over !== from) moveRef.current(from, over);
      }
      reset();
    };
    const onClickCapture = (e: MouseEvent) => { if (suppressClick) { suppressClick = false; e.stopPropagation(); e.preventDefault(); } };
    grid.addEventListener("touchstart", onStart, { passive: true });
    grid.addEventListener("touchmove", onMove, { passive: false });
    grid.addEventListener("touchend", onEnd, { passive: false });
    grid.addEventListener("touchcancel", reset);
    grid.addEventListener("pointerdown", onMouseDown);
    grid.addEventListener("click", onClickCapture, true);
    return () => {
      reset();
      grid.removeEventListener("touchstart", onStart); grid.removeEventListener("touchmove", onMove);
      grid.removeEventListener("touchend", onEnd); grid.removeEventListener("touchcancel", reset);
      grid.removeEventListener("pointerdown", onMouseDown); grid.removeEventListener("click", onClickCapture, true);
      window.removeEventListener("pointermove", onMouseMove); window.removeEventListener("pointerup", onMouseUp);
    };
  }, [loaded]);
  const moveRef = useRef(moveTo);
  moveRef.current = moveTo;

  const filled = cells.slice(0, total).map((c, i) => ({ c, i })).filter((x) => x.c);

  return (
    // On wide screens, make room for the Customize pane so the live preview stays visible.
    <div className={`min-h-screen transition-[padding] duration-300 ${customizing ? "lg:pr-[24rem]" : ""}`}>
      <header className="mx-auto flex max-w-[2000px] items-center gap-3 px-4 pt-5 md:px-6 md:pt-8 2xl:px-10">
        <Disc3 className="h-7 w-7 text-primary" />
        <span className="font-display text-3xl italic">Crate</span>
        <span className="ml-2 hidden text-sm text-muted-foreground sm:inline">album charts that sound like you</span>
      </header>

      <main className="mx-auto grid max-w-[2000px] gap-4 px-4 py-4 md:gap-6 md:px-6 md:py-6 2xl:px-10 lg:grid-cols-[300px_1fr]">
        <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-2xl border border-border bg-card p-4 md:p-5">
            <label className="text-xs uppercase tracking-widest text-muted-foreground">Find albums</label>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)}
                placeholder={selected < total && !cells[selected] ? `Find an album for #${selected + 1}…` : "Artist or album…"}
                className="w-full rounded-lg border border-input bg-background py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div role="radiogroup" aria-label="Search in" className="mt-2 flex items-center gap-1 text-xs">
              <span className="mr-1 text-muted-foreground">Search on</span>
              {SEARCH_OPTIONS.map((o) => (
                <button key={o.id} role="radio" aria-checked={searchIn === o.id} onClick={() => chooseSearchIn(o.id)} title={o.hint}
                  className={`rounded-full border px-2.5 py-0.5 ${searchIn === o.id ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
                  {o.label}
                </button>
              ))}
            </div>
            <p className="mt-2 hidden text-xs text-muted-foreground [@media(hover:hover)]:block">Click a cell, then pick an album. Drag cells to reorder.</p>
            <p className="mt-2 text-xs text-muted-foreground [@media(hover:hover)]:hidden">Tap a spot, then pick an album. Hold an album and slide it to move it.</p>
            <div className="mt-3 grid max-h-56 empty:hidden lg:max-h-[46vh] grid-cols-4 lg:grid-cols-3 gap-2 overflow-y-auto pr-1">
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

        </aside>

        <ThemeScope as="section" theme={resolved} className="overflow-hidden rounded-3xl border border-border p-4 shadow-record md:p-6">
          {/* Phones: buttons on their own row so the title (and renaming it) gets the full width. */}
          <div className="mb-6 flex flex-col-reverse gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-4">
            <div className="min-w-0 flex-1">
              <EditableTitle value={title} onChange={setTitle} />
              {resolved.tagline && <p className="mt-3 text-sm text-muted-foreground">{resolved.tagline}</p>}
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2">
              <button onClick={() => setCustomizing(true)} aria-label="Customize layout & theme" title="Title, layout, album list and theme"
                className="flex items-center gap-2 rounded-full border border-border bg-card/70 px-2.5 py-2 text-sm hover:bg-muted sm:px-3">
                <SlidersHorizontal className="h-4 w-4" /><span className="hidden sm:inline">Customize layout & theme</span><span className="sm:hidden">Customize</span>
              </button>
              {/* Save status; opens the private link for continuing on another device. */}
              {(shareInfo || hasAlbum) && (
                <button onClick={() => (shareInfo ? setEditLinkOpen(true) : saveFailed ? retrySave() : undefined)} disabled={!shareInfo && !saveFailed}
                  title={shareInfo ? "Saved automatically. Click to continue on another device." : saveFailed ? "Couldn't save online. Click to try again." : "Saving…"}
                  className="flex items-center gap-1.5 rounded-full border border-border bg-card/70 px-3 py-2 text-sm hover:bg-muted disabled:opacity-60">
                  {shareInfo ? <><CloudCheck className="h-4 w-4" /><span className="max-sm:sr-only">Saved</span></> : saveFailed ? <><CloudOff className="h-4 w-4" />Retry save</> : <><Cloud className="h-4 w-4 animate-pulse" />Saving…</>}
                </button>
              )}
              {hasAlbum && (
                <button onClick={() => setImageOpen(true)} aria-label="Share image" title="Make an image of this chart to post anywhere"
                  className="flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-2 text-sm hover:bg-muted">
                  <ImageIcon className="h-4 w-4" /><span className="hidden sm:inline">Share image</span>
                </button>
              )}
              <button onClick={share} className="flex items-center gap-2 rounded-full bg-primary px-3 py-2 sm:px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}{copied ? "Link copied" : "Share"}
              </button>
            </div>
          </div>
          <div className={`flex flex-col gap-8 ${showNames && resolved.list.pos === "side" ? "lg:flex-row lg:items-start" : ""}`}>
            <div ref={gridRef} className="crate-grid grid min-w-0 flex-1 [-webkit-touch-callout:none] select-none">
              {cells.slice(0, total).map((c, i) => {
                const key = `cell-${i}`;
                const isPlaying = playing === key;
                return (
                  <div key={i} data-index={i} data-filled={c ? "" : undefined} data-playing={isPlaying ? "" : undefined}
                    data-dragging={touchDrag?.from === i ? "" : undefined} data-dragover={touchDrag && touchDrag.over === i && touchDrag.from !== i ? "" : undefined}
                    onClick={() => (c ? setPicker(i) : pickSpot(i))}
                    className={`crate-cell group relative aspect-square cursor-pointer overflow-hidden ${c ? "" : "border border-dashed"} ${selected === i && !c ? "border-primary bg-accent" : "border-border bg-muted/40 hover:bg-muted"}`}>
                    {c ? (
                      <>
                        <img src={c.album.art} alt={c.album.name} draggable={false} className={`crate-cover h-full w-full object-cover ${isPlaying ? "scale-105" : ""}`} />
                        <div className={`crate-overlay absolute inset-0 flex flex-col justify-end bg-background/70 p-2 transition ${isPlaying ? "opacity-100" : "opacity-0 [@media(hover:hover)]:group-hover:opacity-100"}`}>
                          <div className="flex items-end gap-2">
                            {isPlaying ? <Pause className="h-6 w-6 shrink-0 text-primary" /> : null}
                            <p className="line-clamp-2 min-w-0 text-xs leading-tight"><span className="font-medium">{c.album.artist}</span> — {c.album.name}</p>
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
              {/* Not a spot: opens Customize at "How many" so the chart can hold more albums. */}
              {total < 100 && (
                <button onClick={() => { setCustomizing(true); setFocusCount((n) => n + 1); }} aria-label="Add more spots" title="Change how many albums"
                  className="flex aspect-square flex-col items-center justify-center gap-1 rounded-[var(--crate-radius,6px)] border-2 border-dashed border-border text-muted-foreground transition hover:border-primary hover:text-primary">
                  <Plus className="h-7 w-7" /><span className="text-xs">More spots</span>
                </button>
              )}
            </div>
            {showNames && (
              <RankList cells={cells.slice(0, total)} list={resolved.list} onOpen={(i) => setPicker(i)}
                onPlay={(i) => { const t = cells[i]?.track; if (t) play(`cell-${i}`, t); }} isPlaying={(i) => playing === `cell-${i}`} />
            )}
          </div>
          <ListenBar cells={cells.slice(0, total)} title={title} />
          <ChartImageDialog open={imageOpen} onOpenChange={setImageOpen} cells={cells.slice(0, total)} title={title.trim()} theme={resolved}
            showList={showNames} link={shareInfo ? `/c/${shareInfo.id}` : undefined} />
        </ThemeScope>
      </main>

      {/* While reordering by touch: a lifted copy of the album follows the finger (drawn above it so it stays visible). */}
      {touchDrag && cells[touchDrag.from] && (
        <div className="pointer-events-none fixed z-50" style={{ left: touchDrag.x, top: touchDrag.y, width: Math.max(72, touchDrag.size * 1.15), translate: "-50% -115%" }}>
          <img src={cells[touchDrag.from]!.album.art} alt="" className={`aspect-square w-full rotate-[-4deg] object-cover shadow-2xl ring-2 ring-white/80 ${resolved.shape === "circle" ? "rounded-full" : "rounded-lg"}`} />
          <p className="mt-1 truncate rounded bg-background/90 px-1.5 py-0.5 text-center text-[11px] font-medium shadow">#{touchDrag.from + 1} → {touchDrag.over !== null && touchDrag.over !== touchDrag.from ? `#${touchDrag.over + 1}` : "…"}</p>
        </div>
      )}
      <EditLinkDialog open={editLinkOpen} onOpenChange={setEditLinkOpen} url={shareInfo ? editLinkFor(shareOrigin(), shareInfo) : ""} />
      <CustomizePanel open={customizing} onOpenChange={setCustomizing} theme={theme} setTheme={setTheme} resolved={resolved}
        covers={filled.map((x) => x.c!.album.art)} count={count} setCount={setCount} focusCount={focusCount}
        showNames={showNames} setShowNames={setShowNames} onClear={clearChart} title={title} setTitle={setTitle} />
      <SongPicker idx={picker} cell={pickerCell} player={player} isNew={!!pending} onClose={closePicker} onPick={savePick}
        onRemove={() => { if (picker !== null) update(picker, null); closePicker(); }} />
    </div>
  );
}

type AudioSrc = "apple" | "deezer" | "youtube" | "bandcamp";
const AUDIO_SOURCES: { id: AudioSrc; label: "Apple Music" | "Deezer" | "YouTube" | "Bandcamp"; hint: string }[] = [
  { id: "apple", label: "Apple Music", hint: "30-second preview" },
  { id: "deezer", label: "Deezer", hint: "30-second preview" },
  { id: "youtube", label: "YouTube", hint: "Whole song in a YouTube player" },
  { id: "bandcamp", label: "Bandcamp", hint: "Whole song in Bandcamp's player" },
];
/** Bandcamp's embed picks its text colour from these; the picker uses the site's default dark theme. */
const PICKER_COLORS = { bg: "#121316", link: "#e8e9eb" };

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
  const [suggestedFff, setSuggestedFff] = useState<string | undefined>();
  // Audio source. Apple Music / Deezer: 30-second previews. YouTube / Bandcamp: the whole song, played in the
  // album window through that service's own player; hover and quick play still use a preview clip.
  // `clipSrc` is the catalog the tracklist and those clips come from.
  const homeSrc = cell?.album.src === "deezer" ? "deezer" : "apple";
  const [audioSrc, setAudioSrc] = useState<AudioSrc>(homeSrc);
  const [clipSrc, setClipSrc] = useState<"apple" | "deezer">(homeSrc);
  const full = audioSrc === "youtube" || audioSrc === "bandcamp";
  const chooseSrc = (s: AudioSrc) => { setAudioSrc(s); if (s === "apple" || s === "deezer") setClipSrc(s); };
  const loadedFor = useRef("");
  useEffect(() => {
    if (!cell) return;
    setNote(cell.note ?? ""); setGenre(cell.genre ?? ""); setFff(cell.fff ?? ""); setSuggestedGenre(undefined); setSuggestedFff(undefined);
    const t = cell.track;
    const clip = t?.src === "deezer" ? "deezer" : t?.preview ? "apple" : homeSrc;
    setClipSrc(clip);
    setAudioSrc(t?.player ?? clip);
    setYt({ status: "idle" }); setYtPaste(""); setBc({ status: "idle" }); setBcPaste(""); bcFor.current = "";
    const artist = cell.album.artist;
    getRelatedArtists({ data: { artist } }).then((a) => { if (a.length) setSuggestedFff(a.join(", ")); }).catch(() => {});
    fetchAlbum(cell.album).then((d) => setSuggestedGenre(d.genre)).catch(() => {});
  }, [idx, cell?.album.id]);
  useEffect(() => {
    if (!cell) return;
    let cancelled = false;
    setTracks(null);
    // Switching source keeps the same song selected; opening another album starts from its saved pick.
    const sameAlbum = loadedFor.current === `${idx}:${cell.album.id}`;
    loadedFor.current = `${idx}:${cell.album.id}`;
    const want = (sameAlbum ? chosen?.name : undefined) ?? cell.track?.name;
    setChosen(null);
    (clipSrc === homeSrc ? Promise.resolve<Pick<Album, "id" | "src"> | null>(cell.album) : findAlbumOn(clipSrc, cell.album))
      // Full-song sources list every track; preview sources only the ones with a clip.
      .then((a) => (a ? fetchAlbum(a).then((d) => (full ? d.tracks : d.tracks.filter((t) => t.preview))) : []))
      .then((list) => {
        if (cancelled) return;
        setTracks(list);
        setChosen(list.find((t) => t.id === cell.track?.id) ?? (want ? list.find((t) => normTitle(t.name) === normTitle(want)) : undefined) ?? null);
      })
      .catch(() => { if (!cancelled) setTracks([]); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, cell?.album.id, clipSrc, full]);

  // YouTube: the chosen song's video, found automatically (or pasted when the match is wrong).
  const [yt, setYt] = useState<{ status: "idle" | "loading" | "found" | "none" | "unavailable"; id?: string }>({ status: "idle" });
  const [ytPaste, setYtPaste] = useState("");
  useEffect(() => {
    if (audioSrc !== "youtube" || !cell || !chosen) return;
    const saved = cell.track;
    if (saved?.yt && normTitle(saved.name) === normTitle(chosen.name)) { setYt({ status: "found", id: saved.yt }); return; }
    let cancelled = false;
    setYt({ status: "loading" });
    findYouTubeVideo({ data: { artist: cell.album.artist, song: chosen.name } })
      .then((m) => { if (!cancelled) setYt(m.status === "found" ? { status: "found", id: m.id } : { status: m.status }); })
      .catch(() => { if (!cancelled) setYt({ status: "unavailable" }); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioSrc, chosen?.name, cell?.album.id]);
  const pastedYt = ytPaste ? youTubeId(ytPaste) : null;
  const ytId = pastedYt ?? (yt.status === "found" ? yt.id : undefined);

  // Bandcamp: the album found by artist and title (or a pasted album/track link); the chosen song is matched by name.
  const [bc, setBc] = useState<{ status: "idle" | "loading" | "found" | "none"; release?: BandcampRelease }>({ status: "idle" });
  const [bcPaste, setBcPaste] = useState("");
  const bcFor = useRef(""); // album the Bandcamp lookup ran for (once per opening)
  useEffect(() => {
    if (audioSrc !== "bandcamp" || !cell) return;
    const key = `${idx}:${cell.album.id}`;
    if (bcFor.current === key) return;
    bcFor.current = key;
    let cancelled = false;
    setBc({ status: "loading" });
    const saved = cell.track?.bc?.url;
    (saved ? getBandcampRelease({ data: { url: saved } }) : findBandcampAlbum({ data: { artist: cell.album.artist, album: cell.album.name } }))
      .then((r) => { if (!cancelled) setBc(r ? { status: "found", release: r } : { status: "none" }); })
      .catch(() => { if (!cancelled) setBc({ status: "none" }); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioSrc, idx, cell?.album.id]);
  const usePastedBandcamp = async () => {
    if (!bcPaste.trim()) return;
    setBc({ status: "loading" });
    const r = await getBandcampRelease({ data: { url: bcPaste.trim() } }).catch(() => null);
    setBc(r ? { status: "found", release: r } : { status: "none" });
  };
  const release = bc.release;
  const bcTrack = release ? (release.track ?? (chosen ? release.tracks.find((t) => normTitle(t.title) === normTitle(chosen.name))?.id : undefined)) : undefined;
  const bcRef = release ? { url: release.url, album: release.album, track: bcTrack } : undefined;

  const pickedTrack = (): Track | undefined => {
    if (!chosen) return undefined;
    const base: Track = { id: chosen.id, name: chosen.name, preview: chosen.preview, start: 0, ...(chosen.src ? { src: chosen.src } : {}) };
    // Keep a YouTube match already found for this song (lookups are rationed).
    const saved = cell?.track;
    if (saved?.yt !== undefined && normTitle(saved.name) === normTitle(chosen.name)) base.yt = saved.yt;
    if (audioSrc === "youtube" && ytId) return { ...base, player: "youtube", yt: ytId };
    if (audioSrc === "bandcamp" && bcRef) return { ...base, player: "bandcamp", bc: bcRef };
    return base;
  };
  return (
    <Dialog open={idx !== null && !!cell} onOpenChange={(o) => !o && onClose()}>
      {/* On phones, sit a little high so the host's corner badge never covers the buttons. */}
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto md:max-w-xl lg:max-w-2xl max-sm:top-[calc(50%-1.75rem)] max-sm:max-h-[calc(100dvh-8rem)]">
        {cell && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-4">
                <img src={cell.album.art} alt="" className="h-16 w-16 rounded-md" />
                <div>
                  <DialogTitle className="font-display text-2xl font-normal">{cell.album.name}</DialogTitle>
                  <p className="text-sm text-muted-foreground">{cell.album.artist} · hook a song to this album</p>
                </div>
              </div>
            </DialogHeader>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>Audio from</span>
              <div role="radiogroup" aria-label="Audio source" className="flex flex-wrap gap-1">
                {AUDIO_SOURCES.map((o) => (
                  <button key={o.id} role="radio" aria-checked={audioSrc === o.id} onClick={() => chooseSrc(o.id)} title={o.hint}
                    className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${audioSrc === o.id ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted hover:text-foreground"}`}>
                    <BrandIcon name={o.label} className="h-3 w-3" />{o.label}
                  </button>
                ))}
              </div>
            </div>
            <ul className="max-h-72 space-y-1 overflow-y-auto lg:max-h-96">
              {tracks === null && <li className="text-sm text-muted-foreground">Loading songs…</li>}
              {tracks?.length === 0 && (
                <li className="text-sm text-muted-foreground">
                  {clipSrc === homeSrc ? (full ? "Couldn't load this album's songs." : "No previews available for this album.") : `Couldn't find this album${full ? "" : " with previews"} on ${clipSrc === "deezer" ? "Deezer" : "Apple Music"}.`}{" "}
                  <button onClick={() => (full ? setClipSrc(clipSrc === "apple" ? "deezer" : "apple") : chooseSrc(clipSrc === "apple" ? "deezer" : "apple"))} className="underline underline-offset-2 hover:text-foreground">
                    Try {clipSrc === "apple" ? "Deezer" : "Apple Music"}
                  </button>
                </li>
              )}
              {tracks?.map((t, n) => (
                <li key={t.id} onClick={() => setChosen(t)}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm ${chosen?.id === t.id ? "bg-accent" : "hover:bg-muted"}`}>
                  <span className="w-5 text-muted-foreground">{n + 1}</span>
                  <span className="flex-1 truncate">{t.name}</span>
                  <button disabled={!t.preview} onClick={(e) => { e.stopPropagation(); play(`pick-${t.id}`, t); }} className="rounded-full p-1.5 hover:text-primary disabled:opacity-30" aria-label={`Play ${t.name}`}>
                    {playing === `pick-${t.id}` ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </button>
                </li>
              ))}
            </ul>
            {audioSrc === "youtube" && (
              <div className="space-y-2 rounded-lg border border-border p-3 text-sm">
                {!chosen ? <p className="text-muted-foreground">Pick a song above to find it on YouTube.</p>
                  : ytId ? <FullSongPlayer track={{ id: chosen.id, name: chosen.name, start: 0, player: "youtube", yt: ytId }} colors={PICKER_COLORS} />
                  : <p className="text-muted-foreground">{yt.status === "loading" ? "Finding it on YouTube…" : yt.status === "none" ? "Couldn't find this song on YouTube." : yt.status === "unavailable" ? "YouTube search is busy right now. Paste a link instead." : ""}</p>}
                <input value={ytPaste} onChange={(e) => setYtPaste(e.target.value)} placeholder={ytId && !pastedYt ? "Wrong video? Paste a YouTube link" : "Paste a YouTube link"}
                  className={`w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring ${ytPaste && !pastedYt ? "border-destructive" : "border-input"}`} />
                <p className="text-xs text-muted-foreground">Visitors get the whole song in a YouTube player when they open this album.</p>
              </div>
            )}
            {audioSrc === "bandcamp" && (
              <div className="space-y-2 rounded-lg border border-border p-3 text-sm">
                {bc.status === "loading" && <p className="text-muted-foreground">Looking on Bandcamp…</p>}
                {bc.status === "found" && release && bcRef && (
                  <>
                    <p className="text-xs text-muted-foreground">
                      <a href={release.url} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">{release.artist} — {release.title}</a>
                      {chosen && !bcTrack && " · couldn't match the song, so it plays the release from the start"}
                    </p>
                    <FullSongPlayer track={{ id: chosen?.id ?? 0, name: chosen?.name ?? release.title, start: 0, player: "bandcamp", bc: bcRef }} colors={PICKER_COLORS} />
                  </>
                )}
                {bc.status === "none" && bcPaste.trim() && <p className="text-destructive">Couldn't read that link. Paste a bandcamp.com album or track page.</p>}
                {bc.status === "none" && !bcPaste.trim() && (
                  <p className="text-muted-foreground">
                    Couldn't find it on Bandcamp.{" "}
                    <a href={`https://bandcamp.com/search?q=${encodeURIComponent(`${cell.album.artist} ${cell.album.name}`)}`} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">Search Bandcamp</a>{" "}
                    and paste the album or track link.
                  </p>
                )}
                <div className="flex gap-2">
                  <input value={bcPaste} onChange={(e) => setBcPaste(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") usePastedBandcamp(); }}
                    placeholder={bc.status === "found" ? "Different release? Paste a Bandcamp link" : "https://artist.bandcamp.com/album/…"}
                    className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
                  <button onClick={usePastedBandcamp} disabled={!bcPaste.trim()} className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50">Use</button>
                </div>
              </div>
            )}
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
                  <SuggestInput value={genre} onChange={setGenre} maxLength={60} suggestion={suggestedGenre} fallback="e.g. Dream pop" />
                </label>
                <label className="block text-sm">
                  <span className="text-xs uppercase tracking-widest text-muted-foreground">For fans of <span className="normal-case tracking-normal">(optional)</span></span>
                  <SuggestInput value={fff} onChange={setFff} maxLength={200} suggestion={suggestedFff} fallback="Artists, comma separated" />
                </label>
              </div>
              <div className="sticky -bottom-6 -mx-6 space-y-2 border-t border-border bg-background px-6 pb-6 pt-3">
              <button onClick={() => onPick(pickedTrack(), { note: note.trim(), genre: genre.trim(), fff: splitFff(fff).join(", ") })}
                className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">{isNew ? "Add to chart" : "Save"}</button>
              {!isNew && (
                <button onClick={onRemove}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-destructive/40 px-4 py-2 text-sm text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-4 w-4" />Remove from chart
                </button>
              )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Text field whose placeholder is a suggestion; Tab (or tapping "Use") fills it in for real. */
function SuggestInput({ value, onChange, suggestion, fallback, maxLength }: {
  value: string; onChange: (v: string) => void; suggestion?: string | undefined; fallback: string; maxLength: number;
}) {
  const offer = !value && !!suggestion;
  return (
    <span className="relative mt-2 block">
      <input value={value} onChange={(e) => onChange(e.target.value)} maxLength={maxLength} placeholder={suggestion ?? fallback}
        onKeyDown={(e) => { if (e.key === "Tab" && !e.shiftKey && offer) { e.preventDefault(); onChange(suggestion!.slice(0, maxLength)); } }}
        className={`w-full rounded-lg border border-input bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring ${offer ? "pr-14" : ""}`} />
      {offer && (
        <button type="button" onClick={() => onChange(suggestion!.slice(0, maxLength))} title="Use suggestion (Tab)"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground">
          <span className="[@media(hover:none)]:hidden">Tab</span><span className="[@media(hover:hover)]:hidden">Use</span>
        </button>
      )}
    </span>
  );
}

/** The chart title, shown in the theme's title style; click or tap it to rename. Optional: empty shows a faint "Add a title" here and nothing on the shared page. */
function EditableTitle({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <input autoFocus value={value} maxLength={80} aria-label="Chart title"
        onChange={(e) => onChange(e.target.value)} placeholder="Add a title (optional)" onBlur={() => { onChange(value.trim()); setEditing(false); }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") (e.target as HTMLInputElement).blur(); }}
        className="w-full rounded-lg border border-input bg-background/60 px-2 py-1 font-display text-3xl leading-tight outline-none focus:ring-2 focus:ring-ring md:text-5xl" />
    );
  }
  return (
    <h1 className={`crate-title group/title cursor-text font-display leading-none ${value ? "text-5xl md:text-6xl" : "text-2xl text-muted-foreground/70"}`} onClick={() => setEditing(true)} title="Rename">
      {value || "Add a title"}
      <Pencil className="ml-2 inline h-4 w-4 align-baseline text-muted-foreground opacity-60 transition group-hover/title:opacity-100" aria-hidden />
      <span className="sr-only">(rename)</span>
    </h1>
  );
}
