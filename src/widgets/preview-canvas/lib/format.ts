// 핀 코멘트 표시용 공통 포맷 헬퍼 (pin-layer · comments-panel 공유).

export function formatPinTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// 피그마식 상대 시간 — 방금/분/시간/일, 일주일 넘으면 날짜로.
export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const min = 60_000;
  const hr = 60 * min;
  const day = 24 * hr;
  if (diff < min) return "방금";
  if (diff < hr) return `${Math.floor(diff / min)}분`;
  if (diff < day) return `${Math.floor(diff / hr)}시간`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}일`;
  return formatPinTime(iso);
}

export function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

// 리스트에서 핀으로 이동(zoomToElement)할 때 쓰는 DOM id.
export function pinElementId(id: string): string {
  return `pin-${id}`;
}
