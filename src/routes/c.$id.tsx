import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Disc3, Play, Plus, Volume2, VolumeX } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlbumModal } from "@/components/AlbumModal";
import { getChart } from "@/lib/charts.functions";
import { chartCount, type ChartData } from "@/lib/chart-types";
import { canPlay, usePlayer } from "@/lib/use-player";
import { refreshPreviews } from "@/lib/deezer-previews";
import { parseTheme, resolveTheme } from "@/lib/theme";
import { ThemeScope } from "@/components/ThemeScope";
import { RankList } from "@/components/RankList";
import { ListenBar } from "@/components/ListenBar";
import { useBackToClose } from "@/lib/use-back-to-close";

const chartQuery = (id: string) =>
  queryOptions({ queryKey: ["chart", id], queryFn: () => getChart({ data: { id } }) as Promise<ChartData | null>, refetchInterval: 15000 });

export const Route = createFileRoute("/c/$id")({
  loader: async ({ context, params }) => {
    if (!/^[0-9a-f-]{36}$/i.test(params.id)) throw notFound();
    const d = await context.queryClient.ensureQueryData(chartQuery(params.id));
    if (!d) throw notFound();
    return { title: d.title, fontHref: resolveTheme(parseTheme(d.theme)).fontHref };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.title || "An album chart"} — Crate` },
      { name: "description", content: "An album chart with song previews, made on Crate." },
      { property: "og:title", content: `${loaderData?.title || "An album chart"} — Crate` },
      { property: "og:description", content: "Listen to the songs behind every album pick." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    // Load the theme fonts server-side so the page doesn't flash the default fonts.
    links: loaderData?.fontHref ? [{ rel: "stylesheet", href: loaderData.fontHref }] : [],
  }),
  component: SharedChart,
});

function SharedChart() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(chartQuery(id));
  const player = usePlayer();
  const theme = useMemo(() => resolveTheme(parseTheme(data?.theme)), [data?.theme]);
  const [open, setOpen] = useState<number | null>(null);
  useBackToClose(open !== null, () => { player.stop(); setOpen(null); });
  const [soundBlocked, setSoundBlocked] = useState(false);
  // Play on hover: the creator's choice, which each visitor can flip for this chart (remembered in their browser).
  const hoverKey = `crate-hover-play:${id}`;
  const [hoverPref, setHoverPref] = useState<boolean | null>(null);
  useEffect(() => { try { const v = localStorage.getItem(hoverKey); if (v === "1" || v === "0") setHoverPref(v === "1"); } catch {} }, [hoverKey]);
  const hoverOn = hoverPref ?? theme.hoverPlay;
  const setHover = (on: boolean) => {
    setHoverPref(on);
    try { localStorage.setItem(hoverKey, on ? "1" : "0"); } catch {}
    if (!on) player.stop();
  };
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openRef = useRef<number | null>(null);
  openRef.current = open;

  // Deezer preview links expire, so fetch fresh ones for this chart up front.
  useEffect(() => {
    const ids = (data?.cells ?? []).flatMap((c) => (c?.track?.src === "deezer" && typeof c.track.id === "number" ? [c.track.id] : []));
    if (ids.length) refreshPreviews(ids).catch(() => {});
  }, [data]);

  // Browsers block sound until the visitor clicks or taps the page once; hide the hint after that.
  useEffect(() => {
    if (!soundBlocked) return;
    const clear = () => setSoundBlocked(false);
    window.addEventListener("pointerdown", clear, { once: true });
    window.addEventListener("keydown", clear, { once: true });
    return () => { window.removeEventListener("pointerdown", clear); window.removeEventListener("keydown", clear); };
  }, [soundBlocked]);

  if (!data) return null;
  const cells = data.cells.slice(0, chartCount(data));
  const cellKey = (i: number) => `cell-${i}`;

  const hoverStart = (i: number, e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || openRef.current !== null || !hoverOn) return;
    const t = cells[i]?.track;
    if (!t || !canPlay(t)) return;
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    // Short delay so sweeping the mouse across the grid doesn't fire a burst of clips.
    hoverTimer.current = setTimeout(async () => {
      const ok = await player.play(cellKey(i), t, { toggle: false });
      if (!ok) setSoundBlocked(true);
    }, 180);
  };
  const hoverEnd = (i: number) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    if (openRef.current !== null) return; // opening the modal covers the cell; keep the clip going
    if (player.playing === cellKey(i)) player.stop();
  };
  // Clicking or tapping an album opens its window and plays the picked song (a click counts as the
  // gesture browsers need before playing sound). Next / previous move through the picks the same way.
  const openAlbum = async (i: number) => {
    const c = cells[i];
    if (!c) return;
    setOpen(i);
    const t = c.track;
    if (t && canPlay(t) && player.playing !== cellKey(i)) {
      const ok = await player.play(cellKey(i), t, { toggle: false });
      if (!ok) setSoundBlocked(true);
    } else if (!t || !canPlay(t)) player.stop();
  };
  const picks = cells.flatMap((c, i) => (c ? [i] : []));
  const step = (dir: 1 | -1) => {
    if (open === null) return;
    const at = picks.indexOf(open);
    const next = picks[at + dir];
    if (next !== undefined) openAlbum(next);
  };
  const toggle = (i: number) => {
    const t = cells[i]?.track;
    if (t) player.play(cellKey(i), t);
  };

  return (
    <ThemeScope theme={theme} className="min-h-screen">
      <header className="mx-auto flex max-w-[2000px] items-center justify-between gap-3 px-4 pt-6 md:px-8 2xl:px-12">
        <Link to="/" className="flex items-center gap-2"><Disc3 className="h-6 w-6" /><span className="font-display text-2xl italic">Crate</span></Link>
        <Link to="/" className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" />Make your own crate
        </Link>
      </header>
      <main className="mx-auto max-w-[2000px] px-4 py-8 md:px-8 2xl:px-12">
        {data.title && <h1 className="crate-title mb-2 font-display text-5xl leading-none md:text-7xl">{data.title}</h1>}
        {theme.tagline && <p className="mb-2 text-base text-foreground/80 md:text-lg">{theme.tagline}</p>}
        {/* Mouse-only: phones never play on hover. */}
        <div className="mt-6 hidden justify-end [@media(hover:hover)]:flex">
          <button role="switch" aria-checked={hoverOn} onClick={() => setHover(!hoverOn)}
            className="flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
            {hoverOn ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}Play on hover
            <span className={`relative h-4 w-7 rounded-full transition ${hoverOn ? "bg-primary" : "bg-muted-foreground/40"}`}>
              <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-background transition-all ${hoverOn ? "left-3.5" : "left-0.5"}`} />
            </span>
          </button>
        </div>
        <div className={`mt-4 flex flex-col gap-10 [@media(hover:none)]:mt-8 ${data.showNames && theme.list.pos === "side" ? "lg:flex-row lg:items-start" : ""}`}>
          <div className="crate-grid grid min-w-0 flex-1">
            {cells.map((c, i) => {
              const isPlaying = player.playing === cellKey(i);
              return (
                <div key={i} data-index={i} data-filled={c ? "" : undefined} data-playing={isPlaying ? "" : undefined}
                  role={c ? "button" : undefined} tabIndex={c ? 0 : undefined}
                  aria-label={c ? `Open ${c.album.name} by ${c.album.artist}` : undefined}
                  onPointerEnter={(e) => hoverStart(i, e)} onPointerLeave={(e) => { if (e.pointerType === "mouse") hoverEnd(i); }}
                  onClick={() => openAlbum(i)}
                  onKeyDown={(e) => { if (c && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openAlbum(i); } }}
                  className={`crate-cell group relative aspect-square overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-ring ${c ? "cursor-pointer" : "bg-muted/40"}`}>
                  {c && (
                    <>
                      <img src={c.album.art} alt="" className={`crate-cover h-full w-full object-cover transition duration-300 ${isPlaying ? "scale-105" : ""}`} />
                      {c.track && !isPlaying && <span aria-hidden className="crate-playhint pointer-events-none absolute left-1/2 top-1/2 z-[2] grid aspect-square w-[17%] min-w-6 max-w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/20 text-white/80 ring-1 ring-white/20 backdrop-blur-[1px] transition-opacity [@media(hover:hover)]:group-hover:opacity-0"><Play className="ml-[8%] h-[45%] w-[45%] fill-current" /></span>}
                      <div className={`crate-overlay absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-background/90 via-background/30 to-transparent p-2 transition ${isPlaying ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"}`}>
                        <div className="flex items-end gap-2">
                          {c.track && (isPlaying ? (
                            <span className="flex h-4 shrink-0 items-end gap-0.5">
                              {[0, 0.2, 0.4].map((d) => <span key={d} className="eq-bar h-full w-1 rounded bg-primary" style={{ animationDelay: `${d}s` }} />)}
                            </span>
                          ) : <Play className="h-4 w-4 shrink-0" />)}
                          <p className="line-clamp-2 min-w-0 text-xs leading-tight"><span className="font-medium">{c.album.artist}</span> — {c.album.name}</p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          {data.showNames && (
            <RankList cells={cells} list={theme.list} onOpen={(i) => openAlbum(i)} onPlay={toggle} isPlaying={(i) => player.playing === cellKey(i)} />
          )}
        </div>
        <ListenBar cells={cells} title={data.title} />
      </main>
      <AlbumModal index={open} cell={open !== null ? (cells[open] ?? null) : null} player={player}
        onClose={() => { player.stop(); setOpen(null); }}
        position={open !== null ? { at: picks.indexOf(open) + 1, of: picks.length } : null}
        onPrev={open !== null && picks.indexOf(open) > 0 ? () => step(-1) : undefined}
        onNext={open !== null && picks.indexOf(open) < picks.length - 1 ? () => step(1) : undefined} />
      {soundBlocked && (
        <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-full border border-border bg-card px-4 py-2 text-xs shadow-xl">
          Click anywhere on the page to turn on sound
        </div>
      )}
    </ThemeScope>
  );
}
