import { useEffect, useRef } from "react";

/**
 * Lets the browser Back button (and Android's back gesture) close a window or pane instead of leaving the page.
 * While `open`, an extra history entry is added. Back removes it and calls `onClose`. Closing any other way
 * removes the entry too, so history stays clean. If `onClose` doesn't actually close (e.g. it asks
 * "Discard changes?" first), the entry is put back so the next Back still lands here.
 */
export function useBackToClose(open: boolean, onClose: () => void) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const openRef = useRef(open);
  openRef.current = open;
  useEffect(() => {
    if (!open) return;
    let pushed = true;
    history.pushState({ ...history.state, crateOverlay: true }, "");
    const onPop = () => {
      if (!pushed) return;
      pushed = false;
      closeRef.current();
      setTimeout(() => {
        if (openRef.current && !pushed) { history.pushState({ ...history.state, crateOverlay: true }, ""); pushed = true; }
      }, 0);
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      if (pushed) history.back();
    };
  }, [open]);
}
