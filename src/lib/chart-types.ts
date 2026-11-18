import type { CrateTheme } from "@/lib/theme";
export type Album = { id: number; name: string; artist: string; art: string };
export type Track = { id: number | string; name: string; preview?: string | undefined; start: number };
/** Creator-written extras for a pick. `fff` ("For Fans Of") is a comma-separated list of artists. */
export type PickDetails = { note?: string; genre?: string; fff?: string };
export type Cell = ({ album: Album; track?: Track | undefined } & PickDetails) | null;
export type ChartData = { title: string; cols: number; rows: number; showNames: boolean; cells: Cell[]; theme?: CrateTheme | undefined };
