import { useState } from "react";
import { Check, Copy, Image as ImageIcon } from "lucide-react";
import type { Cell } from "@/lib/chart-types";
import { BrandIcon } from "@/components/BrandIcon";
import { ChartImageDialog } from "@/components/ChartImageDialog";
import { useCrateTheme } from "@/components/ThemeScope";

/** YouTube's no-sign-in playlist link takes up to 50 video ids. */
const YT_MAX = 50;

/**
 * "Take this chart with you": opens the picked songs as a YouTube playlist (no sign-in, temporary),
 * copies the tracklist as "Artist - Song" lines for playlist converters like TuneMyMusic, and makes
 * a shareable image of the chart.
 */
export function ListenBar({ cells, title, showList = true, link, imageButton = true }: {
  cells: Cell[]; title?: string; showList?: boolean; link?: string | undefined;
  /** The editor has its own "Share image" button next to Share. */
  imageButton?: boolean;
}) {
  const theme = useCrateTheme();
  const [copied, setCopied] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const picks = cells.flatMap((c) => (c?.track ? [{ artist: c.album.artist, song: c.track.name, yt: c.track.yt }] : []));
  if (!cells.some(Boolean) || (!imageButton && !picks.length)) return null;
  const ids = picks.flatMap((p) => (p.yt ? [p.yt] : [])).slice(0, YT_MAX);
  const ytUrl = `https://www.youtube.com/watch_videos?video_ids=${ids.join(",")}`;

  const copy = async () => {
    const text = [title?.trim(), ...picks.map((p) => `${p.artist} - ${p.song}`)].filter(Boolean).join("\n");
    try { await navigator.clipboard.writeText(text); } catch { return; }
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const pill = "flex items-center gap-2 rounded-full border border-border bg-card/70 px-4 py-2 text-sm hover:bg-muted";
  return (
    <div className="mt-10 flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm">
        <p className="font-medium">Take this chart with you</p>
        <p className="text-xs text-muted-foreground">
          {picks.length > 0 ? <>
            Want it on Spotify or Apple Music? Copy the tracklist and paste it into{" "}
            <a href="https://www.tunemymusic.com/transfer" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">TuneMyMusic</a>.
          </> : "Save it as an image to post anywhere."}
        </p>
      </div>
      <div className="flex flex-wrap gap-2 sm:shrink-0 sm:flex-nowrap">
        {imageButton && <button onClick={() => setImageOpen(true)} className={pill}><ImageIcon className="h-4 w-4" />Image</button>}
        {ids.length > 0 && (
          <a href={ytUrl} target="_blank" rel="noreferrer"
            title={ids.length < picks.length ? `${ids.length} of ${picks.length} songs found on YouTube` : "Opens as a temporary YouTube playlist"}
            className={pill}>
            <BrandIcon name="YouTube" />Play on YouTube{ids.length < picks.length && <span className="text-xs text-muted-foreground">({ids.length}/{picks.length})</span>}
          </a>
        )}
        {picks.length > 0 && (
          <button onClick={copy} className={pill}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? "Copied" : "Copy tracklist"}
          </button>
        )}
      </div>
      {imageButton && <ChartImageDialog open={imageOpen} onOpenChange={setImageOpen} cells={cells} title={title?.trim() ?? ""} theme={theme} showList={showList} link={link} />}
    </div>
  );
}
