export type RecentProposal = { publicId: string; title: string; viewedAt: number };

const STORAGE_KEY = "uxis:recent";
const MAX_RECENT = 20;

// 순수: 이전 목록에 entry를 맨 앞으로(같은 publicId 제거), 상한 절단.
export function upsertRecent(
  prev: RecentProposal[],
  entry: RecentProposal,
  max: number = MAX_RECENT,
): RecentProposal[] {
  const filtered = prev.filter((r) => r.publicId !== entry.publicId);
  return [entry, ...filtered].slice(0, max);
}

// 순수: 저장된 JSON 파싱·검증. 손상/형식오류는 무시.
export function parseRecent(raw: string | null): RecentProposal[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (o): o is RecentProposal =>
        !!o &&
        typeof o.publicId === "string" &&
        o.publicId.length > 0 &&
        typeof o.title === "string" &&
        typeof o.viewedAt === "number" &&
        Number.isFinite(o.viewedAt),
    );
  } catch {
    return [];
  }
}

// 브라우저 I/O.
export function loadRecent(): RecentProposal[] {
  if (typeof localStorage === "undefined") return [];
  return parseRecent(localStorage.getItem(STORAGE_KEY));
}

export function addRecent(entry: RecentProposal): void {
  if (typeof localStorage === "undefined") return;
  const next = upsertRecent(parseRecent(localStorage.getItem(STORAGE_KEY)), entry);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
