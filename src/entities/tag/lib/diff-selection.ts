// 현재 선택집합 → 다음 선택집합 전이를 추가/삭제로 분해한다(Set으로 중복 제거).
export function diffSelection(
  current: string[],
  next: string[],
): { toAdd: string[]; toRemove: string[] } {
  const cur = new Set(current);
  const nxt = new Set(next);
  return {
    toAdd: [...nxt].filter((id) => !cur.has(id)),
    toRemove: [...cur].filter((id) => !nxt.has(id)),
  };
}
