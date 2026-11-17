import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Search, Music2, Play, Pause, X, Disc3, Share2, Check, Youtube, ExternalLink, Crosshair, Link2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePlayer } from "@/lib/use-player";
import { searchYouTube, youTubeInfo, parseYouTube, fmt, unfmt, type YtVideo } from "@/lib/youtube.functions";

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

import type { Album, Track, Cell } from "@/lib/chart-types";
import { createChart, saveChart } from "@/lib/charts.functions";
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
  const [picker, setPicker] = useState<number | null>(null);
  const player = usePlayer();
  const { playing, play, stop } = player;
  const drag = useRef<number | null>(null);

  useEffect(() => {
    try {
      const d = JSON.parse(localStorage.getItem(STORE) || "null");
      setShareInfo(JSON.parse(localStorage.getItem(SHARE) || "null"));
      if (d) { setTitle(d.title); setCols(d.cols); setRows(d.rows); setCells([...d.cells, ...Array(100).fill(null)].slice(0, 100)); setShowNames(d.showNames ?? true); }
    } catch {}
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (loaded) localStorage.setItem(STORE, JSON.stringify({ title, cols, rows, cells, showNames }));
  }, [title, cols, rows, cells, showNames, loaded]);
  useEffect(() => {
    if (!loaded || !shareInfo) return;
    const t = setTimeout(() => {
      saveChart({ data: { ...shareInfo, data: { title, cols, rows, showNames, cells: cells.slice(0, cols * rows) } } }).catch(() => {});
    }, 800);
    return () => clearTimeout(t);
  }, [title, cols, rows, cells, showNames, loaded, shareInfo]);

  useEffect(() => {
    if (!q.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=album&limit=24`);
        const j = await r.json();
        setResults(j.results.map((a: any) => ({ id: a.collectionId, name: a.collectionName, artist: a.artistName, art: big(a.artworkUrl100) })));
      } catch { setResults([]); }
      setSearching(false);
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const [copied, setCopied] = useState(false);
  const share = async () => {
    const data = { title, cols, rows, showNames, cells: cells.slice(0, total) };
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
  const place = (album: Album) => {
    const next = [...cells];
    let idx = selected < total ? selected : 0;
    if (next[idx]) { const e = next.findIndex((c, i) => i < total && !c); if (e >= 0) idx = e; }
    next[idx] = { album };
    setCells(next);
    const after = next.findIndex((c, i) => i < total && !c);
    setSelected(after >= 0 ? after : idx);
    setPicker(idx);
  };
  const update = (i: number, c: Cell) => setCells((p) => p.map((x, j) => (j === i ? c : x)));
  const swap = (a: number, b: number) => setCells((p) => { const n = [...p]; const t = n[a] ?? null; n[a] = n[b] ?? null; n[b] = t; return n; });

  const filled = cells.slice(0, total).map((c, i) => ({ c, i })).filter((x) => x.c);

  return (
    <div className="min-h-screen">
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
            <p className="mt-2 text-xs text-muted-foreground">Click a cell, then pick an album. Drag cells to reorder.</p>
            <div className="mt-4 grid max-h-56 lg:max-h-[46vh] grid-cols-4 lg:grid-cols-3 gap-2 overflow-y-auto pr-1">
              {searching && <p className="col-span-3 text-sm text-muted-foreground">Searching…</p>}
              {results.map((a) => (
                <button key={a.id} onClick={() => place(a)} title={`${a.name} — ${a.artist}`}
                  className="group relative aspect-square overflow-hidden rounded-md">
                  <img src={a.art} alt={a.name} className="h-full w-full object-cover transition group-hover:scale-105" loading="lazy" />
                  <span className="absolute inset-x-0 bottom-0 bg-background/80 p-1 text-[10px] leading-tight opacity-0 transition group-hover:opacity-100 line-clamp-2">{a.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-border bg-card p-5 text-sm">
            <label className="block">
              <span className="text-xs uppercase tracking-widest text-muted-foreground">Title</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)}
                className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring" />
            </label>
            {([["Columns", cols, setCols], ["Rows", rows, setRows]] as const).map(([l, v, set]) => (
              <label key={l} className="block">
                <span className="flex justify-between text-xs uppercase tracking-widest text-muted-foreground"><span>{l}</span><span className="text-foreground">{v}</span></span>
                <input type="range" min={1} max={10} value={v} onChange={(e) => set(+e.target.value)} className="mt-2 w-full accent-primary" />
              </label>
            ))}
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={showNames} onChange={(e) => setShowNames(e.target.checked)} className="accent-primary" />
              Show album list under chart
            </label>
            <button onClick={() => { if (confirm("Clear the whole chart?")) { setCells(Array(100).fill(null)); stop(); } }}
              className="text-xs text-muted-foreground underline-offset-4 hover:text-destructive hover:underline">Clear chart</button>
          </div>
        </aside>

        <section className="rounded-3xl border border-border bg-card/60 p-4 shadow-record md:p-6">
          <div className="mb-6 flex items-start justify-between gap-4">
            <h1 className="font-display text-5xl leading-none md:text-6xl">{title}</h1>
            <button onClick={share} className="flex shrink-0 items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}{copied ? "Link copied" : "Share"}
            </button>
          </div>
          <div className="flex flex-col gap-8">
            <div className="grid flex-1 gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
              {cells.slice(0, total).map((c, i) => {
                const key = `cell-${i}`;
                const isPlaying = playing === key;
                return (
                  <div key={i} draggable={!!c}
                    onDragStart={() => (drag.current = i)} onDragOver={(e) => e.preventDefault()}
                    onDrop={() => { if (drag.current !== null) swap(drag.current, i); drag.current = null; }}
                    onClick={() => (c ? (c.track ? play(key, c.track) : setPicker(i)) : setSelected(i))}
                    className={`group relative aspect-square cursor-pointer overflow-hidden rounded-md transition ${c ? "" : "border border-dashed"} ${selected === i && !c ? "border-primary bg-accent" : "border-border bg-muted/40 hover:bg-muted"}`}>
                    {c ? (
                      <>
                        <img src={c.album.art} alt={c.album.name} className={`h-full w-full object-cover transition ${isPlaying ? "scale-105" : ""}`} />
                        <div className={`absolute inset-0 flex flex-col justify-between bg-background/70 p-2 transition ${isPlaying ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                          <div className="flex justify-end gap-1">
                            <button onClick={(e) => { e.stopPropagation(); setPicker(i); }} className="rounded-full bg-card p-1.5 hover:text-primary" title="Song & description"><Music2 className="h-3.5 w-3.5" /></button>
                            <button onClick={(e) => { e.stopPropagation(); if (isPlaying) stop(); update(i, null); }} className="rounded-full bg-card p-1.5 hover:text-destructive" title="Remove"><X className="h-3.5 w-3.5" /></button>
                          </div>
                          <div className="flex items-end gap-2">
                            {c.track ? (isPlaying ? <Pause className="h-6 w-6 shrink-0 text-primary" /> : <Play className="h-6 w-6 shrink-0 text-primary" />) : null}
                            <p className="line-clamp-2 text-xs leading-tight">{c.track ? c.track.name : "Pick a song"}</p>
                          </div>
                        </div>
                        {c.track && !isPlaying && (
                          <span className="absolute bottom-1.5 left-1.5 rounded-full bg-primary p-1 text-primary-foreground group-hover:opacity-0"><Music2 className="h-2.5 w-2.5" /></span>
                        )}
                        {isPlaying && (
                          <span className="absolute left-2 top-2 flex h-4 items-end gap-0.5">
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
            {showNames && filled.length > 0 && (
              <ol className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
                {filled.map(({ c, i }) => (
                  <li key={i} className="flex gap-2">
                    <span className="w-6 text-right font-display text-lg leading-5 text-primary">{i + 1}</span>
                    <span className="min-w-0">
                      <span className="font-medium">{c!.album.artist}</span> <span className="text-muted-foreground">— {c!.album.name}</span>
                      {c!.track && <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">{c!.track.yt ? <Youtube className="h-3 w-3 shrink-0" /> : "♪"} {c!.track.name}</span>}
                      {c!.note && <span className="mt-0.5 block text-xs italic text-foreground/80">“{c!.note}”</span>}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
      </main>

      <SongPicker idx={picker} cell={picker !== null ? (cells[picker] ?? null) : null} player={player}
        onClose={() => { stop(); setPicker(null); }}
        onPick={(t, note) => { if (picker !== null && cells[picker]) update(picker, { ...cells[picker]!, track: t ?? cells[picker]!.track, note }); stop(); setPicker(null); }} />
      {player.ui}
    </div>
  );
}

type ListTrack = { id: number; name: string; preview?: string | undefined };

function SongPicker({ idx, cell, onClose, onPick, player }: {
  idx: number | null; cell: Cell; onClose: () => void; onPick: (t: Track | undefined, note: string) => void;
  player: ReturnType<typeof usePlayer>;
}) {
  const { playing, play, stop } = player;
  const [tracks, setTracks] = useState<ListTrack[] | null>(null);
  const [chosen, setChosen] = useState<ListTrack | null>(null);
  const [video, setVideo] = useState<YtVideo | null>(null);
  const [results, setResults] = useState<YtVideo[]>([]);
  const [ytEnabled, setYtEnabled] = useState<boolean | null>(null);
  const [ytLoading, setYtLoading] = useState(false);
  const [link, setLink] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [start, setStart] = useState(0);
  const [startText, setStartText] = useState("0:00");
  const [duration, setDuration] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const open = idx !== null && !!cell;

  const setStartAt = (s: number) => { s = Math.max(0, Math.floor(s)); setStart(s); setStartText(fmt(s)); };

  useEffect(() => {
    if (!cell) return;
    const t = cell.track;
    setTracks(null); setResults([]); setLink(""); setLinkError(null); setNote(cell.note ?? "");
    setChosen(t && typeof t.id === "number" ? { id: t.id, name: t.name, preview: t.preview } : null);
    setVideo(t?.yt ? { id: t.yt, title: t.name, channel: "", thumb: `https://i.ytimg.com/vi/${t.yt}/mqdefault.jpg` } : null);
    setDuration(null); setStartAt(t?.start ?? 0);
    fetch(`https://itunes.apple.com/lookup?id=${cell.album.id}&entity=song`).then((r) => r.json()).then((j) =>
      setTracks(j.results.filter((x: any) => x.wrapperType === "track").map((x: any) => ({ id: x.trackId, name: x.trackName, preview: x.previewUrl }))),
    ).catch(() => setTracks([]));
  }, [idx, cell?.album.id]);

  const findOnYouTube = async (song: ListTrack) => {
    if (!cell || ytEnabled === false) return;
    setYtLoading(true);
    try {
      const r = await searchYouTube({ data: { q: `${cell.album.artist} ${song.name}` } });
      setYtEnabled(r.enabled); setResults(r.videos);
    } catch { setResults([]); }
    setYtLoading(false);
  };

  const chooseSong = (t: ListTrack) => {
    setChosen(t); setVideo(null); setDuration(null); setStartAt(0);
    findOnYouTube(t);
  };

  const chooseVideo = (v: YtVideo, at = 0) => {
    stop(); setVideo(v); setDuration(v.duration ?? null); setStartAt(at);
  };

  const applyLink = async () => {
    const p = parseYouTube(link);
    if (!p) { setLinkError("That doesn't look like a YouTube link."); return; }
    setLinkError(null);
    const info = await youTubeInfo({ data: { id: p.id } }).catch(() => null);
    chooseVideo(info ?? { id: p.id, title: chosen?.name ?? "YouTube video", channel: "", thumb: `https://i.ytimg.com/vi/${p.id}/mqdefault.jpg` }, p.start ?? 0);
    setLink("");
  };

  // While previewing a YouTube video, learn its length so the slider covers the whole song.
  const previewKey = video ? `try-yt-${video.id}` : null;
  useEffect(() => {
    if (!previewKey || playing !== previewKey || duration) return;
    const t = setInterval(() => { const d = player.duration(); if (d) { setDuration(Math.floor(d)); clearInterval(t); } }, 500);
    return () => clearInterval(t);
  }, [playing, previewKey, duration]);

  const max = video ? Math.max(duration ?? 600, start) : 25;
  const name = chosen?.name ?? video?.title ?? "";
  const canSave = !!(video || chosen?.preview);
  const save = () => {
    if (!canSave) return onPick(undefined, note.trim());
    onPick({ id: chosen?.id ?? video!.id, name, preview: chosen?.preview, start: video ? start : Math.min(start, 25), yt: video?.id }, note.trim());
  };
  const ytSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${cell?.album.artist ?? ""} ${chosen?.name ?? cell?.album.name ?? ""}`)}`;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()} modal={false}>
      {open && <div className="fixed inset-0 z-40 bg-black/80" aria-hidden />}
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto"
        onInteractOutside={(e) => { if ((e.target as HTMLElement | null)?.closest?.("[data-mini-player]")) e.preventDefault(); }}>
        {cell && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-4">
                <img src={cell.album.art} alt="" className="h-16 w-16 rounded-md" />
                <div className="min-w-0">
                  <DialogTitle className="font-display text-2xl font-normal">{cell.album.name}</DialogTitle>
                  <p className="text-sm text-muted-foreground">{cell.album.artist} · hook a song to this album</p>
                </div>
              </div>
            </DialogHeader>

            <section>
              <h3 className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">1 · Pick the song</h3>
              <ul className="max-h-56 space-y-1 overflow-y-auto">
                {tracks === null && <li className="text-sm text-muted-foreground">Loading songs…</li>}
                {tracks?.length === 0 && <li className="text-sm text-muted-foreground">No song list for this album. Paste a YouTube link below.</li>}
                {tracks?.map((t, n) => (
                  <li key={t.id} onClick={() => chooseSong(t)}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm ${chosen?.id === t.id ? "bg-accent" : "hover:bg-muted"}`}>
                    <span className="w-5 text-muted-foreground">{n + 1}</span>
                    <span className="flex-1 truncate">{t.name}</span>
                    {t.preview && (
                      <button onClick={(e) => { e.stopPropagation(); play(`pick-${t.id}`, { name: t.name, preview: t.preview, start: 0 }); }}
                        className="rounded-full p-1.5 hover:text-primary" title="Quick listen (30s Apple preview)">
                        {playing === `pick-${t.id}` ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>

            <section className="space-y-3 border-t border-border pt-4">
              <h3 className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground"><Youtube className="h-4 w-4" />2 · Play it from YouTube</h3>
              {video ? (
                <div className="flex items-center gap-3 rounded-lg bg-accent p-2">
                  <img src={video.thumb} alt="" className="h-12 w-20 rounded object-cover" />
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="truncate">{video.title}</p>
                    {video.channel && <p className="truncate text-xs text-muted-foreground">{video.channel}</p>}
                  </div>
                  <button onClick={() => { stop(); setVideo(null); setDuration(null); setStartAt(0); }} className="rounded-full p-1.5 hover:text-destructive" title="Remove video"><X className="h-4 w-4" /></button>
                </div>
              ) : (
                <>
                  {ytLoading && <p className="text-sm text-muted-foreground">Finding it on YouTube…</p>}
                  {!ytLoading && results.length > 0 && (
                    <ul className="space-y-1">
                      {results.map((v) => (
                        <li key={v.id}>
                          <button onClick={() => chooseVideo(v)} className="flex w-full items-center gap-3 rounded-lg p-1.5 text-left text-sm hover:bg-muted">
                            <img src={v.thumb} alt="" className="h-10 w-16 shrink-0 rounded object-cover" loading="lazy" />
                            <span className="min-w-0 flex-1"><span className="line-clamp-1">{v.title}</span><span className="block truncate text-xs text-muted-foreground">{v.channel}{v.duration ? ` · ${fmt(v.duration)}` : ""}</span></span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {!chosen && ytEnabled !== false && results.length === 0 && !ytLoading && <p className="text-xs text-muted-foreground">Pick a song above to find it on YouTube, or paste a link.</p>}
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Link2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <input value={link} onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => e.key === "Enter" && applyLink()} placeholder="Paste a YouTube link…"
                        className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
                    </div>
                    <button onClick={applyLink} disabled={!link.trim()} className="rounded-lg border border-border px-3 text-sm hover:bg-muted disabled:opacity-40">Use</button>
                  </div>
                  {linkError && <p className="text-xs text-destructive">{linkError}</p>}
                  <a href={ytSearchUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                    Search YouTube in a new tab <ExternalLink className="h-3 w-3" />
                  </a>
                </>
              )}
            </section>

            {(video || chosen?.preview) && (
              <section className="space-y-3 border-t border-border pt-4">
                <label className="block text-sm">
                  <span className="flex items-center justify-between text-xs uppercase tracking-widest text-muted-foreground">
                    <span>Start the clip at</span>
                    <input value={startText} onChange={(e) => setStartText(e.target.value)}
                      onBlur={() => { const v = unfmt(startText); if (v === null) setStartText(fmt(start)); else setStartAt(Math.min(v, max)); }}
                      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                      className="w-20 rounded border border-input bg-background px-2 py-0.5 text-right text-sm normal-case tracking-normal text-foreground outline-none focus:ring-2 focus:ring-ring" />
                  </span>
                  <input type="range" min={0} max={max} value={start} onChange={(e) => setStartAt(+e.target.value)} className="mt-2 w-full accent-primary" />
                  {!video && <span className="text-xs text-muted-foreground">Apple preview only (30s clip). Add a YouTube video for the full song.</span>}
                </label>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => { const key = video ? previewKey! : `try-${chosen!.id}`; if (playing === key) stop(); else play(key, { name, preview: chosen?.preview, start, yt: video?.id }); }}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted">
                    {playing === (video ? previewKey : `try-${chosen?.id}`) ? <><Pause className="h-4 w-4" />Stop</> : <><Play className="h-4 w-4" />Preview from {fmt(start)}</>}
                  </button>
                  {video && playing === previewKey && (
                    <button onClick={() => { const p = player.position(); if (p !== null) setStartAt(p); }}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted" title="Scrub in the player, then set the start to where it is now">
                      <Crosshair className="h-4 w-4" />Start from here
                    </button>
                  )}
                </div>
              </section>
            )}

            <section className="space-y-3 border-t border-border pt-4">
              <label className="block text-sm">
                <span className="text-xs uppercase tracking-widest text-muted-foreground">Why this pick?</span>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={280} rows={2} placeholder="A few words about this album…"
                  className="mt-2 w-full resize-none rounded-lg border border-input bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring" />
              </label>
              <button onClick={save} className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                {canSave ? `Save${video ? " · YouTube" : " · Apple preview"} from ${fmt(video ? start : Math.min(start, 25))}` : "Save"}
              </button>
            </section>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
