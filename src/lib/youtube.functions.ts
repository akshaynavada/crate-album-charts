import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/*
 * Finds a song on YouTube so a chart can be opened as a YouTube playlist.
 * Needs the YOUTUBE_API_KEY secret (a free Google Cloud key with the YouTube Data API enabled).
 * Each search costs 100 of the default 10,000 daily quota units, so the editor looks a song up once,
 * when the creator picks it, and the video id is saved with the chart. Visitors never trigger searches.
 */

export type YouTubeMatch = { status: "found"; id: string } | { status: "none" } | { status: "unavailable" };

export const findYouTubeVideo = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ artist: z.string().trim().min(1).max(200), song: z.string().trim().min(1).max(300) }).parse(d))
  .handler(async ({ data }): Promise<YouTubeMatch> => {
    const key = process.env["YOUTUBE_API_KEY"];
    if (!key) return { status: "unavailable" };
    const q = new URLSearchParams({
      part: "snippet", type: "video", maxResults: "5", videoCategoryId: "10", videoEmbeddable: "true",
      q: `${data.artist} ${data.song}`, key,
    });
    const r = await fetch(`https://www.googleapis.com/youtube/v3/search?${q}`).catch(() => null);
    if (!r || !r.ok) return { status: "unavailable" }; // includes running out of daily quota
    const j: any = await r.json();
    const items: any[] = j.items ?? [];
    if (!items.length) return { status: "none" };
    // Prefer the official upload: YouTube's auto-generated "Artist - Topic" channels, then VEVO / the artist's own channel.
    const artist = data.artist.toLowerCase();
    const score = (it: any) => {
      const ch = String(it.snippet?.channelTitle ?? "").toLowerCase();
      const title = String(it.snippet?.title ?? "").toLowerCase();
      let s = 0;
      if (ch.endsWith(" - topic")) s += 3;
      if (ch.includes("vevo") || ch.includes(artist)) s += 2;
      if (/\blive\b|cover|karaoke|instrumental|reaction|lyrics?\b/.test(title)) s -= 2;
      return s;
    };
    const best = [...items].sort((a, b) => score(b) - score(a))[0];
    const id = best?.id?.videoId;
    return typeof id === "string" ? { status: "found", id } : { status: "none" };
  });
