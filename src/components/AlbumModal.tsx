import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, Music2, Pause, Play } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Cell } from "@/lib/chart-types";
import { albumLinks, fetchAlbum, splitFff, type AlbumDetails } from "@/lib/itunes";
import { canPlay, type usePlayer } from "@/lib/use-player";
import { FullSongPlayer, hasFullPlayer } from "@/components/FullSongPlayer";
import { useCrateTheme } from "@/components/ThemeScope";
import { BrandIcon } from "@/components/BrandIcon";

/** Shared-view album detail: the creator's note, every track's preview, and links out to streaming stores. */
export function AlbumModal({ cell, index, onClose, player, position, onPrev, onNext }: {
  cell: Cell; index: number | null; onClose: () => void; player: ReturnType<typeof usePlayer>;
  /** Where this pick sits among the chart's albums, for "3 of 8" and next / previous. */
  position?: { at: number; of: number } | null; onPrev?: (() => void) | undefined; onNext?: (() => void) | undefined;
}) {
  const theme = useCrateTheme();
  const [details, setDetails] = useState<AlbumDetails | null>(null);
  const [failed, setFailed] = useState(false);
  const open = index !== null && !!cell;

  useEffect(() => {
    if (!cell) return;
    setDetails(null); setFailed(false);
    fetchAlbum(cell.album).then(setDetails).catch(() => setFailed(true));
  }, [cell?.album.id]);

  // Arrow keys (desktop) and left / right swipes (phones) move between picks.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowRight" && onNext) { e.preventDefault(); setEnterFrom("right"); onNext(); }
      if (e.key === "ArrowLeft" && onPrev) { e.preventDefault(); setEnterFrom("left"); onPrev(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onPrev, onNext]);
  // Swiping: the album follows the finger (with resistance at the first / last pick), then slides to the
  // next one or springs back. The new album slides in from the side it came from.
  const touch = useRef<{ x: number; y: number; horizontal: boolean | null } | null>(null);
  const [dragX, setDragX] = useState(0);
  const [enterFrom, setEnterFrom] = useState<"left" | "right" | null>(null);
  const go = (dir: 1 | -1) => {
    const fn = dir === 1 ? onNext : onPrev;
    if (!fn) return;
    setEnterFrom(dir === 1 ? "right" : "left");
    fn();
  };
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touch.current = t && e.touches.length === 1 ? { x: t.clientX, y: t.clientY, horizontal: null } : null;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const s = touch.current, t = e.touches[0];
    if (!s || !t) return;
    const dx = t.clientX - s.x, dy = t.clientY - s.y;
    if (s.horizontal === null && Math.hypot(dx, dy) > 10) s.horizontal = Math.abs(dx) > Math.abs(dy) * 1.2;
    if (!s.horizontal) return;
    const blocked = dx < 0 ? !onNext : !onPrev;
    setDragX(blocked ? dx * 0.25 : dx);
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touch.current, t = e.changedTouches[0];
    touch.current = null;
    setDragX(0);
    if (!s?.horizontal || !t) return;
    const dx = t.clientX - s.x;
    if (Math.abs(dx) < 60) return;
    go(dx < 0 ? 1 : -1);
  };

  useEffect(() => { if (!open) setEnterFrom(null); }, [open]);

  // First time on a phone: nudge the album sideways once and say it can be swiped.
  const [showHint, setShowHint] = useState(false);
  const many = !!position && position.of > 1;
  useEffect(() => {
    if (!open || !many || !window.matchMedia("(hover: none)").matches) return;
    let seen = false;
    try { seen = localStorage.getItem("crate-swipe-hint") === "1"; localStorage.setItem("crate-swipe-hint", "1"); } catch {}
    if (seen) return;
    setShowHint(true);
    const t = setTimeout(() => setShowHint(false), 3200);
    return () => clearTimeout(t);
  }, [open, many]);

  if (!cell) return null;
  const hooked = cell.track;
  // The hooked song shares the grid cell's key so a clip started by hovering keeps playing in here.
  const keyFor = (id: number | string) => (hooked && id === hooked.id ? `cell-${index}` : `trk-${id}`);
  const links = albumLinks(cell.album, details);
  const fff = splitFff(cell.fff);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      {/* Desktop: square art on the left sized to the dialog height, details scroll on the right. */}
      {/* Dialogs portal out of the themed wrapper, so re-apply the crate theme here. */}
      <DialogContent {...theme.attrs} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={() => { touch.current = null; setDragX(0); }} style={{ ...theme.style, ["--h" as string]: "min(86vh, 780px, 56vw)" }}
        className="font-sans text-foreground max-h-[92vh] max-sm:top-[calc(50%-1.75rem)] max-sm:max-h-[calc(100dvh-8rem)] max-w-[calc(var(--h)+400px)] lg:max-w-[calc(var(--h)+460px)] gap-0 overflow-y-auto p-0 md:overflow-hidden [&>button:last-child]:rounded-full [&>button:last-child]:bg-background/70 [&>button:last-child]:p-1.5">
        <div key={cell.album.id + ":" + index}
          className={`grid touch-pan-y md:h-[var(--h)] md:grid-cols-[var(--h)_minmax(0,1fr)] ${dragX ? "" : "transition-transform duration-200"} ${enterFrom === "right" ? "animate-in fade-in slide-in-from-right-12 duration-200" : enterFrom === "left" ? "animate-in fade-in slide-in-from-left-12 duration-200" : ""} ${showHint ? "crate-swipe-nudge" : ""}`}
          style={dragX ? { transform: `translateX(${dragX}px)`, opacity: Math.max(0.4, 1 - Math.abs(dragX) / 500) } : undefined}>
          <div className="relative">
            <img src={cell.album.art} alt={`${cell.album.name} by ${cell.album.artist}`} className="aspect-square w-full object-cover sm:rounded-t-lg md:h-full md:rounded-l-lg md:rounded-tr-none" />
            {many && (
              <>
                {/* Big arrows on the cover: tap targets on phones, and a visual cue that there's more to swipe through. */}
                {onPrev && (
                  <button onClick={() => go(-1)} aria-label="Previous pick"
                    className="absolute left-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-black/60"><ChevronLeft className="h-6 w-6" /></button>
                )}
                {onNext && (
                  <button onClick={() => go(1)} aria-label="Next pick"
                    className="absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-black/60"><ChevronRight className="h-6 w-6" /></button>
                )}
                {/* Page dots (or "3 / 25" for long charts). */}
                <div className="absolute inset-x-0 bottom-2 flex justify-center">
                  {position!.of <= 15 ? (
                    <div className="flex gap-1.5 rounded-full bg-black/40 px-2 py-1.5 backdrop-blur-sm">
                      {Array.from({ length: position!.of }, (_, k) => (
                        <span key={k} className={`h-1.5 rounded-full transition-all ${k + 1 === position!.at ? "w-4 bg-white" : "w-1.5 bg-white/50"}`} />
                      ))}
                    </div>
                  ) : (
                    <span className="rounded-full bg-black/40 px-2.5 py-0.5 text-xs text-white backdrop-blur-sm">{position!.at} / {position!.of}</span>
                  )}
                </div>
                {showHint && (
                  <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
                    <span className="flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1.5 text-xs font-medium text-white">
                      <ChevronLeft className="h-3.5 w-3.5" />Swipe for the next pick<ChevronRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-5 p-5 md:overflow-y-auto md:p-6">
            <DialogHeader className="space-y-1 text-left">
              {index !== null && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  {position && position.of > 1 && (
                    <button onClick={() => go(-1)} disabled={!onPrev} aria-label="Previous" title="Previous (←)"
                      className="-ml-1.5 grid h-8 w-8 place-items-center rounded-full hover:bg-muted hover:text-foreground disabled:opacity-30"><ChevronLeft className="h-5 w-5" /></button>
                  )}
                  <span className="font-display text-lg">No. {index + 1}</span>
                  {position && position.of > 1 && (
                    <>
                      <button onClick={() => go(1)} disabled={!onNext} aria-label="Next" title="Next (→)"
                        className="grid h-8 w-8 place-items-center rounded-full hover:bg-muted hover:text-foreground disabled:opacity-30"><ChevronRight className="h-5 w-5" /></button>
                      <span className="ml-1 text-xs">{position.at} of {position.of}</span>
                    </>
                  )}
                </div>
              )}
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

            {hooked && hasFullPlayer(hooked) && (
              <div>
                <h3 className="mb-2 flex items-baseline justify-between gap-2 text-xs uppercase tracking-widest text-muted-foreground">
                  The pick<span className="truncate normal-case tracking-normal text-foreground">{hooked.name}</span>
                </h3>
                <FullSongPlayer track={hooked} autoplay />
              </div>
            )}

            {hooked && !hasFullPlayer(hooked) && canPlay(hooked) && (
              <button onClick={() => player.play(keyFor(hooked.id), hooked)}
                className="flex items-center gap-3 rounded-lg bg-accent px-3 py-2.5 text-left text-sm hover:bg-accent/80">
                {player.playing === keyFor(hooked.id) ? <Pause className="h-5 w-5 shrink-0" /> : <Play className="h-5 w-5 shrink-0" />}
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] uppercase tracking-widest text-muted-foreground">The pick{hooked.player === "bandcamp" && hooked.bc?.track ? " · whole song from Bandcamp" : ""}</span>
                  <span className="block truncate">{hooked.name}</span>
                </span>
              </button>
            )}

            <div>
              <h3 className="mb-2 flex items-center justify-between text-xs uppercase tracking-widest text-muted-foreground">
                Full album
                <span className="flex items-center gap-1 normal-case tracking-normal">
                  <BrandIcon name={cell.album.src === "deezer" ? "Deezer" : "Apple Music"} className="h-3 w-3" />
                  {cell.album.src === "deezer" ? "Deezer" : "Apple Music"}
                </span>
              </h3>
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
              {details && <p className="mt-2 text-[11px] text-muted-foreground">30-second previews.</p>}
            </div>

            <div>
              <h3 className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Listen to the whole thing</h3>
              <div className="grid grid-cols-2 gap-2">
                {links.map((l) => (
                  <a key={l.name} href={l.url} target="_blank" rel="noreferrer"
                    className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted">
                    <span className="flex items-center gap-2"><BrandIcon name={l.name} />{l.name}</span><ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
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
