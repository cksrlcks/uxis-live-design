// pg uuid 컬럼에 비-uuid를 넣으면 캐스팅 에러(500)가 나므로 조회 전에 형식을 거른다.
// server-only를 붙이지 않는 순수 모듈 — vitest가 직접 import한다.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidAuthId(value: string): boolean {
  return UUID_RE.test(value);
}
