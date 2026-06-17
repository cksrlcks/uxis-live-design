"use client";
import { useEffect, useState } from "react";
import type { PreviewPage } from "@/legacy/lib/preview/types";
import { nextIndex, prevIndex } from "@/legacy/lib/preview/slide-nav";

export function FullscreenSlides({ pages }: { pages: PreviewPage[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") setIndex((i) => nextIndex(i, pages.length));
      else if (e.key === "ArrowLeft") setIndex((i) => prevIndex(i, pages.length));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pages.length]);

  if (pages.length === 0) {
    return <div className="p-8 text-sm text-muted-foreground">페이지가 없습니다.</div>;
  }

  const page = pages[index];
  return (
    <div className="relative h-full w-full bg-background">
      {/* key={page.id} remounts on change → scroll resets to top.
          overflow-y scroll (hidden scrollbar) for tall pages; overflow-x clipped
          (narrow screens crop the right edge — never scale down). Click = next. */}
      <div
        key={page.id}
        className="no-scrollbar h-full w-full overflow-x-hidden overflow-y-auto"
        onClick={() => setIndex((i) => nextIndex(i, pages.length))}
      >
        {/* max-w-none keeps the image at its native (1920px) width — no scaling */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={page.url} alt="" width={page.width} height={page.height} className="block max-w-none select-none" draggable={false} />
      </div>
      <div className="pointer-events-none absolute right-3 bottom-3 rounded bg-foreground/80 px-2 py-1 text-xs text-background">
        {index + 1}/{pages.length}
      </div>
    </div>
  );
}
