"use client";
import { useCallback, useRef, useState } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import type { PreviewPage } from "@/legacy/lib/preview/types";
import type { PinContext } from "@/legacy/lib/pins/types";
import { CanvasCursorLayer, CanvasCursorCapture } from "@/legacy/components/realtime/canvas-cursors";
import { PinLayer } from "./pin-layer";
import { Button } from "@/shared/ui/button";

export function CanvasView({ pages, pin }: { pages: PreviewPage[]; pin?: PinContext }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"pan" | "comment">("pan");

  const applyInvScale = useCallback((scale: number) => {
    const el = contentRef.current;
    if (el && scale > 0) el.style.setProperty("--inv-scale", String(1 / scale));
  }, []);

  if (pages.length === 0) {
    return <div className="p-8 text-sm text-muted-foreground">페이지가 없습니다.</div>;
  }

  const commenting = !!pin && mode === "comment";

  return (
    <div ref={rootRef} className="relative h-full w-full bg-muted">
      {pin && (
        <div className="absolute left-3 top-3 z-10 flex gap-1 rounded-md border border-border bg-background/90 p-1 shadow-sm backdrop-blur">
          <Button size="sm" variant={mode === "pan" ? "default" : "outline"} className="h-7" onClick={() => setMode("pan")}>일반</Button>
          <Button size="sm" variant={mode === "comment" ? "default" : "outline"} className="h-7" onClick={() => setMode("comment")}>코멘트</Button>
        </div>
      )}
      <TransformWrapper
        minScale={0.1}
        maxScale={3}
        initialScale={0.2}
        centerOnInit
        limitToBounds={false}
        wheel={{ step: 0.001 }}
        panning={{ disabled: commenting }}
        onInit={(ref) => applyInvScale(ref.state.scale)}
        onTransform={(_ref, state) => applyInvScale(state.scale)}
      >
        <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }}>
          <div ref={contentRef} style={{ position: "relative", width: "max-content" }}>
            <div style={{ display: "flex", flexDirection: "row", flexWrap: "nowrap", alignItems: "flex-start", gap: "3rem", padding: "2rem", width: "max-content" }}>
              {pages.map((pg, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={pg.id} data-page-index={i} src={pg.url} alt="" width={pg.width} height={pg.height} draggable={false}
                  className="block max-w-none shrink-0 select-none border border-border bg-background" />
              ))}
            </div>
            <CanvasCursorLayer />
            {pin && <PinLayer contentRef={contentRef} pages={pages} pin={pin} mode={mode} />}
          </div>
        </TransformComponent>
        <CanvasCursorCapture rootRef={rootRef} contentRef={contentRef} />
      </TransformWrapper>
    </div>
  );
}
