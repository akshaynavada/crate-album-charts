import type { CrateTheme } from "@/lib/theme";
/** `src` is unset for Apple (iTunes) albums, "deezer" for albums found through the Deezer fallback. */
export type MusicSource = "deezer";
export type Album = { id: number; name: string; artist: string; art: string; src?: MusicSource | undefined };
/** `yt` is the song's YouTube video id, looked up once when it's picked ("" = searched, nothing found). */
export type Track = { id: number | string; name: string; preview?: string | undefined; start: number; src?: MusicSource | undefined; yt?: string | undefined };
/** Creator-written extras for a pick. `fff` ("For Fans Of") is a comma-separated list of artists. */
export type PickDetails = { note?: string; genre?: string; fff?: string };
export type Cell = ({ album: Album; track?: Track | undefined } & PickDetails) | null;
/** `count` is how many albums the chart holds (charts made before it existed use cols × rows). */
export type ChartData = { title: string; cols: number; rows: number; count?: number | undefined; showNames: boolean; cells: Cell[]; theme?: CrateTheme | undefined };
export const chartCount = (d: Pick<ChartData, "cols" | "rows" | "count">) => d.count ?? d.cols * d.rows;
/** cols/rows are still saved for older readers; they no longer drive the layout. */
export const legacyGrid = (count: number) => { const cols = Math.min(10, count); return { cols, rows: Math.min(10, Math.ceil(count / cols)) }; };
