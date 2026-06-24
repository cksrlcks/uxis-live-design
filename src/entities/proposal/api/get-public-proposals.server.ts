import "server-only";
import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/shared/db";
import { proposals, proposalVariants, proposalPages } from "@drizzle/schema";
import { publicUrl } from "@/shared/lib/proposals/constants";
import { getPublicTagsByProposal } from "@/entities/tag/api/get-public-tags-by-proposal.server";
import { clampListParams } from "../lib/public-list-params";
import type { Paginated } from "../model/types";
import type { PublicProposalSummary, PublicPage } from "../model/public-types";

// 노출(exposed) 시안의 페이지네이션 요약 목록. 각 행에 커버 1장 + 태그를 싣는다.
// 정렬은 createdAt desc, id desc(고정 tie-break).
export async function getPublicProposals(
  pageInput = 1,
  pageSizeInput = 20,
): Promise<Paginated<PublicProposalSummary>> {
  const { page, pageSize } = clampListParams(pageInput, pageSizeInput);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(proposals)
    .where(eq(proposals.exposedToUxisworks, true));

  const rows = await db
    .select()
    .from(proposals)
    .where(eq(proposals.exposedToUxisworks, true))
    .orderBy(desc(proposals.createdAt), desc(proposals.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const proposalIds = rows.map((p) => p.id);

  // 커버 후보: 각 시안의 안들을 sortOrder 순으로, currentVersionId가 있는 것만 모은다.
  const variants = proposalIds.length
    ? await db
        .select({
          proposalId: proposalVariants.proposalId,
          currentVersionId: proposalVariants.currentVersionId,
        })
        .from(proposalVariants)
        .where(inArray(proposalVariants.proposalId, proposalIds))
        .orderBy(asc(proposalVariants.proposalId), asc(proposalVariants.sortOrder))
    : [];

  const candidateVersionsByProposal = new Map<string, string[]>();
  for (const v of variants) {
    if (!v.currentVersionId) continue;
    const list = candidateVersionsByProposal.get(v.proposalId) ?? [];
    list.push(v.currentVersionId);
    candidateVersionsByProposal.set(v.proposalId, list);
  }

  // 후보 버전들의 첫 페이지(pageOrder 최소)를 한 번에 조회.
  const candidateVersionIds = [...candidateVersionsByProposal.values()].flat();
  const coverRows = candidateVersionIds.length
    ? await db
        .select({
          versionId: proposalPages.versionId,
          storagePath: proposalPages.storagePath,
          width: proposalPages.width,
          height: proposalPages.height,
        })
        .from(proposalPages)
        .where(inArray(proposalPages.versionId, candidateVersionIds))
        .orderBy(asc(proposalPages.pageOrder))
    : [];

  const firstPageByVersion = new Map<string, PublicPage>();
  for (const pg of coverRows) {
    if (firstPageByVersion.has(pg.versionId)) continue; // 정렬상 첫 행 = pageOrder 최소
    firstPageByVersion.set(pg.versionId, {
      url: publicUrl(pg.storagePath),
      width: pg.width,
      height: pg.height,
    });
  }

  const tagsByProposal = await getPublicTagsByProposal(proposalIds);

  const items: PublicProposalSummary[] = rows.map((p) => {
    // sortOrder 순으로 이미지가 있는 첫 안의 첫 페이지를 커버로. 없으면 null.
    let cover: PublicPage | null = null;
    for (const versionId of candidateVersionsByProposal.get(p.id) ?? []) {
      const pg = firstPageByVersion.get(versionId);
      if (pg) {
        cover = pg;
        break;
      }
    }
    return {
      publicId: p.publicId,
      domain: p.domain,
      title: p.title,
      createdAt: p.createdAt.toISOString(),
      cover,
      tags: tagsByProposal.get(p.id) ?? [],
    };
  });

  return { items, total, page, pageSize };
}
