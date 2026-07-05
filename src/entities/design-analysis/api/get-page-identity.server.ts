import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { proposals, proposalVariants, proposalVersions, proposalPages } from "@drizzle/schema";
import type { PendingPage } from "../model/types";

// pageId로 페이지 귀속(proposal/version/title/storagePath)을 서버에서 재조회한다.
// 클라이언트가 준 귀속을 신뢰하지 않기 위한 무결성 장치. 페이지가 없으면 null.
export async function getPageIdentity(pageId: string): Promise<PendingPage | null> {
  const [row] = await db
    .select({
      pageId: proposalPages.id,
      versionId: proposalPages.versionId,
      storagePath: proposalPages.storagePath,
      proposalId: proposals.id,
      proposalTitle: proposals.title,
    })
    .from(proposalPages)
    .innerJoin(proposalVersions, eq(proposalVersions.id, proposalPages.versionId))
    .innerJoin(proposalVariants, eq(proposalVariants.id, proposalVersions.variantId))
    .innerJoin(proposals, eq(proposals.id, proposalVariants.proposalId))
    .where(eq(proposalPages.id, pageId))
    .limit(1);
  if (!row) return null;
  return {
    pageId: row.pageId,
    versionId: row.versionId,
    proposalId: row.proposalId,
    proposalTitle: row.proposalTitle,
    storagePath: row.storagePath,
  };
}
