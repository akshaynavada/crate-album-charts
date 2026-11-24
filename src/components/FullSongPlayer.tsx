import type { Track } from "@/lib/chart-types";

/** Pulls the video id out of any common YouTube link (watch, youtu.be, shorts, embed, music.youtube). */
export function youTubeId(input: string): string | null {
  const s = input.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  const m = s.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1]! : null;
}

/** YouTube picks play in YouTube's own (visible) player; Bandcamp picks stream through Crate's player. */
export const hasFullPlayer = (t?: Track | null) => !!t && t.player === "youtube" && !!t.yt;

/**
 * The whole song in YouTube's own embedded player (their terms require it to be visible). Autoplays when
 * asked, since it opens right after a click.
 */
export function FullSongPlayer({ track, autoplay = false }: { track: Track; autoplay?: boolean }) {
  if (track.player === "youtube" && track.yt) {
    return (
      <iframe key={track.yt} title={`${track.name} on YouTube`}
        src={`https://www.youtube-nocookie.com/embed/${track.yt}?rel=0&playsinline=1${autoplay ? "&autoplay=1" : ""}`}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen
        className="aspect-video w-full rounded-lg border-0 bg-black" />
    );
  }
  return null;
}
