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
