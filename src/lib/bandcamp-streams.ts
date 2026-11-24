import { getBandcampStreams } from "@/lib/bandcamp.functions";
import type { BandcampRef } from "@/lib/chart-types";

/*
 * Bandcamp stream links are signed (`ts=<unix seconds>` is when they expire, about a day out). Keep the
 * freshest link per track id and fetch new ones through the server when missing or about to expire.
 */
const fresh = new Map<number, string>();

const expiresAt = (url: string) => { try { return Number(new URL(url).searchParams.get("ts") ?? 0) * 1000; } catch { return 0; } };
const isFresh = (url?: string) => !!url && expiresAt(url) - Date.now() > 5 * 60_000;

export function rememberStreams(tracks: { id: number; stream?: string | undefined }[]) {
  for (const t of tracks) if (t.stream && isFresh(t.stream)) fresh.set(t.id, t.stream);
}

export function freshStream(track: number): string | null {
  const c = fresh.get(track);
  return isFresh(c) ? c! : null;
}

/** Fetches stream links for any of these picks that don't have a fresh one. */
export async function refreshStreams(refs: (BandcampRef | undefined)[]) {
  const need = refs.flatMap((r) => (r?.track && !isFresh(fresh.get(r.track)) ? [{ url: r.url, track: r.track }] : []));
  if (!need.length) return;
  const got = await getBandcampStreams({ data: { refs: need } });
  for (const [id, url] of Object.entries(got)) fresh.set(Number(id), url);
}
