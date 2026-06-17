"use client";
import { useEffect } from "react";

// Warm the browser cache for images that aren't on screen yet, so switching to
// another 안(variant) is instant. The active variant's <img> tags already fetch
// eagerly; this fills in the rest during idle time. Re-requesting an already
// fetched URL is a cache hit (no-op), so passing every URL is fine.
export function usePrefetchImages(urls: string[]) {
  // Join once so the effect only re-runs when the actual URL set changes,
  // not on every render that produces a new array reference.
  const key = urls.join("\n");
  useEffect(() => {
    if (urls.length === 0) return;
    const list = key.split("\n");
    const ric: (cb: () => void) => number =
      typeof window.requestIdleCallback === "function"
        ? (cb) => window.requestIdleCallback(cb)
        : (cb) => window.setTimeout(cb, 200);
    const cancel: (h: number) => void =
      typeof window.cancelIdleCallback === "function"
        ? (h) => window.cancelIdleCallback(h)
        : (h) => window.clearTimeout(h);

    const handle = ric(() => {
      for (const url of list) {
        const img = new Image();
        img.decoding = "async";
        img.src = url;
      }
    });
    return () => cancel(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` is the stable derived dep; `urls` recomputed from it
  }, [key]);
}
