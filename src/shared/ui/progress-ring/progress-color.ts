// 진행률 4단계 색 구간(테마 변수). 0은 회색, 100은 초록.
export function progressRingColor(value: number): string {
  if (value <= 0) return "var(--color-muted-foreground)";
  if (value <= 33) return "var(--color-error)";
  if (value <= 66) return "var(--color-accent-orange)";
  if (value <= 99) return "var(--color-info)";
  return "var(--color-success)";
}
