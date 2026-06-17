import { clamp01 } from "@/legacy/lib/realtime/coords";

export type PageBox = { left: number; top: number; width: number; height: number; pageOrder: number };
export type PinLocation = { pageOrder: number; xNorm: number; yNorm: number };

// 콘텐츠 좌표 (cx,cy)가 어떤 페이지 박스 안이면 그 페이지 기준 정규화 좌표를, 아니면 null.
export function locatePin(cx: number, cy: number, boxes: PageBox[]): PinLocation | null {
  for (const b of boxes) {
    if (b.width <= 0 || b.height <= 0) continue;
    if (cx >= b.left && cx <= b.left + b.width && cy >= b.top && cy <= b.top + b.height) {
      return {
        pageOrder: b.pageOrder,
        xNorm: clamp01((cx - b.left) / b.width),
        yNorm: clamp01((cy - b.top) / b.height),
      };
    }
  }
  return null;
}

// 정규화 좌표 → 박스 내 콘텐츠 좌표(placePin은 locatePin의 역).
export function placePin(box: PageBox, xNorm: number, yNorm: number): { x: number; y: number } {
  return { x: box.left + clamp01(xNorm) * box.width, y: box.top + clamp01(yNorm) * box.height };
}
