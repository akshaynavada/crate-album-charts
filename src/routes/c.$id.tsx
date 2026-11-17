import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Disc3, Play, Pause, Plus } from "lucide-react";
import { getChart } from "@/lib/charts.functions";
import type { ChartData } from "@/lib/chart-types";

const chartQuery = (id: string) =>
  queryOptions({ queryKey: ["chart", id], queryFn: () => getChart({ data: { id } }) as Promise<ChartData | null>, refetchInterval: 15000 });

export const Route = createFileRoute("/c/$id")({
  loader: async ({ context, params }) => {
    if (!/^[0-9a-f-]{36}$/i.test(params.id)) throw notFound();
    const d = await context.queryClient.ensureQueryData(chartQuery(params.id));
    if (!d) throw notFound();
    return { title: d.title };
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
  }),
  component: SharedChart,
});

function SharedChart() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(chartQuery(id));
  const [playing, setPlaying] = useState<number | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    audio.current = new Audio();
    audio.current.onended = () => setPlaying(null);
    return () => audio.current?.pause();
  }, []);
  if (!data) return null;
  const cells = data.cells.slice(0, data.cols * data.rows);
  const filled = cells.map((c, i) => ({ c, i })).filter((x) => x.c);
  const play = (i: number) => {
    const c = cells[i]; const a = audio.current;
    if (!c?.track || !a) return;
    if (playing === i) { a.pause(); setPlaying(null); return; }
    a.src = c.track.preview;
    const start = c.track.start;
    a.onloadedmetadata = () => { a.currentTime = start; };
    a.play().catch(() => {}); setPlaying(i);
  };

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-4 pt-6 md:px-6">
        <Link to="/" className="flex items-center gap-2"><Disc3 className="h-6 w-6" /><span className="font-display text-2xl italic">Crate</span></Link>
        <Link to="/" className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" />Make your own crate
        </Link>
      </header>
      <main className="mx-auto max-w-[1400px] px-4 py-8 md:px-6">
        <h1 className="mb-2 font-display text-5xl leading-none md:text-7xl">{data.title}</h1>
        <p className="mb-8 text-sm text-muted-foreground">Tap an album to hear the song picked for it.</p>
        <div className="grid gap-1.5 md:gap-2" style={{ gridTemplateColumns: `repeat(${data.cols}, minmax(0,1fr))` }}>
          {cells.map((c, i) => (
            <div key={i} onClick={() => play(i)}
              className={`group relative aspect-square overflow-hidden rounded-md ${c ? (c.track ? "cursor-pointer" : "") : "bg-muted/40"}`}>
              {c && (
                <>
                  <img src={c.album.art} alt={`${c.album.name} by ${c.album.artist}`} className="h-full w-full object-cover" />
                  {c.track && (
                    <div className={`absolute inset-0 flex items-end gap-2 bg-background/70 p-2 transition ${playing === i ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                      {playing === i ? <Pause className="h-6 w-6 shrink-0" /> : <Play className="h-6 w-6 shrink-0" />}
                      <p className="line-clamp-2 text-xs leading-tight">{c.track.name}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
        {data.showNames && filled.length > 0 && (
          <ol className="mt-10 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {filled.map(({ c, i }) => (
              <li key={i} className="flex gap-2">
                <span className="w-6 text-right font-display text-lg leading-5">{i + 1}</span>
                <span className="min-w-0">
                  <span className="font-medium">{c!.album.artist}</span> <span className="text-muted-foreground">— {c!.album.name}</span>
                  {c!.track && (
                    <button onClick={() => play(i)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                      {playing === i ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}{c!.track.name}
                    </button>
                  )}
                  {c!.note && <span className="mt-0.5 block text-xs italic text-foreground/80">“{c!.note}”</span>}
                </span>
              </li>
            ))}
          </ol>
        )}
      </main>
    </div>
  );
}
