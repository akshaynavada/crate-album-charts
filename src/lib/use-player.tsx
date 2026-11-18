import { useCallback, useEffect, useRef, useState } from "react";
import type { MusicSource } from "@/lib/chart-types";
import { freshPreview, refreshPreviews } from "@/lib/deezer-previews";

export type Playable = {
  id?: number | string | undefined; preview?: string | undefined; start?: number | undefined; src?: MusicSource | undefined;
};

/** Whether a track has something to play (Deezer tracks can always fetch a fresh preview). */
export const canPlay = (t?: Playable | null) => !!t && (!!t.preview || (t.src === "deezer" && typeof t.id === "number"));

/**
 * One <audio> element per page for Apple's 30s previews. `play` toggles when called with the key that is
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

  const play = useCallback(async (key: string, t: Playable, opts: { toggle?: boolean } = {}) => {
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
    if (t.src === "deezer" && typeof t.id === "number") {
      // Deezer links expire; refresh first if needed (usually already warmed when the chart loaded).
      url = freshPreview(t.id, t.preview) ?? undefined;
      if (!url) {
        await refreshPreviews([t.id]).catch(() => {});
        url = freshPreview(t.id) ?? undefined;
      }
      if (playingRef.current !== key) return true; // user moved on while we were fetching
      if (!url) { setPlaying(null); return false; }
    }
    a.src = url!;
    const start = t.start ?? 0;
    // Apple previews are 30s, so keep any saved start inside the clip.
    a.onloadedmetadata = () => { a.currentTime = Math.min(start, Math.max(0, (a.duration || 30) - 5)); };
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
