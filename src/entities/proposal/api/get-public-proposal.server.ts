import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/shared/db";
import { proposals, proposalVariants, proposalVersions, proposalPages } from "@drizzle/schema";
import { publicUrl } from "@/shared/lib/proposals/constants";
import { getPublicTagsByProposal } from "@/entities/tag/api/get-public-tags-by-proposal.server";
import type { PublicProposalDetail, PublicVariant, PublicPage } from "../model/public-types";

// 노출(exposed) 시안 단건의 안별 최종버전 트리. 비노출/부재는 NOT_FOUND.
export async function getPublicProposal(publicId: string): Promise<PublicProposalDetail> {
  const rows = await db
    .select()
    .from(proposals)
    .where(and(eq(proposals.publicId, publicId), eq(proposals.exposedToUxisworks, true)))
    .limit(1);
  const proposal = rows[0];
  if (!proposal) throw new Error("NOT_FOUND");

  const variants = await db
    .select()
    .from(proposalVariants)
    .where(eq(proposalVariants.proposalId, proposal.id))
    .orderBy(asc(proposalVariants.sortOrder));

  // 각 안의 최종버전(currentVersionId)만 싣는다.
  const versionIds = variants
    .map((v) => v.currentVersionId)
    .filter((id): id is string => id !== null);

  const versions = versionIds.length
    ? await db
        .select({
          id: proposalVersions.id,
          versionNo: proposalVersions.versionNo,
          note: proposalVersions.note,
        })
        .from(proposalVersions)
        .where(inArray(proposalVersions.id, versionIds))
    : [];
  const versionById = new Map(versions.map((v) => [v.id, v]));

  const pages = versionIds.length
    ? await db
        .select()
        .from(proposalPages)
        .where(inArray(proposalPages.versionId, versionIds))
        .orderBy(asc(proposalPages.pageOrder))
    : [];
  const pagesByVersion = new Map<string, PublicPage[]>();
  for (const pg of pages) {
    const list = pagesByVersion.get(pg.versionId) ?? [];
    list.push({ url: publicUrl(pg.storagePath), width: pg.width, height: pg.height });
    pagesByVersion.set(pg.versionId, list);
  }

  const tagsByProposal = await getPublicTagsByProposal([proposal.id]);

  const publicVariants: PublicVariant[] = variants.map((v) => {
    const ver = v.currentVersionId ? versionById.get(v.currentVersionId) : undefined;
    return {
      slug: v.slug,
      label: v.label,
      version: ver ? { versionNo: ver.versionNo, note: ver.note } : null,
      pages: v.currentVersionId ? (pagesByVersion.get(v.currentVersionId) ?? []) : [],
    };
  });

  return {
    publicId: proposal.publicId,
    domain: proposal.domain,
    title: proposal.title,
    createdAt: proposal.createdAt.toISOString(),
    tags: tagsByProposal.get(proposal.id) ?? [],
    variants: publicVariants,
  };
}
