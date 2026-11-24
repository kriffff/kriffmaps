import { useEffect } from "react";

/**
 * Keeps the screen from dimming or sleeping while the page is visible (Screen
 * Wake Lock API, Firefox 126+ and Chromium). Browsers drop the lock whenever
 * the tab is hidden, so it is requested again each time the page comes back.
 * Silently does nothing where the API isn't available.
 */
export function useWakeLock() {
  useEffect(() => {
    const api = (
      navigator as Navigator & {
        wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> };
      }
    ).wakeLock;
    if (!api) return;
    let lock: { release: () => Promise<void> } | null = null;
    let disposed = false;

    const acquire = () => {
      if (document.visibilityState !== "visible" || disposed) return;
      api
        .request("screen")
        .then((l) => {
          if (disposed) void l.release().catch(() => undefined);
          else lock = l;
        })
        .catch(() => undefined);
    };

    acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", acquire);
      void lock?.release().catch(() => undefined);
    };
  }, []);
}
