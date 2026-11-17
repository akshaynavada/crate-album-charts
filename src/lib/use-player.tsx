import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { Track } from "@/lib/chart-types";

declare global {
  interface Window { YT?: any; onYouTubeIframeAPIReady?: () => void }
}

let apiPromise: Promise<any> | null = null;
function loadYouTubeApi(): Promise<any> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!apiPromise) {
    apiPromise = new Promise((resolve) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(window.YT); };
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(s);
    });
  }
  return apiPromise;
}

export type Playable = Pick<Track, "name" | "preview" | "start" | "yt">;

/**
 * One player for the whole page: Apple previews go through an <audio> element, YouTube tracks through a
 * single IFrame player shown as a small docked mini-player (YouTube requires the player to stay visible).
 * Render `miniPlayer` once somewhere in the page.
 */
export function usePlayer() {
  const [playing, setPlaying] = useState<string | null>(null);
  const [current, setCurrent] = useState<Playable | null>(null);
  const [ytError, setYtError] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const yt = useRef<any>(null);
  const ytReady = useRef(false);
  const host = useRef<HTMLDivElement | null>(null);
  const playingRef = useRef<string | null>(null);
  const currentRef = useRef<Playable | null>(null);
  playingRef.current = playing;
  currentRef.current = current;

  useEffect(() => {
    audio.current = new Audio();
    audio.current.onended = () => setPlaying(null);
    let cancelled = false;
    loadYouTubeApi().then((YT) => {
      if (cancelled || !YT || !host.current) return;
      const el = document.createElement("div");
      host.current.appendChild(el);
      yt.current = new YT.Player(el, {
        width: "100%", height: "100%",
        playerVars: { playsinline: 1, rel: 0, modestbranding: 1 },
        events: {
          onReady: () => { ytReady.current = true; },
          onStateChange: (e: any) => { if (e.data === YT.PlayerState.ENDED) setPlaying(null); },
          onError: () => {
            // Video removed or embedding disabled: fall back to Apple's clip when we have one.
            const c = currentRef.current;
            if (c?.preview && audio.current) {
              setYtError("YouTube won't play this video here, so you're hearing Apple's 30s preview.");
              audio.current.src = c.preview;
              audio.current.play().catch(() => {});
            } else {
              setYtError("YouTube won't play this video here. Try picking a different one.");
            }
          },
        },
      });
    });
    return () => { cancelled = true; audio.current?.pause(); try { yt.current?.destroy(); } catch {} };
  }, []);

  const stop = useCallback(() => {
    audio.current?.pause();
    try { yt.current?.pauseVideo(); } catch {}
    setPlaying(null);
  }, []);

  const play = useCallback((key: string, t: Playable, startOverride?: number) => {
    if (playingRef.current === key) { stop(); return; }
    audio.current?.pause();
    try { yt.current?.pauseVideo(); } catch {}
    setYtError(null);
    const start = startOverride ?? t.start ?? 0;
    if (t.yt && yt.current && ytReady.current) {
      yt.current.loadVideoById({ videoId: t.yt, startSeconds: start });
      yt.current.playVideo?.();
    } else if (t.preview && audio.current) {
      const a = audio.current;
      a.src = t.preview;
      // Apple previews are 30s, so clamp the start into the clip.
      a.onloadedmetadata = () => { a.currentTime = Math.min(start, Math.max(0, (a.duration || 30) - 5)); };
      a.play().catch(() => {});
    } else if (t.yt) {
      setYtError("The YouTube player is still loading. Try again in a second.");
      return;
    } else return;
    setCurrent(t);
    setPlaying(key);
  }, [stop]);

  /** Current playback position of the YouTube player (for "set start here"). */
  const position = useCallback(() => {
    try { return yt.current?.getCurrentTime?.() ?? null; } catch { return null; }
  }, []);
  const duration = useCallback(() => {
    try { return yt.current?.getDuration?.() || null; } catch { return null; }
  }, []);

  const ytActive = !!(playing && current?.yt);
  const miniPlayer = (
    <div data-mini-player className={`fixed bottom-4 right-4 z-[60] w-[min(356px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-card shadow-2xl transition-all duration-300 ${ytActive ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-[120%] opacity-0"}`}>
      <div className="flex items-center gap-2 px-3 py-2 text-xs">
        <span className="flex h-3 items-end gap-0.5">
          {[0, 0.2, 0.4].map((d) => <span key={d} className="eq-bar h-full w-0.5 rounded bg-primary" style={{ animationDelay: `${d}s` }} />)}
        </span>
        <span className="min-w-0 flex-1 truncate">{current?.name}</span>
        <button onClick={stop} className="rounded-full p-1 hover:bg-muted" aria-label="Stop"><X className="h-3.5 w-3.5" /></button>
      </div>
      <div ref={host} className="aspect-video w-full bg-black [&>iframe]:h-full [&>iframe]:w-full" />
    </div>
  );
  const errorBanner = ytError ? (
    <div className="fixed bottom-4 left-4 z-[60] max-w-sm rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-xl">
      {ytError}
      <button onClick={() => setYtError(null)} className="ml-2 underline">OK</button>
    </div>
  ) : null;

  return { playing, play, stop, position, duration, ytActive, ui: <>{miniPlayer}{errorBanner}</> };
}
