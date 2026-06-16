export function clampIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  if (index < 0) return 0;
  if (index > count - 1) return count - 1;
  return index;
}

export function nextIndex(index: number, count: number): number {
  return clampIndex(index + 1, count);
}

export function prevIndex(index: number, count: number): number {
  return clampIndex(index - 1, count);
}
