import type { PendingPage } from "../model/types";

// 분석 대상 페이지를 순수 함수로 결정한다(DB 접근 없음 → 단위 테스트 가능).
// - proposalId 지정 시 해당 시안 페이지만.
// - force=false(기본): 이미 analyzed된 페이지는 제외(미분석만).
// - force=true: analyzed 여부와 무관하게 포함(재분석).
// - limit 도달 시 중단.
export function selectPendingPages(
  candidates: PendingPage[],
  analyzedPageIds: ReadonlySet<string>,
  opts: { limit: number; proposalId?: string; force?: boolean },
): PendingPage[] {
  const selected: PendingPage[] = [];
  for (const page of candidates) {
    if (opts.proposalId && page.proposalId !== opts.proposalId) continue;
    if (!opts.force && analyzedPageIds.has(page.pageId)) continue;
    selected.push(page);
    if (selected.length >= opts.limit) break;
  }
  return selected;
}
