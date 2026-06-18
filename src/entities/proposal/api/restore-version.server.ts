import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { proposals, proposalVariants, proposalVersions, proposalPages } from "@drizzle/schema";
import { requireEditor } from "@/shared/auth/guards.server";
import { restoreSchema } from "../model/edit-schemas";

export async function restoreVersion(
  id: string,
  variantId: string,
  input: unknown,
): Promise<{ versionId: string; versionNo: number }> {
  const editor = await requireEditor();
  const { versionId } = restoreSchema.parse(input);

  // Source version must belong to this variant, which must belong to this proposal.
  const src = await db
    .select({ id: proposalVersions.id, versionNo: proposalVersions.versionNo })
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
  if (src.length === 0) throw new Error("NOT_FOUND");

  const srcPages = await db
    .select()
    .from(proposalPages)
    .where(eq(proposalPages.versionId, versionId))
    .orderBy(asc(proposalPages.pageOrder));

  const last = await db
    .select({ v: proposalVersions.versionNo })
    .from(proposalVersions)
    .where(eq(proposalVersions.variantId, variantId))
    .orderBy(desc(proposalVersions.versionNo))
    .limit(1);
  const nextNo = (last[0]?.v ?? 0) + 1;

  const newVid = randomUUID();
  await db.insert(proposalVersions).values({
    id: newVid,
    variantId,
    versionNo: nextNo,
    note: `v${src[0].versionNo}에서 복원`,
    createdBy: editor.id,
  });
  if (srcPages.length > 0) {
    await db.insert(proposalPages).values(
      srcPages.map((p) => ({
        id: randomUUID(),
        versionId: newVid,
        pageOrder: p.pageOrder,
        storagePath: p.storagePath,
        width: p.width,
        height: p.height,
      })),
    );
  }
  await db
    .update(proposalVariants)
    .set({ currentVersionId: newVid })
    .where(eq(proposalVariants.id, variantId));
  await db.update(proposals).set({ updatedAt: new Date() }).where(eq(proposals.id, id));

  return { versionId: newVid, versionNo: nextNo };
}
