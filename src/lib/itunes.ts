import type { Album } from "@/lib/chart-types";

export type AlbumTrack = { id: number; name: string; preview?: string | undefined; number: number; disc: number };
export type AlbumDetails = { tracks: AlbumTrack[]; appleUrl: string; year?: string | undefined };

const cache = new Map<number, Promise<AlbumDetails>>();

/** Looks up an album's tracklist and Apple Music link via the iTunes Lookup API (cached per page). */
export function fetchAlbum(id: number): Promise<AlbumDetails> {
  let p = cache.get(id);
  if (!p) {
    p = fetch(`https://itunes.apple.com/lookup?id=${id}&entity=song`)
      .then((r) => r.json())
      .then((j: any) => {
        const coll = j.results.find((x: any) => x.wrapperType === "collection");
        const tracks: AlbumTrack[] = j.results
          .filter((x: any) => x.wrapperType === "track")
          .map((x: any) => ({ id: x.trackId, name: x.trackName, preview: x.previewUrl, number: x.trackNumber, disc: x.discNumber }))
          .sort((a: AlbumTrack, b: AlbumTrack) => a.disc - b.disc || a.number - b.number);
        return {
          tracks,
          appleUrl: coll?.collectionViewUrl ?? `https://music.apple.com/album/${id}`,
          year: coll?.releaseDate?.slice(0, 4),
        };
      });
    p.catch(() => cache.delete(id));
    cache.set(id, p);
  }
  return p;
}

/** Search links for the album on other services (none of them offer a free album-id lookup). */
export function albumLinks(album: Album, appleUrl?: string) {
  const q = encodeURIComponent(`${album.artist} ${album.name}`);
  return [
    { name: "Apple Music", url: appleUrl ?? `https://music.apple.com/album/${album.id}` },
    { name: "Spotify", url: `https://open.spotify.com/search/${q}/albums` },
    { name: "YouTube", url: `https://www.youtube.com/results?search_query=${q}` },
    { name: "Bandcamp", url: `https://bandcamp.com/search?q=${q}&item_type=a` },
  ];
}
