import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Album } from "@/lib/chart-types";
import type { AlbumDetails } from "@/lib/itunes";

/*
 * Deezer is the fallback catalog when Apple's album search misses something. Its API sends no CORS
 * headers, so the browser goes through these server functions. Deezer preview URLs are signed and expire
 * after ~15 minutes, so saved charts store track ids and fetch fresh previews when they're played.
 */

const API = "https://api.deezer.com";
const get = async (path: string) => {
  const r = await fetch(`${API}${path}`);
  if (!r.ok) throw new Error(`Deezer ${r.status}`);
  const j: any = await r.json();
  if (j?.error) throw new Error(j.error.message ?? "Deezer error");
  return j;
};

export const searchDeezerAlbums = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ q: z.string().trim().min(1).max(200) }).parse(d))
  .handler(async ({ data }): Promise<Album[]> => {
    const j = await get(`/search/album?q=${encodeURIComponent(data.q)}&limit=24`);
    return (j.data ?? [])
      .filter((a: any) => a.cover_xl)
      .map((a: any) => ({ id: a.id, name: a.title, artist: a.artist?.name ?? "", art: a.cover_xl, src: "deezer" as const }));
  });

export const getDeezerAlbum = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ id: z.number().int().positive() }).parse(d))
  .handler(async ({ data }): Promise<AlbumDetails & { deezerUrl: string }> => {
    const a = await get(`/album/${data.id}`);
    return {
      tracks: (a.tracks?.data ?? []).map((t: any, i: number) => ({
        id: t.id, name: t.title, preview: t.preview || undefined, number: i + 1, disc: 1,
      })),
      appleUrl: "",
      deezerUrl: a.link ?? `https://www.deezer.com/album/${data.id}`,
      year: a.release_date?.slice(0, 4),
      genre: a.genres?.data?.[0]?.name,
    };
  });

/** Fresh (signed) preview URLs for Deezer track ids. */
export const getDeezerPreviews = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ ids: z.array(z.number().int().positive()).max(100) }).parse(d))
  .handler(async ({ data }): Promise<Record<number, string>> => {
    const out: Record<number, string> = {};
    // Deezer allows ~50 requests / 5s; charts are at most 100 cells, so go in small batches.
    const ids = [...new Set(data.ids)];
    for (let i = 0; i < ids.length; i += 20) {
      await Promise.all(ids.slice(i, i + 20).map(async (id) => {
        try { const t = await get(`/track/${id}`); if (t.preview) out[id] = t.preview; } catch {}
      }));
    }
    return out;
  });

/** A few similar artists from Deezer, used to suggest "For fans of" (works for Apple albums too, matched by name). */
export const getRelatedArtists = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ artist: z.string().trim().min(1).max(200) }).parse(d))
  .handler(async ({ data }): Promise<string[]> => {
    const s = await get(`/search/artist?q=${encodeURIComponent(data.artist)}&limit=5`);
    const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, "");
    const hit = (s.data ?? []).find((a: any) => norm(a.name) === norm(data.artist)) ?? s.data?.[0];
    if (!hit) return [];
    const r = await get(`/artist/${hit.id}/related?limit=6`);
    return (r.data ?? []).map((a: any) => a.name as string).slice(0, 4);
  });
