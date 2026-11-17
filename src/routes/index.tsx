import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Search, Music2, Play, Pause, X, Disc3 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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

type Album = { id: number; name: string; artist: string; art: string };
type Track = { id: number; name: string; preview: string; start: number };
type Cell = { album: Album; track?: Track } | null;

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
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Album[]>([]);
  const [searching, setSearching] = useState(false);
  const [picker, setPicker] = useState<number | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const drag = useRef<number | null>(null);

  useEffect(() => {
    try {
      const d = JSON.parse(localStorage.getItem(STORE) || "null");
      if (d) { setTitle(d.title); setCols(d.cols); setRows(d.rows); setCells(d.cells); setShowNames(d.showNames ?? true); }
    } catch {}
    setLoaded(true);
    audio.current = new Audio();
    audio.current.onended = () => setPlaying(null);
    return () => audio.current?.pause();
  }, []);
  useEffect(() => {
    if (loaded) localStorage.setItem(STORE, JSON.stringify({ title, cols, rows, cells, showNames }));
  }, [title, cols, rows, cells, showNames, loaded]);

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

  const play = (key: string, url: string, start = 0) => {
    const a = audio.current!;
    if (playing === key) { a.pause(); setPlaying(null); return; }
    a.src = url;
    a.onloadedmetadata = () => { a.currentTime = start; };
    a.play().catch(() => {});
    setPlaying(key);
  };
  const stop = () => { audio.current?.pause(); setPlaying(null); };

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
      <header className="mx-auto flex max-w-7xl items-center gap-3 px-6 pt-8">
        <Disc3 className="h-7 w-7 text-primary" />
        <span className="font-display text-3xl italic">Crate</span>
        <span className="ml-2 text-sm text-muted-foreground">album charts that sound like you</span>
      </header>

      <main className="mx-auto grid max-w-7xl gap-8 px-6 py-8 lg:grid-cols-[340px_1fr]">
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
              Show album list beside chart
            </label>
            <button onClick={() => { if (confirm("Clear the whole chart?")) { setCells(Array(100).fill(null)); stop(); } }}
              className="text-xs text-muted-foreground underline-offset-4 hover:text-destructive hover:underline">Clear chart</button>
          </div>
        </aside>

        <section className="rounded-3xl border border-border bg-card/60 p-6 shadow-record md:p-8">
          <h1 className="mb-6 font-display text-5xl leading-none md:text-6xl">{title}</h1>
          <div className="flex flex-col gap-8 xl:flex-row">
            <div className="grid flex-1 gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
              {cells.slice(0, total).map((c, i) => {
                const key = `cell-${i}`;
                const isPlaying = playing === key;
                return (
                  <div key={i} draggable={!!c}
                    onDragStart={() => (drag.current = i)} onDragOver={(e) => e.preventDefault()}
                    onDrop={() => { if (drag.current !== null) swap(drag.current, i); drag.current = null; }}
                    onClick={() => (c ? (c.track ? play(key, c.track.preview, c.track.start) : setPicker(i)) : setSelected(i))}
                    className={`group relative aspect-square cursor-pointer overflow-hidden rounded-md transition ${c ? "" : "border border-dashed"} ${selected === i && !c ? "border-primary bg-accent" : "border-border bg-muted/40 hover:bg-muted"}`}>
                    {c ? (
                      <>
                        <img src={c.album.art} alt={c.album.name} className={`h-full w-full object-cover transition ${isPlaying ? "scale-105" : ""}`} />
                        <div className={`absolute inset-0 flex flex-col justify-between bg-background/70 p-2 transition ${isPlaying ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                          <div className="flex justify-end gap-1">
                            <button onClick={(e) => { e.stopPropagation(); setPicker(i); }} className="rounded-full bg-card p-1.5 hover:text-primary" title="Choose song"><Music2 className="h-3.5 w-3.5" /></button>
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
              <ol className="space-y-1.5 text-sm xl:w-72">
                {filled.map(({ c, i }) => (
                  <li key={i} className="flex gap-2">
                    <span className="w-6 text-right font-display text-lg leading-5 text-primary">{i + 1}</span>
                    <span className="min-w-0">
                      <span className="font-medium">{c!.album.artist}</span> <span className="text-muted-foreground">— {c!.album.name}</span>
                      {c!.track && <span className="block truncate text-xs text-primary/80">♪ {c!.track.name}</span>}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
      </main>

      <SongPicker idx={picker} cell={picker !== null ? (cells[picker] ?? null) : null} playing={playing} play={play} stop={stop}
        onClose={() => { stop(); setPicker(null); }}
        onPick={(t) => { if (picker !== null && cells[picker]) update(picker, { ...cells[picker]!, track: t }); stop(); setPicker(null); }} />
    </div>
  );
}

function SongPicker({ idx, cell, onClose, onPick, playing, play, stop }: {
  idx: number | null; cell: Cell; onClose: () => void; onPick: (t: Track) => void;
  playing: string | null; play: (k: string, u: string, s?: number) => void; stop: () => void;
}) {
  const [tracks, setTracks] = useState<Omit<Track, "start">[]>([]);
  const [chosen, setChosen] = useState<number | null>(null);
  const [start, setStart] = useState(0);
  useEffect(() => {
    if (!cell) return;
    setTracks([]); setChosen(cell.track?.id ?? null); setStart(cell.track?.start ?? 0);
    fetch(`https://itunes.apple.com/lookup?id=${cell.album.id}&entity=song`).then((r) => r.json()).then((j) =>
      setTracks(j.results.filter((t: any) => t.wrapperType === "track" && t.previewUrl).map((t: any) => ({ id: t.trackId, name: t.trackName, preview: t.previewUrl }))),
    ).catch(() => {});
  }, [idx, cell?.album.id]);
  const sel = tracks.find((t) => t.id === chosen);
  return (
    <Dialog open={idx !== null && !!cell} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
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
            <ul className="max-h-72 space-y-1 overflow-y-auto">
              {tracks.length === 0 && <li className="text-sm text-muted-foreground">Loading songs…</li>}
              {tracks.map((t, n) => (
                <li key={t.id} onClick={() => { setChosen(t.id); setStart(0); }}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm ${chosen === t.id ? "bg-accent" : "hover:bg-muted"}`}>
                  <span className="w-5 text-muted-foreground">{n + 1}</span>
                  <span className="flex-1 truncate">{t.name}</span>
                  <button onClick={(e) => { e.stopPropagation(); play(`pick-${t.id}`, t.preview); }} className="rounded-full p-1.5 hover:text-primary">
                    {playing === `pick-${t.id}` ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </button>
                </li>
              ))}
            </ul>
            {sel && (
              <div className="space-y-3 border-t border-border pt-4">
                <label className="block text-sm">
                  <span className="flex justify-between text-xs uppercase tracking-widest text-muted-foreground"><span>Excerpt starts at</span><span className="text-foreground">0:{String(start).padStart(2, "0")}</span></span>
                  <input type="range" min={0} max={25} value={start} onChange={(e) => setStart(+e.target.value)} className="mt-2 w-full accent-primary" />
                </label>
                <div className="flex gap-2">
                  <button onClick={() => { stop(); play(`try-${sel.id}-${start}`, sel.preview, start); }} className="flex-1 rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted">Preview excerpt</button>
                  <button onClick={() => onPick({ ...sel, start })} className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Hook this song</button>
                </div>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
