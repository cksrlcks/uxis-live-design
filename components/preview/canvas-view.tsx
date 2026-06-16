"use client";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import type { PreviewPage } from "@/lib/preview/types";

export function CanvasView({ pages }: { pages: PreviewPage[] }) {
  if (pages.length === 0) {
    return <div className="p-8 text-sm text-muted-foreground">페이지가 없습니다.</div>;
  }
  return (
    <div className="h-full w-full bg-muted">
      <TransformWrapper minScale={0.1} maxScale={4} centerOnInit limitToBounds={false}>
        {/* Use inline-style props (not `!important` classes) to reliably override
            the library's own inline wrapper/content styles. */}
        <TransformComponent
          wrapperStyle={{ width: "100%", height: "100%" }}
          contentStyle={{ display: "flex", alignItems: "flex-start", gap: "2rem", padding: "2rem" }}
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
              className="block max-w-none select-none border border-border bg-background"
            />
          ))}
        </TransformComponent>
      </TransformWrapper>
    </div>
  );
}
