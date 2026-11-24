import type { Album, MusicSource } from "@/lib/chart-types";
import { getDeezerAlbum, searchDeezerAlbums } from "@/lib/deezer.functions";
import { rememberPreviews } from "@/lib/deezer-previews";

export type AlbumTrack = {
  id: number; name: string; preview?: string | undefined; number: number; disc: number; src?: MusicSource | undefined;
};
export type AlbumDetails = {
  tracks: AlbumTrack[]; appleUrl: string; deezerUrl?: string | undefined; year?: string | undefined; genre?: string | undefined;
};

const cache = new Map<string, Promise<AlbumDetails>>();

/** Tracklist, links, year and genre for an album from whichever catalog it came from (cached per page). */
export function fetchAlbum(album: Pick<Album, "id" | "src">): Promise<AlbumDetails> {
  const key = `${album.src ?? "apple"}:${album.id}`;
  let p = cache.get(key);
  if (!p) {
    p = album.src === "deezer" ? fetchDeezer(album.id) : fetchApple(album.id);
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return p;
}

async function fetchDeezer(id: number): Promise<AlbumDetails> {
  const d = await getDeezerAlbum({ data: { id } });
  rememberPreviews(d.tracks);
  return { ...d, tracks: d.tracks.map((t) => ({ ...t, src: "deezer" as const })) };
}

async function fetchApple(id: number): Promise<AlbumDetails> {
  const j: any = await fetch(`https://itunes.apple.com/lookup?id=${id}&entity=song`).then((r) => r.json());
  const coll = j.results.find((x: any) => x.wrapperType === "collection");
  const tracks: AlbumTrack[] = j.results
    .filter((x: any) => x.wrapperType === "track")
    .map((x: any) => ({ id: x.trackId, name: x.trackName, preview: x.previewUrl, number: x.trackNumber, disc: x.discNumber }))
    .sort((a: AlbumTrack, b: AlbumTrack) => a.disc - b.disc || a.number - b.number);
  return {
    tracks,
    appleUrl: coll?.collectionViewUrl ?? `https://music.apple.com/album/${id}`,
    year: coll?.releaseDate?.slice(0, 4),
    genre: coll?.primaryGenreName,
  };
}

/** Lowercase, no "(Deluxe Edition)" / "- Single" style suffixes or punctuation, for matching titles across catalogs. */
export const normTitle = (s: string) =>
  s.toLowerCase().replace(/\s*[([].*?[)\]]/g, "").replace(/\s+-\s+(single|ep)$/, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

const matchCache = new Map<string, Promise<Pick<Album, "id" | "src"> | null>>();

/**
 * The same album in the other catalog (Apple Music or Deezer), so the creator can switch where a pick's
 * audio comes from. Matches on artist and title; null when the other catalog doesn't seem to have it.
 */
export function findAlbumOn(src: "apple" | "deezer", album: Pick<Album, "name" | "artist">): Promise<Pick<Album, "id" | "src"> | null> {
  const key = `${src}:${album.artist}:${album.name}`;
  let p = matchCache.get(key);
  if (!p) {
    p = (async () => {
      const q = `${album.artist} ${album.name}`;
      const found: Album[] = src === "deezer"
        ? await searchDeezerAlbums({ data: { q } })
        : ((await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=album&limit=25`).then((r) => r.json())).results ?? [])
            .map((a: any) => ({ id: a.collectionId, name: a.collectionName, artist: a.artistName, art: "" }));
      const artist = normTitle(album.artist), name = normTitle(album.name);
      const score = (a: Album) => {
        const an = normTitle(a.artist), n = normTitle(a.name);
        const artistOk = an === artist || an.includes(artist) || artist.includes(an);
        if (!artistOk) return 0;
        return n === name ? 3 : n.startsWith(name) || name.startsWith(n) ? 2 : 0;
      };
      const best = found.map((a) => ({ a, s: score(a) })).filter((x) => x.s > 0).sort((x, y) => y.s - x.s)[0]?.a;
      return best ? { id: best.id, ...(src === "deezer" ? { src: "deezer" as const } : {}) } : null;
    })();
    p.catch(() => matchCache.delete(key));
    matchCache.set(key, p);
  }
  return p;
}

/** Links to the album on other services (only Apple and Deezer have exact album pages; the rest are searches). */
export type LinkService = "Bandcamp" | "Apple Music" | "Spotify" | "YouTube" | "Deezer";
export function albumLinks(album: Album, details?: AlbumDetails | null): { name: LinkService; url: string }[] {
  const q = encodeURIComponent(`${album.artist} ${album.name}`);
  const apple = album.src === "deezer"
    ? `https://music.apple.com/us/search?term=${q}`
    : details?.appleUrl || `https://music.apple.com/album/${album.id}`;
  return [
    { name: "Bandcamp", url: `https://bandcamp.com/search?q=${q}` },
    { name: "Apple Music", url: apple },
    { name: "Spotify", url: `https://open.spotify.com/search/${q}/albums` },
    { name: "YouTube", url: `https://www.youtube.com/results?search_query=${q}` },
    ...(album.src === "deezer" ? [{ name: "Deezer" as const, url: details?.deezerUrl ?? `https://www.deezer.com/album/${album.id}` }] : []),
  ];
}

/** Splits a "For Fans Of" string into artist names. */
export const splitFff = (s?: string) => (s ?? "").split(",").map((x) => x.trim()).filter(Boolean);
