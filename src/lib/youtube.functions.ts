import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type YtVideo = { id: string; title: string; channel: string; thumb: string; duration?: number | undefined };

/** Parses ISO-8601 durations like PT4M13S into seconds. */
const isoSeconds = (d: string) => {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(d);
  return m ? (+(m[1] ?? 0)) * 3600 + (+(m[2] ?? 0)) * 60 + +(m[3] ?? 0) : undefined;
};

/**
 * Searches YouTube with the Data API. Needs the YOUTUBE_API_KEY secret (free key from Google Cloud).
 * Without a key it returns { enabled: false } and the UI falls back to pasting a link.
 */
export const searchYouTube = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ q: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }): Promise<{ enabled: boolean; videos: YtVideo[] }> => {
    const key = process.env["YOUTUBE_API_KEY"];
    if (!key) return { enabled: false, videos: [] };
    const s = new URLSearchParams({ part: "snippet", type: "video", videoEmbeddable: "true", maxResults: "5", q: data.q, key });
    const r = await fetch(`https://www.googleapis.com/youtube/v3/search?${s}`);
    if (!r.ok) return { enabled: true, videos: [] };
    const j: any = await r.json();
    const videos: YtVideo[] = (j.items ?? []).map((it: any) => ({
      id: it.id.videoId,
      title: decode(it.snippet.title),
      channel: decode(it.snippet.channelTitle),
      thumb: it.snippet.thumbnails?.medium?.url ?? it.snippet.thumbnails?.default?.url,
    }));
    if (videos.length) {
      const v = new URLSearchParams({ part: "contentDetails", id: videos.map((x) => x.id).join(","), key });
      const d: any = await fetch(`https://www.googleapis.com/youtube/v3/videos?${v}`).then((x) => x.json()).catch(() => null);
      for (const it of d?.items ?? []) {
        const vid = videos.find((x) => x.id === it.id);
        if (vid) vid.duration = isoSeconds(it.contentDetails.duration);
      }
    }
    return { enabled: true, videos };
  });

/** Looks up a pasted video's title via YouTube oEmbed (no key needed). */
export const youTubeInfo = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ id: z.string().regex(/^[\w-]{11}$/) }).parse(d))
  .handler(async ({ data }): Promise<YtVideo | null> => {
    const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${data.id}`)}`);
    if (!r.ok) return null;
    const j: any = await r.json();
    return { id: data.id, title: j.title, channel: j.author_name, thumb: j.thumbnail_url };
  });

const decode = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

/** Pulls an 11-char video id (and optional t= start) out of any common YouTube URL form. */
export function parseYouTube(input: string): { id: string; start?: number | undefined } | null {
  const s = input.trim();
  if (/^[\w-]{11}$/.test(s)) return { id: s };
  let u: URL;
  try { u = new URL(s.startsWith("http") ? s : `https://${s}`); } catch { return null; }
  const host = u.hostname.replace(/^www\.|^m\.|^music\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = u.pathname.slice(1, 12);
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    id = u.searchParams.get("v") ?? /^\/(?:shorts|embed|live|v)\/([\w-]{11})/.exec(u.pathname)?.[1] ?? null;
  }
  if (!id || !/^[\w-]{11}$/.test(id)) return null;
  const t = u.searchParams.get("t") ?? u.searchParams.get("start");
  let start: number | undefined;
  if (t) {
    const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/.exec(t);
    if (m) start = (+(m[1] ?? 0)) * 3600 + (+(m[2] ?? 0)) * 60 + +(m[3] ?? 0);
  }
  return { id, start };
}

export const fmt = (s: number) => {
  s = Math.max(0, Math.floor(s));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
};

/** Parses "1:14", "74", "1:02:03" into seconds. */
export const unfmt = (s: string) => {
  const parts = s.trim().split(":").map(Number);
  if (!parts.length || parts.some((n) => Number.isNaN(n) || n < 0)) return null;
  return parts.reduce((a, n) => a * 60 + n, 0);
};
