// 서버 선택값을 로컬 편집 상태에 반영해야 하는지 결정한다.
// - isFirstSync: 이 시안에 대한 최초 동기화면 로컬 상태와 무관하게 무조건 반영한다
//   (초기 로드/새로고침 — 로컬은 빈 Set, 서버엔 저장된 태그가 있는 상황).
// - 이후 refetch에서는 사용자가 편집 중(로컬≠서버)이 아닐 때만 반영한다 —
//   백그라운드 refetch가 미저장 선택을 덮어쓰지 않도록.
export function shouldSyncSelection(
  isFirstSync: boolean,
  selected: ReadonlySet<string>,
  serverOptionIds: string[],
): boolean {
  if (isFirstSync) return true;
  const base = new Set(serverOptionIds);
  const isDirty =
    selected.size !== base.size || [...selected].some((id) => !base.has(id));
  return !isDirty;
}
