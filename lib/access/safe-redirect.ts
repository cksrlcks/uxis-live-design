// 오픈 리다이렉트 방지: 내부 절대 경로(`/`로 시작)만 허용하고,
// 프로토콜-상대(`//`)·역슬래시(`/\`) 트릭은 거부.
export function isSafeInternalPath(path: unknown): path is string {
  if (typeof path !== "string" || path.length === 0) return false;
  if (path[0] !== "/") return false;
  if (path[1] === "/" || path[1] === "\\") return false;
  return true;
}
