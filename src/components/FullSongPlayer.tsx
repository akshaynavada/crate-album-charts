import type { Track } from "@/lib/chart-types";
import { bandcampEmbedUrl } from "@/lib/bandcamp.functions";

/** Pulls the video id out of any common YouTube link (watch, youtu.be, shorts, embed, music.youtube). */
export function youTubeId(input: string): string | null {
  const s = input.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  const m = s.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1]! : null;
}

export const hasFullPlayer = (t?: Track | null) =>
  !!t && ((t.player === "youtube" && !!t.yt) || (t.player === "bandcamp" && !!(t.bc?.album || t.bc?.track)));

/**
 * The whole song, through the service's own embedded player (their terms require the player to be
 * visible). YouTube autoplays when asked, since it opens right after a click; Bandcamp's embed waits
 * for its play button.
 */
export function FullSongPlayer({ track, colors, autoplay = false }: {
  track: Track; colors: { bg: string; link: string }; autoplay?: boolean;
}) {
  if (track.player === "youtube" && track.yt) {
    return (
      <iframe key={track.yt} title={`${track.name} on YouTube`}
        src={`https://www.youtube-nocookie.com/embed/${track.yt}?rel=0&playsinline=1${autoplay ? "&autoplay=1" : ""}`}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen
        className="aspect-video w-full rounded-lg border-0 bg-black" />
    );
  }
  if (track.player === "bandcamp" && track.bc && (track.bc.album || track.bc.track)) {
    return (
      <iframe key={`${track.bc.album}-${track.bc.track}`} title={`${track.name} on Bandcamp`}
        src={bandcampEmbedUrl(track.bc, colors)} seamless
        className="h-[120px] w-full rounded-lg border border-border" />
    );
  }
  return null;
}
