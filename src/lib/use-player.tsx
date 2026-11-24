import { useCallback, useEffect, useRef, useState } from "react";
import type { BandcampRef, FullPlayer, MusicSource } from "@/lib/chart-types";
import { freshPreview, refreshPreviews } from "@/lib/deezer-previews";
import { freshStream, refreshStreams } from "@/lib/bandcamp-streams";

export type Playable = {
  id?: number | string | undefined; preview?: string | undefined; start?: number | undefined; src?: MusicSource | undefined;
  player?: FullPlayer | undefined; bc?: BandcampRef | undefined;
};

/** Bandcamp picks matched to a song stream the whole song. */
export const isBandcampStream = (t?: Playable | null) => !!t && t.player === "bandcamp" && !!t.bc?.track;

/** Whether a track has something to play (Deezer tracks can always fetch a fresh preview). */
export const canPlay = (t?: Playable | null) =>
  !!t && (!!t.preview || (t.src === "deezer" && typeof t.id === "number") || isBandcampStream(t));

/**
 * One <audio> element per page for 30s previews (Apple, Deezer) and whole Bandcamp songs. `play` toggles when called with the key that is
 * already playing. It resolves to false when the browser blocks sound (no click/tap on the page yet).
 */
export function usePlayer() {
  const [playing, setPlaying] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const playingRef = useRef<string | null>(null);
  playingRef.current = playing;

  useEffect(() => {
    const a = new Audio();
    a.onended = () => setPlaying(null);
    audio.current = a;
    return () => a.pause();
  }, []);

  const stop = useCallback(() => {
    audio.current?.pause();
    playingRef.current = null;
    setPlaying(null);
  }, []);

  // `peek`: a quick listen (hovering a cover) — whole songs start a third of the way in, past the intro.
  const play = useCallback(async (key: string, t: Playable, opts: { toggle?: boolean; peek?: boolean } = {}) => {
    const a = audio.current;
    if (!a || !canPlay(t)) return false;
    if (playingRef.current === key) {
      if (opts.toggle !== false) stop();
      return true;
    }
    a.pause();
    playingRef.current = key; // set now so the post-await check below sees it before React re-renders
    setPlaying(key);
    let url = t.preview;
    let whole = false;
    if (isBandcampStream(t)) {
      const id = t.bc!.track!;
      let s = freshStream(id);
      if (!s) { await refreshStreams([t.bc]).catch(() => {}); s = freshStream(id); }
      if (playingRef.current !== key) return true;
      if (s) { url = s; whole = true; }
    }
    if (!whole && t.src === "deezer" && typeof t.id === "number") {
      // Deezer links expire; refresh first if needed (usually already warmed when the chart loaded).
      url = freshPreview(t.id, t.preview) ?? undefined;
      if (!url) {
        await refreshPreviews([t.id]).catch(() => {});
        url = freshPreview(t.id) ?? undefined;
      }
      if (playingRef.current !== key) return true; // user moved on while we were fetching
      if (!url) { setPlaying(null); return false; }
    }
    if (!url) { setPlaying(null); return false; }
    a.src = url;
    const start = t.start ?? 0;
    a.onloadedmetadata = () => {
      if (whole) { if (opts.peek && a.duration > 60) a.currentTime = Math.round(a.duration / 3); return; }
      // Previews are 30s, so keep any saved start inside the clip.
      a.currentTime = Math.min(start, Math.max(0, (a.duration || 30) - 5));
    };
    try {
      await a.play();
      return true;
    } catch {
      if (playingRef.current === key) setPlaying(null);
      return false;
    }
  }, [stop]);

  return { playing, play, stop };
}
