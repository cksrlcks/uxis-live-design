// 목록 쿼리 파라미터를 안전 범위로 보정한다. page>=1, pageSize 1~100.
// 비유한(NaN/Infinity)·미지정은 기본값(page=1, pageSize=20)으로 떨어진 뒤 클램프된다.
export function clampListParams(
  page: number,
  pageSize: number,
): { page: number; pageSize: number } {
  const p = Number.isFinite(page) ? Math.trunc(page) : 1;
  const s = Number.isFinite(pageSize) ? Math.trunc(pageSize) : 20;
  return { page: Math.max(1, p), pageSize: Math.min(100, Math.max(1, s)) };
}
