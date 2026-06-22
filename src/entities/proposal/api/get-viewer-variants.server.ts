import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/shared/db";
import { proposalVariants, proposalVersions, proposalPages } from "@drizzle/schema";
import { publicUrl } from "@/shared/lib/proposals/constants";
import { resolveViewerGate } from "@/shared/access/resolve-viewer-gate.server";
import type { ViewerVariant, ProposalPage, ProposalVersionView } from "../model/types";

export async function getViewerVariants(publicId: string): Promise<ViewerVariant[]> {
  const { proposal, decision } = await resolveViewerGate(publicId);
  if (!proposal) throw new Error("NOT_FOUND");
  if (decision !== "allow") throw new Error("FORBIDDEN");

  const variants = await db
    .select()
    .from(proposalVariants)
    .where(eq(proposalVariants.proposalId, proposal.id))
    .orderBy(asc(proposalVariants.sortOrder));

  const variantIds = variants.map((v) => v.id);
  // 뷰어도 안마다 여러 버전을 선택할 수 있어야 하므로 모든 버전의 페이지를 싣는다.
  const versions = variantIds.length
    ? await db
        .select()
        .from(proposalVersions)
        .where(inArray(proposalVersions.variantId, variantIds))
        .orderBy(asc(proposalVersions.versionNo))
    : [];

  const versionIds = versions.map((v) => v.id);
  const pages = versionIds.length
    ? await db
        .select()
        .from(proposalPages)
        .where(inArray(proposalPages.versionId, versionIds))
        .orderBy(asc(proposalPages.pageOrder))
    : [];

  const pagesByVersion = new Map<string, ProposalPage[]>();
  for (const pg of pages) {
    const list = pagesByVersion.get(pg.versionId) ?? [];
    list.push({
      id: pg.id,
      url: publicUrl(pg.storagePath),
      width: pg.width,
      height: pg.height,
      pageOrder: pg.pageOrder,
    });
    pagesByVersion.set(pg.versionId, list);
  }

  const versionsByVariant = new Map<string, ProposalVersionView[]>();
  for (const ver of versions) {
    const list = versionsByVariant.get(ver.variantId) ?? [];
    list.push({
      id: ver.id,
      versionNo: ver.versionNo,
      note: ver.note,
      pages: pagesByVersion.get(ver.id) ?? [],
    });
    versionsByVariant.set(ver.variantId, list);
  }

  return variants.map((v) => ({
    id: v.id,
    slug: v.slug,
    label: v.label,
    currentVersionId: v.currentVersionId,
    pages: v.currentVersionId ? (pagesByVersion.get(v.currentVersionId) ?? []) : [],
    versions: versionsByVariant.get(v.id) ?? [],
  }));
}
