"use client";
import { useEffect, useRef } from "react";
import { useQueryState } from "nuqs";
import { useRealtime } from "./realtime-provider";

export function CursorOverlay() {
  const { cursors, sendCursor, clearCursor } = useRealtime();
  // Cursors are only meaningful in the canvas (pan/zoom) view → ?view=canvas.
  const [view] = useQueryState("view");
  const active = view === "canvas";
  const frame = useRef<number | null>(null);
  const pending = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!active) {
      clearCursor();
      return;
    }
    function onMove(e: PointerEvent) {
      pending.current = { x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight };
      if (frame.current == null) {
        frame.current = requestAnimationFrame(() => {
          frame.current = null;
          if (pending.current) sendCursor(pending.current.x, pending.current.y);
        });
      }
    }
    function onLeave() { clearCursor(); }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("blur", onLeave);
    document.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("blur", onLeave);
      document.removeEventListener("pointerleave", onLeave);
      if (frame.current != null) cancelAnimationFrame(frame.current);
      clearCursor();
    };
  }, [active, sendCursor, clearCursor]);

  if (!active) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      {cursors.map((c) => (
        <div key={c.id} className="absolute -translate-y-1 translate-x-0 transition-[left,top] duration-75 ease-linear"
          style={{ left: `${c.xNorm * 100}%`, top: `${c.yNorm * 100}%` }}>
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none" style={{ color: c.color }}>
            <path d="M1 1l5 14 2-5 5-2L1 1z" fill="currentColor" stroke="white" strokeWidth="1" />
          </svg>
          <span className="ml-3 rounded px-1.5 py-0.5 text-[10px] font-medium text-white" style={{ backgroundColor: c.color }}>
            {c.name}
          </span>
        </div>
      ))}
    </div>
  );
}
