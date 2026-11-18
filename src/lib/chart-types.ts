import type { CrateTheme } from "@/lib/theme";
/** `src` is unset for Apple (iTunes) albums, "deezer" for albums found through the Deezer fallback. */
export type MusicSource = "deezer";
export type Album = { id: number; name: string; artist: string; art: string; src?: MusicSource | undefined };
export type Track = { id: number | string; name: string; preview?: string | undefined; start: number; src?: MusicSource | undefined };
/** Creator-written extras for a pick. `fff` ("For Fans Of") is a comma-separated list of artists. */
export type PickDetails = { note?: string; genre?: string; fff?: string };
export type Cell = ({ album: Album; track?: Track | undefined } & PickDetails) | null;
export type ChartData = { title: string; cols: number; rows: number; showNames: boolean; cells: Cell[]; theme?: CrateTheme | undefined };
