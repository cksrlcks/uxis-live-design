// Wrap-around navigation for the fullscreen slide view:
// advancing past the last page loops to the first, and vice versa.
export function nextIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  return (index + 1) % count;
}

export function prevIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  return (index - 1 + count) % count;
}
