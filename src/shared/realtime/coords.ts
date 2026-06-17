export function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

// Pixel within [start, start+size] → normalized 0..1 (clamped). size<=0 → 0.
export function toNorm(px: number, start: number, size: number): number {
  if (size <= 0) return 0;
  return clamp01((px - start) / size);
}

// Normalized 0..1 (clamped) → pixel within [start, start+size].
export function fromNorm(n: number, start: number, size: number): number {
  return start + clamp01(n) * size;
}

// 화면(client) 좌표 → 배율 1배 기준 콘텐츠 좌표.
// rect는 콘텐츠 엘리먼트의 화면 rect(줌/팬 반영), scale은 현재 줌 배율.
// scale<=0(아직 레이아웃 전)은 원점으로 처리.
export function toContent(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number },
  scale: number,
): { cx: number; cy: number } {
  if (scale <= 0) return { cx: 0, cy: 0 };
  return { cx: (clientX - rect.left) / scale, cy: (clientY - rect.top) / scale };
}
