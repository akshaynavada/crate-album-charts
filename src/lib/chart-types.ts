export type Album = { id: number; name: string; artist: string; art: string };
export type Track = { id: number | string; name: string; preview?: string | undefined; start: number };
export type Cell = { album: Album; track?: Track | undefined; note?: string } | null;
export type ChartData = { title: string; cols: number; rows: number; showNames: boolean; cells: Cell[] };
