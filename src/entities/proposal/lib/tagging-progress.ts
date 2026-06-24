// 태깅 완성도 = 태그가 1개 이상 선택된 구분 수 / 전체 구분 수 × 100 (0~100 정수).
// 전체 구분이 0이면 0으로 나누기를 피해 0을 반환한다.
export function taggingPercent(taggedGroups: number, totalGroups: number): number {
  if (totalGroups <= 0) return 0;
  return Math.round((taggedGroups / totalGroups) * 100);
}
