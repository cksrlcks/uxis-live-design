import "server-only";
import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/shared/db";
import { proposals, variantTags, proposalVariants, proposalPages } from "@drizzle/schema";
import { publicUrl } from "@/shared/lib/proposals/constants";
import { pickCoverPaths } from "../lib/pick-cover-paths";

export type TagMatchedImage = { proposalId: string; proposalTitle: string; url: string };

// 선택 태그(optionIds)로 전체 시안에서 느슨 매칭 + 매칭수 정렬 → 각 시안 커버 1장.
// 항상 결과가 나오도록 한다(0건 허용). 최대 limit개.
export async function getTagMatchedImages(
  optionIds: string[],
  limit = 10,
): Promise<TagMatchedImage[]> {
  if (optionIds.length === 0) return [];

  // 안(variant)별 태그를 시안 단위로 집계 — 한 시안의 어느 안이든 매칭되면 그 시안이 잡힌다.
  const matched = await db
    .select({ proposalId: proposalVariants.proposalId, matches: sql<number>`count(*)::int` })
    .from(variantTags)
    .innerJoin(proposalVariants, eq(variantTags.variantId, proposalVariants.id))
    .where(inArray(variantTags.optionId, optionIds))
    .groupBy(proposalVariants.proposalId)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);

  const proposalIds = matched.map((m) => m.proposalId);
  if (proposalIds.length === 0) return [];

  const [proposalRows, variants] = await Promise.all([
    db
      .select({ id: proposals.id, title: proposals.title })
      .from(proposals)
      .where(inArray(proposals.id, proposalIds)),
    db
      .select({
        proposalId: proposalVariants.proposalId,
        currentVersionId: proposalVariants.currentVersionId,
        sortOrder: proposalVariants.sortOrder,
      })
      .from(proposalVariants)
      .where(inArray(proposalVariants.proposalId, proposalIds)),
  ]);

  const titleMap = new Map(proposalRows.map((p) => [p.id, p.title]));

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
    proposalTitle: titleMap.get(c.proposalId) ?? "",
    url: publicUrl(c.storagePath),
  }));
}
