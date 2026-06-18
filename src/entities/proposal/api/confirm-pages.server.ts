import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { proposals, proposalVariants, proposalVersions, proposalPages } from "@drizzle/schema";
import { requireEditor } from "@/shared/auth/guards.server";
import { listObjectNames } from "@/shared/storage";
import { confirmPagesSchema } from "../model/upload-schemas";

export async function confirmPages(
  id: string,
  variantId: string,
  versionId: string,
  input: unknown,
): Promise<void> {
  await requireEditor();
  const { pages } = confirmPagesSchema.parse(input);

  const ver = await db
    .select({ id: proposalVersions.id })
    .from(proposalVersions)
    .innerJoin(proposalVariants, eq(proposalVersions.variantId, proposalVariants.id))
    .where(
      and(
        eq(proposalVersions.id, versionId),
        eq(proposalVariants.id, variantId),
        eq(proposalVariants.proposalId, id),
      ),
    )
    .limit(1);
  if (ver.length === 0) throw new Error("NOT_FOUND");

  // Every page must reference a real uploaded object under this version's folder
  // (path scheme {proposalId}/{versionId}/{pageId}).
  const prefix = `${id}/${versionId}`;
  const existing = await listObjectNames(prefix);
  for (const p of pages) {
    const name = p.path.startsWith(`${prefix}/`) ? p.path.slice(prefix.length + 1) : "";
    if (!name || name.includes("/") || !existing.has(name)) throw new Error("OBJECT_MISSING");
  }

  await db.insert(proposalPages).values(
    pages.map((p) => ({
      id: p.pageId,
      versionId,
      pageOrder: p.pageOrder,
      storagePath: p.path,
      width: p.width,
      height: p.height,
    })),
  );
  await db
    .update(proposalVariants)
    .set({ currentVersionId: versionId })
    .where(eq(proposalVariants.id, variantId));
  await db.update(proposals).set({ updatedAt: new Date() }).where(eq(proposals.id, id));
}
