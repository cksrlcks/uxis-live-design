import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { proposalVariants, proposalVersions, proposalPages } from "@/drizzle/schema";
import { createReadUrls } from "@/lib/proposals/storage";
import type { PreviewPage } from "@/lib/preview/types";

// One variant (안) with its current version's pages, ready for the client viewer.
export type ViewerVariant = {
  id: string;
  slug: string;
  label: string;
  currentVersionId: string | null;
  pages: PreviewPage[];
};

// Editor view also needs the per-variant version history for the timeline UI.
export type EditorVariant = ViewerVariant & {
  versions: { id: string; versionNo: number; note: string | null }[];
};

// Load EVERY variant of a proposal with its current pages in a fixed number of
// queries + a single batch URL-signing call — so the client can switch variants
// with zero server round-trips. Replaces the old per-variant / per-page signing
// (N variants × M pages = N×M signed-URL network calls) with: variants query,
// one pages query (inArray), one createSignedUrls batch.
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

  const urlByPath = await createReadUrls(pages.map((p) => p.storagePath));

  // Group pages by version, preserving the pageOrder from the query above.
  const pagesByVersion = new Map<string, PreviewPage[]>();
  for (const pg of pages) {
    const list = pagesByVersion.get(pg.versionId) ?? [];
    list.push({ id: pg.id, url: urlByPath.get(pg.storagePath) ?? "", width: pg.width, height: pg.height, pageOrder: pg.pageOrder });
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

// Same as loadVariantsForProposal, plus each variant's full version history.
export async function loadEditorVariants(proposalId: string): Promise<EditorVariant[]> {
  const base = await loadVariantsForProposal(proposalId);
  const variantIds = base.map((v) => v.id);

  const versions = variantIds.length
    ? await db.select().from(proposalVersions)
        .where(inArray(proposalVersions.variantId, variantIds)).orderBy(asc(proposalVersions.versionNo))
    : [];

  const versionsByVariant = new Map<string, EditorVariant["versions"]>();
  for (const ver of versions) {
    const list = versionsByVariant.get(ver.variantId) ?? [];
    list.push({ id: ver.id, versionNo: ver.versionNo, note: ver.note });
    versionsByVariant.set(ver.variantId, list);
  }

  return base.map((v) => ({ ...v, versions: versionsByVariant.get(v.id) ?? [] }));
}
