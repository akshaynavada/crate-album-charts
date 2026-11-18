import { useEffect, useState } from "react";
import { ExternalLink, Music2, Pause, Play } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Cell } from "@/lib/chart-types";
import { albumLinks, fetchAlbum, splitFff, type AlbumDetails } from "@/lib/itunes";
import type { usePlayer } from "@/lib/use-player";

/** Shared-view album detail: the creator's note, every track's preview, and links out to streaming stores. */
export function AlbumModal({ cell, index, onClose, player }: {
  cell: Cell; index: number | null; onClose: () => void; player: ReturnType<typeof usePlayer>;
}) {
  const [details, setDetails] = useState<AlbumDetails | null>(null);
  const [failed, setFailed] = useState(false);
  const open = index !== null && !!cell;

  useEffect(() => {
    if (!cell) return;
    setDetails(null); setFailed(false);
    fetchAlbum(cell.album.id).then(setDetails).catch(() => setFailed(true));
  }, [cell?.album.id]);

  if (!cell) return null;
  const hooked = cell.track;
  // The hooked song shares the grid cell's key so a clip started by hovering keeps playing in here.
  const keyFor = (id: number | string) => (hooked && id === hooked.id ? `cell-${index}` : `trk-${id}`);
  const links = albumLinks(cell.album, details?.appleUrl);
  const fff = splitFff(cell.fff);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      {/* Desktop: square art on the left sized to the dialog height, details scroll on the right. */}
      <DialogContent style={{ ["--h" as string]: "min(86vh, 600px, 52vw)" }}
        className="max-h-[92vh] max-w-[calc(var(--h)+400px)] gap-0 overflow-y-auto p-0 md:overflow-hidden [&>button:last-child]:rounded-full [&>button:last-child]:bg-background/70 [&>button:last-child]:p-1.5">
        <div className="grid md:h-[var(--h)] md:grid-cols-[var(--h)_minmax(0,1fr)]">
          <img src={cell.album.art} alt={`${cell.album.name} by ${cell.album.artist}`} className="aspect-square w-full object-cover sm:rounded-t-lg md:h-full md:rounded-l-lg md:rounded-tr-none" />
          <div className="flex min-w-0 flex-col gap-5 p-5 md:overflow-y-auto md:p-6">
            <DialogHeader className="space-y-1 text-left">
              {index !== null && <span className="font-display text-lg text-muted-foreground">No. {index + 1}</span>}
              <DialogTitle className="font-display text-3xl font-normal leading-tight">{cell.album.name}</DialogTitle>
              <DialogDescription className="text-sm">
                {cell.album.artist}{details?.year ? ` · ${details.year}` : ""}
              </DialogDescription>
            </DialogHeader>

            {cell.genre && (
              <span className="-mt-2 w-fit rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">{cell.genre}</span>
            )}

            {cell.note && (
              <blockquote className="border-l-2 border-primary/60 pl-3 text-sm italic text-foreground/90">“{cell.note}”</blockquote>
            )}

            {fff.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">For fans of</h3>
                <ul className="flex flex-wrap gap-1.5">
                  {fff.map((a) => <li key={a} className="rounded-full bg-muted px-2.5 py-1 text-xs">{a}</li>)}
                </ul>
              </div>
            )}

            {hooked?.preview && (
              <button onClick={() => player.play(keyFor(hooked.id), hooked)}
                className="flex items-center gap-3 rounded-lg bg-accent px-3 py-2.5 text-left text-sm hover:bg-accent/80">
                {player.playing === keyFor(hooked.id) ? <Pause className="h-5 w-5 shrink-0" /> : <Play className="h-5 w-5 shrink-0" />}
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] uppercase tracking-widest text-muted-foreground">The pick</span>
                  <span className="block truncate">{hooked.name}</span>
                </span>
              </button>
            )}

            <div>
              <h3 className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Full album</h3>
              {!details && !failed && <p className="text-sm text-muted-foreground">Loading tracks…</p>}
              {failed && <p className="text-sm text-muted-foreground">Couldn't load the tracklist.</p>}
              <ol className="space-y-0.5">
                {details?.tracks.map((t, n) => {
                  const k = keyFor(t.id);
                  const isPlaying = player.playing === k;
                  const isPick = hooked?.id === t.id;
                  return (
                    <li key={t.id}>
                      <button disabled={!t.preview} onClick={() => player.play(k, t)}
                        className={`flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm transition disabled:cursor-default disabled:opacity-40 ${isPlaying ? "bg-muted" : "hover:bg-muted"}`}>
                        <span className="w-5 shrink-0 text-right text-xs text-muted-foreground">
                          {isPlaying ? <Pause className="ml-auto h-3.5 w-3.5 text-foreground" /> : n + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{t.name}</span>
                        {isPick && <Music2 className="h-3.5 w-3.5 shrink-0 text-primary" aria-label="The pick" />}
                      </button>
                    </li>
                  );
                })}
              </ol>
              {details && <p className="mt-2 text-[11px] text-muted-foreground">30-second previews from Apple Music.</p>}
            </div>

            <div>
              <h3 className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Listen to the whole thing</h3>
              <div className="grid grid-cols-2 gap-2">
                {links.map((l) => (
                  <a key={l.name} href={l.url} target="_blank" rel="noreferrer"
                    className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted">
                    {l.name}<ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
