import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/shared/db";
import { proposalVariants, variantTags, tagOptions, tagGroups } from "@drizzle/schema";
import { groupPublicTags, type PublicTagRow } from "../lib/group-public-tags";
import type { PublicTag } from "../model/public-types";

// 여러 시안의 태그를 한 쿼리로 모아 proposalId별 PublicTag[]로 반환(N+1 없음).
// 태그는 이제 안(variant) 단위이므로 안→시안으로 조인해 시안 단위로 합집합(중복 제거)한다.
// group sortOrder → option sortOrder로 정렬한다.
export async function getPublicTagsByProposal(
  proposalIds: string[],
): Promise<Map<string, PublicTag[]>> {
  if (proposalIds.length === 0) return new Map();

  const raw = await db
    .select({
      proposalId: proposalVariants.proposalId,
      group: tagGroups.code,
      groupLabel: tagGroups.label,
      code: tagOptions.code,
      label: tagOptions.label,
    })
    .from(variantTags)
    .innerJoin(proposalVariants, eq(proposalVariants.id, variantTags.variantId))
    .innerJoin(tagOptions, eq(tagOptions.id, variantTags.optionId))
    .innerJoin(tagGroups, eq(tagGroups.id, tagOptions.groupId))
    .where(inArray(proposalVariants.proposalId, proposalIds))
    .orderBy(asc(tagGroups.sortOrder), asc(tagOptions.sortOrder));

  // 한 시안의 여러 안이 같은 태그를 가지면 중복 → (proposalId, group, code)로 제거.
  const seen = new Set<string>();
  const rows: PublicTagRow[] = [];
  for (const r of raw) {
    const key = `${r.proposalId}|${r.group}|${r.code}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(r);
  }

  return groupPublicTags(rows);
}
