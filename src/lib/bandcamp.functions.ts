import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/*
 * Bandcamp as a full-song source: the chart stores a release's link and ids, and Crate's own player streams
 * the song (the same 128 kbps stream Bandcamp's player uses; links are signed and last about a day, so they
 * are fetched fresh when a chart loads). Bandcamp has no public API, so this reads the same data its web
 * pages use:
 *  - the site search's autocomplete endpoint, to find an album by artist and title;
 *  - the release page's `data-tralbum` JSON, for the album id and its tracks.
 * Either can change without notice; when they do, lookups return null and the picker asks for a link.
 * Only *.bandcamp.com pages are fetched.
 */

export type BandcampRelease = {
  url: string; title: string; artist: string;
  /** Album id, when the release is (or belongs to) an album. */
  album?: number | undefined;
  /** Set when the link was a single track page. */
  track?: number | undefined;
  tracks: { id: number; title: string; stream?: string | undefined }[];
};

const UA = { "user-agent": "Mozilla/5.0 (compatible; CrateAlbumCharts/1.0)" };
const cache = new Map<string, { at: number; value: BandcampRelease | null }>();
const TTL = 60 * 60 * 1000; // stream links last ~24h; re-read pages hourly
const cached = (k: string) => { const c = cache.get(k); return c && Date.now() - c.at < TTL ? c : undefined; };
const remember = (k: string, value: BandcampRelease | null) => {
  if (cache.size > 2000) cache.delete(cache.keys().next().value!);
  cache.set(k, { at: Date.now(), value });
  return value;
};

const decode = (s: string) =>
  s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

const isBandcamp = (u: URL) => u.protocol === "https:" && (u.hostname === "bandcamp.com" || u.hostname.endsWith(".bandcamp.com"));

async function readRelease(raw: string): Promise<BandcampRelease | null> {
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  if (!isBandcamp(u) || !/^\/(album|track)\//.test(u.pathname)) return null;
  const url = `${u.origin}${u.pathname}`;
  const hit = cached(url);
  if (hit) return hit.value;
  const r = await fetch(url, { headers: UA, redirect: "follow" }).catch(() => null);
  if (!r || !r.ok) return null;
  const html = await r.text();
  const m = html.match(/data-tralbum="([^"]+)"/);
  let t: any;
  try { t = m ? JSON.parse(decode(m[1]!)) : null; } catch { t = null; }
  if (!t || typeof t.id !== "number") return null;
  const isTrack = t.item_type === "track" || t.item_type === "t";
  const release: BandcampRelease = {
    url,
    title: String(t.current?.title ?? ""),
    artist: String(t.artist ?? ""),
    album: isTrack ? (typeof t.current?.album_id === "number" ? t.current.album_id : undefined) : t.id,
    track: isTrack ? t.id : undefined,
    tracks: (t.trackinfo ?? []).flatMap((x: any) =>
      typeof x.track_id === "number" && x.track_id > 0
        ? [{ id: x.track_id, title: String(x.title ?? ""), stream: typeof x.file?.["mp3-128"] === "string" ? x.file["mp3-128"] : undefined }]
        : []),
  };
  return remember(url, release);
}

const norm = (s: string) =>
  s.toLowerCase().replace(/\s*[([].*?[)\]]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** Release details from a Bandcamp album or track link the creator pasted. */
export const getBandcampRelease = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ url: z.string().trim().url().max(500) }).parse(d))
  .handler(({ data }) => readRelease(data.url));

/** Looks an album up on Bandcamp by artist and title; null when there's no clear match. */
export const findBandcampAlbum = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ artist: z.string().trim().min(1).max(200), album: z.string().trim().min(1).max(300) }).parse(d))
  .handler(async ({ data }) => {
    const key = `find:${data.artist}|${data.album}`.toLowerCase();
    const hit = cached(key);
    if (hit) return hit.value;
    const r = await fetch("https://bandcamp.com/api/bcsearch_public_api/1/autocomplete_elastic", {
      method: "POST",
      headers: { ...UA, "content-type": "application/json" },
      body: JSON.stringify({ search_text: `${data.artist} ${data.album}`, search_filter: "a", full_page: false, fan_id: null }),
    }).catch(() => null);
    if (!r || !r.ok) return null;
    const j: any = await r.json().catch(() => null);
    const artist = norm(data.artist), album = norm(data.album);
    const match = (j?.auto?.results ?? []).find((x: any) => {
      if (x.type !== "a") return false;
      const a = norm(String(x.band_name ?? "")), n = norm(String(x.name ?? ""));
      return (a === artist || a.includes(artist) || artist.includes(a)) && (n === album || n.startsWith(album) || album.startsWith(n));
    });
    const found = match?.item_url_path ? await readRelease(String(match.item_url_path)) : null;
    return remember(key, found);
  });

/** Fresh stream links for saved Bandcamp picks, keyed by track id. */
export const getBandcampStreams = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ refs: z.array(z.object({ url: z.string().url().max(500), track: z.number().int().positive() })).max(100) }).parse(d))
  .handler(async ({ data }) => {
    const out: Record<string, string> = {};
    const byUrl = new Map<string, number[]>();
    for (const r of data.refs) byUrl.set(r.url, [...(byUrl.get(r.url) ?? []), r.track]);
    await Promise.all([...byUrl].map(async ([url, ids]) => {
      const rel = await readRelease(url).catch(() => null);
      for (const t of rel?.tracks ?? []) if (ids.includes(t.id) && t.stream) out[t.id] = t.stream;
    }));
    return out;
  });
