import { useState } from "react";
import { Check, Copy, Mail } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/*
 * Private edit links bring a chart back on any device without an account: /#edit=<chart id>:<edit key>.
 * The key sits in the URL fragment, so it is never sent to the server in the page request or logged.
 */
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
export const editLinkFor = (origin: string, info: { id: string; token: string }) => `${origin}/#edit=${info.id}:${info.token}`;
export function readEditLink(hash: string): { id: string; token: string } | null {
  const m = new RegExp(`^#edit=(${UUID}):(${UUID})$`, "i").exec(hash);
  return m ? { id: m[1]!, token: m[2]! } : null;
}

export function EditLinkDialog({ open, onOpenChange, url }: { open: boolean; onOpenChange: (o: boolean) => void; url: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); } catch { return; }
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };
  const mail = `mailto:?subject=${encodeURIComponent("My Crate edit link")}&body=${encodeURIComponent(`Open this to keep editing my album chart:\n\n${url}`)}`;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-normal">Your chart is saved</DialogTitle>
          <DialogDescription>
            Every change saves automatically, and this browser will remember it. To keep editing on another device, or if this browser forgets it, open your private edit link.
          </DialogDescription>
        </DialogHeader>
        <input readOnly value={url} onFocus={(e) => e.target.select()} aria-label="Private edit link"
          className="w-full truncate rounded-lg border border-input bg-muted/50 px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-ring" />
        <div className="flex flex-wrap gap-2">
          <button onClick={copy} className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? "Copied" : "Copy link"}
          </button>
          <a href={mail} className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm hover:bg-muted"><Mail className="h-4 w-4" />Email it to myself</a>
        </div>
        <p className="text-xs text-muted-foreground">Keep it private: anyone with this link can change your chart. To share it for listening, use Share instead.</p>
      </DialogContent>
    </Dialog>
  );
}
