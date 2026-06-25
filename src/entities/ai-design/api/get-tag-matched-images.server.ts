import "server-only";
import { asc, desc, inArray, sql } from "drizzle-orm";
import { db } from "@/shared/db";
import { proposalTags, proposalVariants, proposalPages } from "@drizzle/schema";
import { publicUrl } from "@/shared/lib/proposals/constants";
import { pickCoverPaths } from "../lib/pick-cover-paths";

// 선택 태그(optionIds)로 전체 시안에서 느슨 매칭 + 매칭수 정렬 → 각 시안 커버 1장.
// 항상 결과가 나오도록 한다(0건 허용). 최대 limit개.
export async function getTagMatchedImages(
  optionIds: string[],
  limit = 10,
): Promise<{ proposalId: string; url: string }[]> {
  if (optionIds.length === 0) return [];

  const matched = await db
    .select({ proposalId: proposalTags.proposalId, matches: sql<number>`count(*)::int` })
    .from(proposalTags)
    .where(inArray(proposalTags.optionId, optionIds))
    .groupBy(proposalTags.proposalId)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);

  const proposalIds = matched.map((m) => m.proposalId);
  if (proposalIds.length === 0) return [];

  const variants = await db
    .select({
      proposalId: proposalVariants.proposalId,
      currentVersionId: proposalVariants.currentVersionId,
      sortOrder: proposalVariants.sortOrder,
    })
    .from(proposalVariants)
    .where(inArray(proposalVariants.proposalId, proposalIds));

  const versionIds = variants.map((v) => v.currentVersionId).filter((x): x is string => !!x);
  if (versionIds.length === 0) return [];

  const pages = await db
    .select({
      versionId: proposalPages.versionId,
      storagePath: proposalPages.storagePath,
      pageOrder: proposalPages.pageOrder,
    })
    .from(proposalPages)
    .where(inArray(proposalPages.versionId, versionIds))
    .orderBy(asc(proposalPages.pageOrder));

  return pickCoverPaths(matched, variants, pages).map((c) => ({
    proposalId: c.proposalId,
    url: publicUrl(c.storagePath),
  }));
}
