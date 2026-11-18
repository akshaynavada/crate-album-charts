import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";

/*
 * Finds a song on YouTube so a chart can be opened as a YouTube playlist.
 * Needs the YOUTUBE_API_KEY secret (a free Google Cloud key with the YouTube Data API enabled).
 * Each search costs 100 of the default 10,000 daily quota units, so the editor looks a song up once,
 * when the creator picks it, and the video id is saved with the chart. Visitors never trigger searches.
 *
 * This endpoint is public, so it is guarded against someone burning the quota in a loop:
 *  - answers are cached (in memory, and in Cloudflare's edge cache when available), so repeat lookups are free;
 *  - each visitor (by IP) gets PER_VISITOR searches per hour;
 *  - each server instance stops at DAILY_CAP searches per UTC day, leaving headroom for other instances.
 * Over a limit the answer is "unavailable", which the editor treats as "try again later".
 */

export type YouTubeMatch = { status: "found"; id: string } | { status: "none" } | { status: "unavailable" };

const PER_VISITOR = 30; // searches per visitor per hour
const VISITOR_WINDOW_MS = 60 * 60 * 1000;
const DAILY_CAP = 80; // searches per server instance per UTC day (the free quota is ~100)

const memoryCache = new Map<string, YouTubeMatch>();
const visitors = new Map<string, { count: number; resetAt: number }>();
let day = "";
let dayCount = 0;

const cacheKey = (artist: string, song: string) =>
  `${artist.toLowerCase().replace(/\s+/g, " ")}|${song.toLowerCase().replace(/\s+/g, " ")}`;
// Fake URL used only as a key for Cloudflare's edge cache.
const edgeUrl = (key: string) => `https://crate-cache.internal/yt?k=${encodeURIComponent(key)}`;
const edgeCache = (): Cache | undefined => (globalThis as { caches?: { default?: Cache } }).caches?.default;

async function cached(key: string): Promise<YouTubeMatch | undefined> {
  const hit = memoryCache.get(key);
  if (hit) return hit;
  try {
    const r = await edgeCache()?.match(edgeUrl(key));
    if (r) {
      const m = (await r.json()) as YouTubeMatch;
      memoryCache.set(key, m);
      return m;
    }
  } catch {}
  return undefined;
}

async function remember(key: string, m: YouTubeMatch) {
  if (memoryCache.size >= 5000) memoryCache.delete(memoryCache.keys().next().value!);
  memoryCache.set(key, m);
  try {
    await edgeCache()?.put(edgeUrl(key), new Response(JSON.stringify(m), {
      headers: { "content-type": "application/json", "cache-control": "public, max-age=2592000" }, // 30 days
    }));
  } catch {}
}

function visitorId(): string {
  try {
    return getRequestHeader("cf-connecting-ip") || getRequestIP({ xForwardedFor: true }) || "unknown";
  } catch {
    return "unknown";
  }
}

// Counts one search against the limits; false when a limit is reached.
function allowSearch(who: string): boolean {
  const now = Date.now();
  const today = new Date(now).toISOString().slice(0, 10);
  if (today !== day) { day = today; dayCount = 0; }
  if (dayCount >= DAILY_CAP) return false;
  let v = visitors.get(who);
  if (!v || now >= v.resetAt) {
    if (visitors.size >= 10000) for (const [k, x] of visitors) if (now >= x.resetAt) visitors.delete(k);
    v = { count: 0, resetAt: now + VISITOR_WINDOW_MS };
    visitors.set(who, v);
  }
  if (v.count >= PER_VISITOR) return false;
  v.count++;
  dayCount++;
  return true;
}

export const findYouTubeVideo = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ artist: z.string().trim().min(1).max(200), song: z.string().trim().min(1).max(300) }).parse(d))
  .handler(async ({ data }): Promise<YouTubeMatch> => {
    const key = process.env["YOUTUBE_API_KEY"];
    if (!key) return { status: "unavailable" };
    const ck = cacheKey(data.artist, data.song);
    const hit = await cached(ck);
    if (hit) return hit;
    if (!allowSearch(visitorId())) return { status: "unavailable" };
    const q = new URLSearchParams({
      part: "snippet", type: "video", maxResults: "5", videoCategoryId: "10", videoEmbeddable: "true",
      q: `${data.artist} ${data.song}`, key,
    });
    const r = await fetch(`https://www.googleapis.com/youtube/v3/search?${q}`).catch(() => null);
    if (!r || !r.ok) return { status: "unavailable" }; // includes running out of daily quota
    const j: any = await r.json();
    const items: any[] = j.items ?? [];
    let result: YouTubeMatch = { status: "none" };
    if (items.length) {
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
      const id = [...items].sort((a, b) => score(b) - score(a))[0]?.id?.videoId;
      if (typeof id === "string") result = { status: "found", id };
    }
    await remember(ck, result);
    return result;
  });
