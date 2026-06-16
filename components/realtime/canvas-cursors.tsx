"use client";
import { useEffect, useRef } from "react";
import { useRealtimeOptional } from "./realtime-provider";
import { toContent } from "@/lib/realtime/coords";

// 원격 커서를 캔버스 transform 레이어 *안*에 그린다. 라이브러리가 각 뷰어의
// 줌/팬으로 자동 투영하므로 커서가 콘텐츠에 붙는다. 아이콘은 부모(contentRef)에
// 설정된 CSS 변수 --inv-scale 로 역보정해 화면상 크기를 일정하게 유지하며,
// transformOrigin 0 0 으로 커서 끝(hotspot)을 (cx,cy)에 고정한다.
export function CanvasCursorLayer() {
  const rt = useRealtimeOptional();
  if (!rt) return null;
  return (
    <div className="pointer-events-none absolute inset-0">
      {rt.cursors.map((c) => (
        <div
          key={c.id}
          className="absolute transition-[left,top] duration-75 ease-linear"
          style={{
            left: c.cx,
            top: c.cy,
            transform: "scale(var(--inv-scale, 5))",
            transformOrigin: "0 0",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none" style={{ color: c.color, display: "block" }}>
            <path d="M1 1l5 14 2-5 5-2L1 1z" fill="currentColor" stroke="white" strokeWidth="1" />
          </svg>
          <span
            className="ml-3 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
            style={{ backgroundColor: c.color }}
          >
            {c.name}
          </span>
        </div>
      ))}
    </div>
  );
}

// 캔버스 루트 위 포인터를 콘텐츠 좌표로 변환해 broadcast한다. 렌더는 없음.
// provider 밖(에디터 프리뷰)에서는 no-op.
export function CanvasCursorCapture({
  rootRef,
  contentRef,
}: {
  rootRef: React.RefObject<HTMLDivElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
}) {
  const rt = useRealtimeOptional();
  const sendCursor = rt?.sendCursor;
  const clearCursor = rt?.clearCursor;
  const frame = useRef<number | null>(null);
  const pending = useRef<{ cx: number; cy: number } | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !sendCursor || !clearCursor) return;
    const send = sendCursor;
    const clear = clearCursor;

    function onMove(e: PointerEvent) {
      const content = contentRef.current;
      if (!content) return;
      const rect = content.getBoundingClientRect();
      const ow = content.offsetWidth; // 레이아웃 폭(트랜스폼 미반영) → 현재 배율 = rect.width/ow
      if (ow <= 0) return;
      const scale = rect.width / ow;
      pending.current = toContent(e.clientX, e.clientY, rect, scale);
      if (frame.current == null) {
        frame.current = requestAnimationFrame(() => {
          frame.current = null;
          if (pending.current) send(pending.current.cx, pending.current.cy);
        });
      }
    }
    function onLeave() {
      clear();
    }

    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", onLeave);
    return () => {
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
      if (frame.current != null) cancelAnimationFrame(frame.current);
      clear();
    };
  }, [rootRef, contentRef, sendCursor, clearCursor]);

  return null;
}
