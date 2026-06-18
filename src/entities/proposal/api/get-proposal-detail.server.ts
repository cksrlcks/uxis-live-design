import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/shared/db";
import { proposals, proposalVariants, proposalVersions, proposalPages } from "@drizzle/schema";
import { requireEditor } from "@/shared/auth/guards.server";
import { publicUrl } from "@/shared/lib/proposals/constants";
import type { ProposalDetail, EditorVariant, ProposalPage } from "../model/types";

export async function getProposalDetail(id: string): Promise<ProposalDetail> {
  await requireEditor();

  const rows = await db.select().from(proposals).where(eq(proposals.id, id)).limit(1);
  const proposal = rows[0];
  if (!proposal) throw new Error("NOT_FOUND");

  const variants = await db
    .select()
    .from(proposalVariants)
    .where(eq(proposalVariants.proposalId, id))
    .orderBy(asc(proposalVariants.sortOrder));

  const variantIds = variants.map((v) => v.id);
  const versions = variantIds.length
    ? await db
        .select()
        .from(proposalVersions)
        .where(inArray(proposalVersions.variantId, variantIds))
        .orderBy(asc(proposalVersions.versionNo))
    : [];

  const currentVersionIds = variants
    .map((v) => v.currentVersionId)
    .filter((vid): vid is string => vid !== null);
  const pages = currentVersionIds.length
    ? await db
        .select()
        .from(proposalPages)
        .where(inArray(proposalPages.versionId, currentVersionIds))
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

  const versionsByVariant = new Map<string, EditorVariant["versions"]>();
  for (const ver of versions) {
    const list = versionsByVariant.get(ver.variantId) ?? [];
    list.push({ id: ver.id, versionNo: ver.versionNo, note: ver.note });
    versionsByVariant.set(ver.variantId, list);
  }

  const editorVariants: EditorVariant[] = variants.map((v) => ({
    id: v.id,
    slug: v.slug,
    label: v.label,
    currentVersionId: v.currentVersionId,
    pages: v.currentVersionId ? (pagesByVersion.get(v.currentVersionId) ?? []) : [],
    versions: versionsByVariant.get(v.id) ?? [],
  }));

  return {
    proposal: {
      id: proposal.id,
      title: proposal.title,
      publicId: proposal.publicId,
      visibility: proposal.visibility,
      hasPassword: !!proposal.accessPasswordHash,
    },
    variants: editorVariants,
  };
}
