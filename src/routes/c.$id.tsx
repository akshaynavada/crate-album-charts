import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Disc3, Play, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlbumModal } from "@/components/AlbumModal";
import { getChart } from "@/lib/charts.functions";
import type { ChartData } from "@/lib/chart-types";
import { canPlay, usePlayer } from "@/lib/use-player";
import { refreshPreviews } from "@/lib/deezer-previews";
import { parseTheme, resolveTheme } from "@/lib/theme";
import { ThemeScope } from "@/components/ThemeScope";
import { RankList } from "@/components/RankList";

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
      { title: `${loaderData?.title ?? "A chart"} — Crate` },
      { name: "description", content: "An album chart with song previews, made on Crate." },
      { property: "og:title", content: `${loaderData?.title ?? "A chart"} — Crate` },
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
  const [soundBlocked, setSoundBlocked] = useState(false);
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
  const cells = data.cells.slice(0, data.cols * data.rows);
  const cellKey = (i: number) => `cell-${i}`;

  const hoverStart = (i: number, e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || openRef.current !== null) return;
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
  const toggle = (i: number) => {
    const t = cells[i]?.track;
    if (t) player.play(cellKey(i), t);
  };

  return (
    <ThemeScope theme={theme} className="min-h-screen">
      <header className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-4 pt-6 md:px-6">
        <Link to="/" className="flex items-center gap-2"><Disc3 className="h-6 w-6" /><span className="font-display text-2xl italic">Crate</span></Link>
        <Link to="/" className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" />Make your own crate
        </Link>
      </header>
      <main className="mx-auto max-w-[1400px] px-4 py-8 md:px-6">
        <h1 className="crate-title mb-2 font-display text-5xl leading-none md:text-7xl">{data.title}</h1>
        {theme.tagline && <p className="mb-3 text-base text-foreground/80 md:text-lg">{theme.tagline}</p>}
        <p className="mb-8 text-sm text-muted-foreground">
          <span className="hidden [@media(hover:hover)]:inline">Hover over an album to hear the song picked for it. Click to open the album.</span>
          <span className="[@media(hover:hover)]:hidden">Tap an album to hear its songs.</span>
        </p>
        <div className={`flex flex-col gap-10 ${data.showNames && theme.list.pos === "side" ? "lg:flex-row lg:items-start" : ""}`}>
          <div className="crate-grid grid min-w-0 flex-1" style={{ gridTemplateColumns: `repeat(${data.cols}, minmax(0,1fr))` }}>
            {cells.map((c, i) => {
              const isPlaying = player.playing === cellKey(i);
              return (
                <div key={i} data-index={i} data-filled={c ? "" : undefined} data-playing={isPlaying ? "" : undefined}
                  role={c ? "button" : undefined} tabIndex={c ? 0 : undefined}
                  aria-label={c ? `Open ${c.album.name} by ${c.album.artist}` : undefined}
                  onPointerEnter={(e) => hoverStart(i, e)} onPointerLeave={() => hoverEnd(i)}
                  onClick={() => c && setOpen(i)}
                  onKeyDown={(e) => { if (c && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); setOpen(i); } }}
                  className={`crate-cell group relative aspect-square overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-ring ${c ? "cursor-pointer" : "bg-muted/40"}`}>
                  {c && (
                    <>
                      <img src={c.album.art} alt="" className={`crate-cover h-full w-full object-cover transition duration-300 ${isPlaying ? "scale-105" : ""}`} />
                      <div className={`crate-overlay absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-background/90 via-background/30 to-transparent p-2 transition ${isPlaying ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"}`}>
                        {c.track && (
                          <div className="flex items-end gap-2">
                            {isPlaying ? (
                              <span className="flex h-4 shrink-0 items-end gap-0.5">
                                {[0, 0.2, 0.4].map((d) => <span key={d} className="eq-bar h-full w-1 rounded bg-primary" style={{ animationDelay: `${d}s` }} />)}
                              </span>
                            ) : <Play className="h-4 w-4 shrink-0" />}
                            <p className="line-clamp-2 text-xs leading-tight">{c.track.name}</p>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          {data.showNames && (
            <RankList cells={cells} list={theme.list} onOpen={(i) => setOpen(i)} onPlay={toggle} isPlaying={(i) => player.playing === cellKey(i)} />
          )}
        </div>
      </main>
      <AlbumModal index={open} cell={open !== null ? (cells[open] ?? null) : null} player={player}
        onClose={() => { player.stop(); setOpen(null); }} />
      {soundBlocked && (
        <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-full border border-border bg-card px-4 py-2 text-xs shadow-xl">
          Click anywhere on the page to turn on sound
        </div>
      )}
    </ThemeScope>
  );
}
