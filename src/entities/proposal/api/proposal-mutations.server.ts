import "server-only";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/shared/db";
import { proposals, proposalVariants, proposalVersions, proposalPages } from "@drizzle/schema";
import { requireEditor } from "@/shared/auth/guards.server";
import { hashPassword } from "@/shared/lib/password";
import { removeObjects } from "@/shared/storage";
import { updateSettingsSchema } from "../model/edit-schemas";

export async function updateProposalSettings(id: string, input: unknown): Promise<void> {
  await requireEditor();
  const { title, visibility, password, domain, whiteboardEnabled, participants } =
    updateSettingsSchema.parse(input);

  const updates: Partial<typeof proposals.$inferInsert> = {};
  if (title !== undefined) updates.title = title;
  // 빈 문자열/공백은 미설정(null)로 정규화한다.
  if (participants !== undefined)
    updates.participants = participants && participants.trim() ? participants.trim() : null;
  if (visibility !== undefined) updates.visibility = visibility;
  if (password !== undefined)
    updates.accessPasswordHash = password === null ? null : hashPassword(password);
  if (domain !== undefined) {
    // 도메인 슬러그 중복 체크 — 자기 자신 제외, DB unique 제약 전에 친화적 에러로 차단.
    if (domain !== null) {
      const taken = await db
        .select({ id: proposals.id })
        .from(proposals)
        .where(and(eq(proposals.domain, domain), ne(proposals.id, id)))
        .limit(1);
      if (taken.length > 0) throw new Error("DOMAIN_TAKEN");
    }
    updates.domain = domain;
  }
  if (whiteboardEnabled !== undefined) updates.whiteboardEnabled = whiteboardEnabled;
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
