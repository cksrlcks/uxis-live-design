import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { proposals, proposalVariants, proposalVersions, proposalPages } from "@drizzle/schema";
import { requireEditor } from "@/shared/auth/guards.server";
import { hashPassword } from "@/shared/lib/password";
import { removeObjects } from "@/shared/storage";
import { updateSettingsSchema } from "../model/edit-schemas";

export async function updateProposalSettings(id: string, input: unknown): Promise<void> {
  await requireEditor();
  const { title, visibility, password } = updateSettingsSchema.parse(input);

  const updates: Partial<typeof proposals.$inferInsert> = {};
  if (title !== undefined) updates.title = title;
  if (visibility !== undefined) updates.visibility = visibility;
  if (password !== undefined)
    updates.accessPasswordHash = password === null ? null : hashPassword(password);
  updates.updatedAt = new Date();

  await db.update(proposals).set(updates).where(eq(proposals.id, id));
}

export async function deleteProposal(id: string): Promise<void> {
  await requireEditor();
  const pages = await db
    .select({ path: proposalPages.storagePath })
    .from(proposalPages)
    .innerJoin(proposalVersions, eq(proposalPages.versionId, proposalVersions.id))
    .innerJoin(proposalVariants, eq(proposalVersions.variantId, proposalVariants.id))
    .where(eq(proposalVariants.proposalId, id));
  await removeObjects([...new Set(pages.map((p) => p.path))]); // best-effort before row delete
  await db.delete(proposals).where(eq(proposals.id, id)); // cascade: variants + versions + pages
}
