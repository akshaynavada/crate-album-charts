export type Album = { id: number; name: string; artist: string; art: string };
/**
 * A song hooked to an album. `preview` is Apple's 30s clip (always kept as a fallback when available).
 * `yt` is a YouTube video id; when set, playback uses the YouTube player starting at `start` seconds.
 */
export type Track = { id: number | string; name: string; preview?: string | undefined; start: number; yt?: string | undefined };
export type Cell = { album: Album; track?: Track | undefined; note?: string } | null;
export type ChartData = { title: string; cols: number; rows: number; showNames: boolean; cells: Cell[] };
