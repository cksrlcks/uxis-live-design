import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/shared/db";
import { proposalVariants, proposalPages } from "@drizzle/schema";
import { publicUrl } from "@/shared/lib/proposals/constants";
import { resolveViewerGate } from "./resolve-viewer-gate.server";
import type { ViewerVariant, ProposalPage } from "../model/types";

export async function getViewerVariants(publicId: string): Promise<ViewerVariant[]> {
  const { proposal, decision } = await resolveViewerGate(publicId);
  if (!proposal) throw new Error("NOT_FOUND");
  if (decision !== "allow") throw new Error("FORBIDDEN");

  const variants = await db
    .select()
    .from(proposalVariants)
    .where(eq(proposalVariants.proposalId, proposal.id))
    .orderBy(asc(proposalVariants.sortOrder));

  const currentVersionIds = variants
    .map((v) => v.currentVersionId)
    .filter((id): id is string => id !== null);
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

  return variants.map((v) => ({
    id: v.id,
    slug: v.slug,
    label: v.label,
    currentVersionId: v.currentVersionId,
    pages: v.currentVersionId ? (pagesByVersion.get(v.currentVersionId) ?? []) : [],
  }));
}
