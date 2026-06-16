"use client";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import type { PreviewPage } from "@/lib/preview/types";

export function CanvasView({ pages }: { pages: PreviewPage[] }) {
  if (pages.length === 0) {
    return <div className="p-8 text-sm text-muted-foreground">페이지가 없습니다.</div>;
  }
  return (
    <div className="h-full w-full bg-muted">
      <TransformWrapper
        minScale={0.1}
        maxScale={3}
        initialScale={0.2}
        centerOnInit
        limitToBounds={false}
        wheel={{ step: 0.001 }} // gentler zoom per wheel tick (default ~0.2 is too aggressive)
      >
        {/* wrapper fills the box; our own inner row controls the layout so we don't
            fight react-zoom-pan-pinch's content div (which defaults to flex-wrap: wrap). */}
        <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              flexWrap: "nowrap",
              alignItems: "flex-start",
              gap: "3rem",
              padding: "2rem",
              width: "max-content", // grow to fit all pages → single horizontal row, no wrap
            }}
          >
            {pages.map((pg) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={pg.id}
                src={pg.url}
                alt=""
                width={pg.width}
                height={pg.height}
                draggable={false}
                className="block max-w-none shrink-0 select-none border border-border bg-background"
              />
            ))}
          </div>
        </TransformComponent>
      </TransformWrapper>
    </div>
  );
}
