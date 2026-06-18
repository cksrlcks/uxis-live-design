import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/shared/db";
import { proposalVariants, proposalPages } from "@drizzle/schema";
import { publicUrl } from "@/shared/lib/proposals/constants";
import type { ViewerVariant, ProposalPage } from "@/entities/proposal";
export type { ViewerVariant, EditorVariant } from "@/entities/proposal";

// Load EVERY variant of a proposal with its current pages in a fixed number of
// queries — so the client can switch variants with zero server round-trips.
// Pages are served via the public bucket URL (no signed URLs needed).
export async function loadVariantsForProposal(proposalId: string): Promise<ViewerVariant[]> {
  const variants = await db.select().from(proposalVariants)
    .where(eq(proposalVariants.proposalId, proposalId)).orderBy(asc(proposalVariants.sortOrder));

  const versionIds = variants
    .map((v) => v.currentVersionId)
    .filter((id): id is string => id !== null);

  const pages = versionIds.length
    ? await db.select().from(proposalPages)
        .where(inArray(proposalPages.versionId, versionIds)).orderBy(asc(proposalPages.pageOrder))
    : [];

  // Group pages by version (public URLs — no signing).
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

  return variants.map((v) => ({
    id: v.id,
    slug: v.slug,
    label: v.label,
    currentVersionId: v.currentVersionId,
    pages: v.currentVersionId ? (pagesByVersion.get(v.currentVersionId) ?? []) : [],
  }));
}

