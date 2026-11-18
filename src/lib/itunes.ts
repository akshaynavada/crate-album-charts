import type { Album, MusicSource } from "@/lib/chart-types";
import { getDeezerAlbum } from "@/lib/deezer.functions";
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
