import { Pause, Play } from "lucide-react";
import type { Cell } from "@/lib/chart-types";
import { splitFff } from "@/lib/itunes";
import { formatRank, type ListSettings } from "@/lib/theme";

/**
 * The numbered album list shown beside or below the grid (editor preview and shared page).
 * What it shows (rank style, size, song, note, genre, For Fans Of) comes from the crate theme's list settings.
 */
export function RankList({ cells, list, onOpen, onPlay, isPlaying }: {
  cells: Cell[]; list: ListSettings;
  onOpen?: (i: number) => void; onPlay?: (i: number) => void; isPlaying?: (i: number) => boolean;
}) {
  const filled = cells.map((c, i) => ({ c: c!, i })).filter((x) => x.c);
  if (!filled.length) return null;
  const side = list.pos === "side";
  return (
    <ol data-size={list.size}
      className={`crate-list min-w-0 ${side ? "flex flex-col gap-2.5 lg:w-[clamp(240px,32%,420px)] lg:shrink-0" : "grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3"}`}>
      {filled.map(({ c, i }) => {
        const fff = list.fff ? splitFff(c.fff) : [];
        const rank = formatRank(i + 1, list.num);
        return (
          <li key={i} className="flex min-w-0 gap-2 leading-snug">
            {rank && <span className="min-w-[1.6em] shrink-0 text-right font-display tabular-nums text-primary">{rank}</span>}
            <span className="min-w-0">
              {onOpen ? (
                <button onClick={() => onOpen(i)} className="text-left hover:underline">
                  <span className="font-medium">{c.album.artist}</span> <span className="text-muted-foreground">— {c.album.name}</span>
                </button>
              ) : (
                <span><span className="font-medium">{c.album.artist}</span> <span className="text-muted-foreground">— {c.album.name}</span></span>
              )}
              {list.genre && c.genre && <span className="ml-1.5 inline-block rounded-full border border-border px-1.5 text-[0.75em] text-muted-foreground">{c.genre}</span>}
              {list.song && c.track && (
                onPlay ? (
                  <button onClick={() => onPlay(i)} className="flex max-w-full items-center gap-1 text-[0.85em] text-muted-foreground hover:text-foreground">
                    {isPlaying?.(i) ? <Pause className="h-3 w-3 shrink-0" /> : <Play className="h-3 w-3 shrink-0" />}<span className="truncate">{c.track.name}</span>
                  </button>
                ) : (
                  <span className="block truncate text-[0.85em] text-muted-foreground">♪ {c.track.name}</span>
                )
              )}
              {list.note && c.note && <span className="mt-0.5 block text-[0.85em] italic text-foreground/80">“{c.note}”</span>}
              {fff.length > 0 && <span className="mt-0.5 block text-[0.8em] text-muted-foreground">FFO: {fff.join(", ")}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
