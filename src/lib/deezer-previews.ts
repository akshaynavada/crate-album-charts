import { getDeezerPreviews } from "@/lib/deezer.functions";

/*
 * Deezer preview URLs are signed with an expiry (`hdnea=exp=<unix seconds>`, ~15 minutes). Keep the freshest
 * URL per track id and refresh through the server when one is missing or about to expire.
 */
const fresh = new Map<number, string>();

const expiresAt = (url: string) => Number(/exp=(\d+)/.exec(url)?.[1] ?? 0) * 1000;
const isFresh = (url?: string) => !!url && expiresAt(url) - Date.now() > 60_000;

export function rememberPreviews(tracks: { id: number; preview?: string | undefined }[]) {
  for (const t of tracks) if (t.preview && isFresh(t.preview)) fresh.set(t.id, t.preview);
}

/** A playable URL right now, or null if it needs a refresh first. */
export function freshPreview(id: number, stored?: string) {
  const c = fresh.get(id);
  if (isFresh(c)) return c!;
  return isFresh(stored) ? stored! : null;
}

/** Fetches fresh previews for any of these ids that don't have one. */
export async function refreshPreviews(ids: number[]) {
  const need = [...new Set(ids)].filter((id) => !isFresh(fresh.get(id)));
  if (!need.length) return;
  const got = await getDeezerPreviews({ data: { ids: need } });
  for (const [id, url] of Object.entries(got)) fresh.set(Number(id), url);
}
