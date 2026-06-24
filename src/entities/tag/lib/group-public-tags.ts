import type { PublicTag } from "../model/public-types";

// DB 조인 행. 입력은 group/option sortOrder로 이미 정렬돼 있다고 가정한다.
export type PublicTagRow = {
  proposalId: string;
  group: string;
  groupLabel: string;
  code: string;
  label: string;
};

// proposalId별로 PublicTag[]로 묶는다(입력 순서 보존).
export function groupPublicTags(rows: PublicTagRow[]): Map<string, PublicTag[]> {
  const byProposal = new Map<string, PublicTag[]>();
  for (const r of rows) {
    const list = byProposal.get(r.proposalId) ?? [];
    list.push({ group: r.group, groupLabel: r.groupLabel, code: r.code, label: r.label });
    byProposal.set(r.proposalId, list);
  }
  return byProposal;
}
