import { useEffect, useState } from "react";
import { Check, Copy, Download, Loader2, Share2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Cell } from "@/lib/chart-types";
import type { ResolvedTheme } from "@/lib/theme";
import { canvasBlob, imageFileName, renderChartImage } from "@/lib/chart-image";
import { useBackToClose } from "@/lib/use-back-to-close";

type Made = { canvas: HTMLCanvasElement; file: File; url: string };

/**
 * Makes an image of the chart when opened, then offers it to share (phones: straight to Instagram,
 * Messages and so on), download, or copy. The image is made first because the share sheet only opens
 * straight after a tap, not after waiting for covers to load.
 */
export function ChartImageDialog({ open, onOpenChange, cells, title, theme, showList, link }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  cells: Cell[]; title: string; theme: ResolvedTheme; showList: boolean; link?: string | undefined;
}) {
  const [made, setMade] = useState<Made | null>(null);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  useBackToClose(open, () => onOpenChange(false));

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let url = "";
    setMade(null); setFailed(false); setCopied(false);
    (async () => {
      try {
        const canvas = await renderChartImage({ cells, title, theme, showList, link: fullLink() });
        const blob = await canvasBlob(canvas, "image/jpeg");
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setMade({ canvas, url, file: new File([blob], imageFileName(title), { type: "image/jpeg" }) });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
    // Made once per opening; edits while it's open don't redraw it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // `link` is a path ("/c/<id>"); the image shows the full address.
  const fullLink = () => (link ? new URL(link, window.location.origin).href : undefined);
  const canShare = !!made && typeof navigator !== "undefined" && !!navigator.canShare?.({ files: [made.file] });
  const canCopy = typeof window !== "undefined" && "ClipboardItem" in window;

  const share = async () => {
    if (!made) return;
    try { await navigator.share({ files: [made.file], title: title || "My album chart", ...(link ? { text: fullLink()! } : {}) }); } catch {}
  };
  const download = () => {
    if (!made) return;
    const a = document.createElement("a");
    a.href = made.url; a.download = made.file.name;
    document.body.appendChild(a); a.click(); a.remove();
  };
  const copy = async () => {
    if (!made) return;
    try {
      // Clipboards take PNG only; pass the promise straight in so Safari keeps the click's permission.
      await navigator.clipboard.write([new ClipboardItem({ "image/png": canvasBlob(made.canvas, "image/png") })]);
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const btn = "flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm disabled:opacity-50";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-sm:top-[calc(50%-1.75rem)] max-sm:max-h-[calc(100dvh-8rem)] max-sm:overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Chart image</DialogTitle>
          <DialogDescription>Post it anywhere. The link at the bottom brings people back to listen.</DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[55vh] min-h-40 place-items-center overflow-hidden rounded-lg border border-border bg-muted/40">
          {made ? <img src={made.url} alt="Preview of the chart image" className="max-h-[55vh] w-auto object-contain" />
            : failed ? <p className="p-6 text-center text-sm text-muted-foreground">Couldn't make the image. Try again in a moment.</p>
            : <p className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Making your image…</p>}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {canCopy && (
            <button onClick={copy} disabled={!made} className={`${btn} border border-border hover:bg-muted max-sm:hidden`}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? "Copied" : "Copy"}
            </button>
          )}
          <button onClick={download} disabled={!made} className={`${btn} ${canShare ? "border border-border hover:bg-muted" : "bg-primary text-primary-foreground hover:bg-primary/90"}`}>
            <Download className="h-4 w-4" />Download
          </button>
          {canShare && (
            <button onClick={share} className={`${btn} bg-primary text-primary-foreground hover:bg-primary/90`}>
              <Share2 className="h-4 w-4" />Share
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
