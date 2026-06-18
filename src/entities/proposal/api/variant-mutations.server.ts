import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { proposalVariants, proposalVersions, proposalPages } from "@drizzle/schema";
import { requireEditor } from "@/shared/auth/guards.server";
import { removeObjects } from "@/shared/storage";
import { updateVariantSchema } from "../model/edit-schemas";

export async function updateVariant(id: string, variantId: string, input: unknown): Promise<void> {
  await requireEditor();
  const { label, sortOrder } = updateVariantSchema.parse(input);
  const updates: Partial<typeof proposalVariants.$inferInsert> = {};
  if (label !== undefined) updates.label = label;
  if (sortOrder !== undefined) updates.sortOrder = sortOrder;
  await db
    .update(proposalVariants)
    .set(updates)
    .where(and(eq(proposalVariants.id, variantId), eq(proposalVariants.proposalId, id)));
}

export async function deleteVariant(id: string, variantId: string): Promise<void> {
  await requireEditor();
  const all = await db
    .select({ id: proposalVariants.id })
    .from(proposalVariants)
    .where(eq(proposalVariants.proposalId, id));
  if (all.length <= 1) throw new Error("LAST_VARIANT");
  if (!all.some((v) => v.id === variantId)) throw new Error("NOT_FOUND");

  const pages = await db
    .select({ path: proposalPages.storagePath })
    .from(proposalPages)
    .innerJoin(proposalVersions, eq(proposalPages.versionId, proposalVersions.id))
    .where(eq(proposalVersions.variantId, variantId));
  await removeObjects([...new Set(pages.map((p) => p.path))]); // best-effort before row delete
  await db
    .delete(proposalVariants)
    .where(and(eq(proposalVariants.id, variantId), eq(proposalVariants.proposalId, id))); // cascade
}
