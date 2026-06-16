"use client";
import { useRef } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import type { PreviewPage } from "@/lib/preview/types";
import { CanvasCursorLayer, CanvasCursorCapture } from "@/components/realtime/canvas-cursors";

export function CanvasView({ pages }: { pages: PreviewPage[] }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  if (pages.length === 0) {
    return <div className="p-8 text-sm text-muted-foreground">페이지가 없습니다.</div>;
  }

  // 안정적 부모(contentRef)에 --inv-scale = 1/scale 을 써서, 자손 커서 마커가
  // 줌과 무관하게 화면상 일정 크기를 유지하도록 한다(늦게 마운트된 커서도 즉시 상속).
  function applyInvScale(scale: number) {
    const el = contentRef.current;
    if (el && scale > 0) el.style.setProperty("--inv-scale", String(1 / scale));
  }

  return (
    <div ref={rootRef} className="h-full w-full bg-muted">
      <TransformWrapper
        minScale={0.1}
        maxScale={3}
        initialScale={0.2}
        centerOnInit
        limitToBounds={false}
        wheel={{ step: 0.001 }} // gentler zoom per wheel tick (default ~0.2 is too aggressive)
        onInit={(ref) => applyInvScale(ref.state.scale)}
        onTransform={(_ref, state) => applyInvScale(state.scale)}
      >
        {/* wrapper fills the box; our own inner row controls the layout so we don't
            fight react-zoom-pan-pinch's content div (which defaults to flex-wrap: wrap). */}
        <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }}>
          {/* relative 래퍼 = 콘텐츠 좌표 원점(좌상단). 커서 레이어가 이 박스를 덮는다. */}
          <div ref={contentRef} style={{ position: "relative", width: "max-content" }}>
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
            <CanvasCursorLayer />
          </div>
        </TransformComponent>
        <CanvasCursorCapture rootRef={rootRef} contentRef={contentRef} />
      </TransformWrapper>
    </div>
  );
}
