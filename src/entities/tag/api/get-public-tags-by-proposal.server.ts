import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/shared/db";
import { proposalTags, tagOptions, tagGroups } from "@drizzle/schema";
import { groupPublicTags, type PublicTagRow } from "../lib/group-public-tags";
import type { PublicTag } from "../model/public-types";

// 여러 시안의 태그를 한 쿼리로 모아 proposalId별 PublicTag[]로 반환(N+1 없음).
// group sortOrder → option sortOrder로 정렬한다.
export async function getPublicTagsByProposal(
  proposalIds: string[],
): Promise<Map<string, PublicTag[]>> {
  if (proposalIds.length === 0) return new Map();

  const rows: PublicTagRow[] = await db
    .select({
      proposalId: proposalTags.proposalId,
      group: tagGroups.code,
      groupLabel: tagGroups.label,
      code: tagOptions.code,
      label: tagOptions.label,
    })
    .from(proposalTags)
    .innerJoin(tagOptions, eq(tagOptions.id, proposalTags.optionId))
    .innerJoin(tagGroups, eq(tagGroups.id, tagOptions.groupId))
    .where(inArray(proposalTags.proposalId, proposalIds))
    .orderBy(asc(tagGroups.sortOrder), asc(tagOptions.sortOrder));

  return groupPublicTags(rows);
}
