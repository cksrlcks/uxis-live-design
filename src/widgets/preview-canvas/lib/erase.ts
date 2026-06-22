// 벡터 스트로크용 "진짜 지우개" 지오메트리.
// 지우개가 지나간 경로(콘텐츠 좌표)에서 stroke를 잘라 살아남은 연속 구간만 세그먼트로 반환한다.
// stroke 전체가 아니라 문지른 부분만 사라진다.

import { MAX_STROKE_POINTS } from "@/entities/whiteboard";

export type Pt = { x: number; y: number };
type Box = { left: number; top: number; width: number; height: number };
export type BBox = { minX: number; minY: number; maxX: number; maxY: number };

// densify 상한 — 아주 긴 stroke에서도 판정 점 수를 제한한다.
const MAX_DENSE = 6000;

// 점 (px,py)와 선분 a-b 사이 최단 거리의 제곱. 지우개를 폴리라인으로 보고 점-선분으로 판정해
// 포인터 이벤트가 듬성해도(빠른 드래그) 새지 않는다.
function distSqToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  const ex = px - cx;
  const ey = py - cy;
  return ex * ex + ey * ey;
}

// 지우개 경로의 경계상자(반경만큼 팽창). 멀리 있는 stroke를 싸게 걸러내는 데 쓴다.
export function eraserBBox(eraser: Pt[], radius: number): BBox | null {
  if (eraser.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of eraser) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX: minX - radius, minY: minY - radius, maxX: maxX + radius, maxY: maxY + radius };
}

// stroke(정규화)를 콘텐츠 좌표로 본 경계상자가 bb와 겹치는지. 안 겹치면 지울 게 없다(스킵).
export function strokeIntersectsBBox(points: Pt[], box: Box, bb: BBox | null): boolean {
  if (!bb || box.width <= 0 || box.height <= 0) return false;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    const cx = box.left + p.x * box.width;
    const cy = box.top + p.y * box.height;
    if (cx < minX) minX = cx;
    if (cy < minY) minY = cy;
    if (cx > maxX) maxX = cx;
    if (cy > maxY) maxY = cy;
  }
  return !(maxX < bb.minX || minX > bb.maxX || maxY < bb.minY || minY > bb.maxY);
}

// 점 수가 max를 넘으면 양 끝을 유지하며 균등 샘플링으로 줄인다(스키마 MAX_STROKE_POINTS 보장).
function decimate(pts: Pt[], max: number): Pt[] {
  if (pts.length <= max) return pts;
  const out: Pt[] = [];
  const stride = (pts.length - 1) / (max - 1);
  for (let i = 0; i < max; i++) out.push(pts[Math.round(i * stride)]);
  return out;
}

// 정규화 stroke 점들(box 기준)을 지우개 경로(콘텐츠 좌표)로 잘라 살아남은 세그먼트들을
// "정규화 점 배열"로 반환.
// - 변화가 없으면 입력 배열을 그대로 담은 [points](참조 동일)를 반환 → 호출부가 미변경을 판정.
// - stroke가 통째로 지워지면 [] 반환.
// 핵심: stroke도 콘텐츠 px ~radius/2 간격으로 densify한 뒤 판정 → 점 간격이 넓은 선의
// "가운데를 지나가도" 정확히 끊긴다(꼭짓점만 보던 버그 해결).
export function eraseStrokePoints(points: Pt[], box: Box, eraser: Pt[], radius: number): Pt[][] {
  if (eraser.length === 0 || box.width <= 0 || box.height <= 0 || points.length < 2) return [points];
  const r2 = radius * radius;

  const toC = (p: Pt): Pt => ({ x: box.left + p.x * box.width, y: box.top + p.y * box.height });

  // 콘텐츠 총 길이로 densify 간격 결정(점 폭주 방지: 대략 MAX_DENSE개 이하).
  let totalLen = 0;
  let prev = toC(points[0]);
  for (let i = 1; i < points.length; i++) {
    const c = toC(points[i]);
    totalLen += Math.hypot(c.x - prev.x, c.y - prev.y);
    prev = c;
  }
  const step = Math.max(radius / 2, totalLen / MAX_DENSE, 0.5);

  // densify(콘텐츠 좌표).
  const dense: Pt[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = toC(points[i]);
    dense.push(a);
    if (i < points.length - 1) {
      const b = toC(points[i + 1]);
      const segLen = Math.hypot(b.x - a.x, b.y - a.y);
      const n = Math.floor(segLen / step);
      for (let k = 1; k <= n; k++) {
        const t = (k * step) / segLen;
        if (t >= 1) break;
        dense.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      }
    }
  }

  const isErased = (cx: number, cy: number): boolean => {
    if (eraser.length === 1) {
      const dx = cx - eraser[0].x;
      const dy = cy - eraser[0].y;
      return dx * dx + dy * dy <= r2;
    }
    for (let i = 1; i < eraser.length; i++) {
      const a = eraser[i - 1];
      const b = eraser[i];
      if (distSqToSegment(cx, cy, a.x, a.y, b.x, b.y) <= r2) return true;
    }
    return false;
  };

  const erased = dense.map((d) => isErased(d.x, d.y));
  if (!erased.some(Boolean)) return [points]; // 변화 없음(참조 동일)

  const segments: Pt[][] = [];
  let cur: Pt[] = [];
  const flush = () => {
    if (cur.length >= 2) {
      const norm = cur.map((d) => ({
        x: (d.x - box.left) / box.width,
        y: (d.y - box.top) / box.height,
      }));
      segments.push(decimate(norm, MAX_STROKE_POINTS));
    }
    cur = [];
  };
  for (let i = 0; i < dense.length; i++) {
    if (erased[i]) flush();
    else cur.push(dense[i]);
  }
  flush();
  return segments;
}
