import "server-only";
import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { proposals, proposalVariants, proposalVersions, proposalPages } from "@drizzle/schema";
import { requireEditor } from "@/shared/auth/guards.server";
import { removeObjects } from "@/shared/storage";
import { createVersionSchema } from "../model/upload-schemas";

// 새 버전 생성 — 빈 상태로 만들고 곧바로 현재(기본) 버전으로 전환한다.
// 이미지는 카드 그리드에서 추가한다. 복원 개념은 없다.
export async function createVersion(id: string, variantId: string, input: unknown) {
  const editor = await requireEditor();
  const { note } = createVersionSchema.parse(input);

  const variant = await db
    .select({ id: proposalVariants.id })
    .from(proposalVariants)
    .where(and(eq(proposalVariants.id, variantId), eq(proposalVariants.proposalId, id)))
    .limit(1);
  if (variant.length === 0) throw new Error("NOT_FOUND");

  const last = await db
    .select({ v: proposalVersions.versionNo })
    .from(proposalVersions)
    .where(eq(proposalVersions.variantId, variantId))
    .orderBy(desc(proposalVersions.versionNo))
    .limit(1);
  const nextNo = (last[0]?.v ?? 0) + 1;

  const versionId = randomUUID();
  await db.insert(proposalVersions).values({
    id: versionId,
    variantId,
    versionNo: nextNo,
    note: note && note.length > 0 ? note : null,
    createdBy: editor.id,
  });
  await db
    .update(proposalVariants)
    .set({ currentVersionId: versionId })
    .where(eq(proposalVariants.id, variantId));
  await db.update(proposals).set({ updatedAt: new Date() }).where(eq(proposals.id, id));

  return { versionId, versionNo: nextNo };
}

// 버전 삭제 — 마지막 버전은 삭제 불가. 현재 버전을 지우면 남은 최신 버전으로 기본을
// 옮긴 뒤(현재 버전 FK 보호) 페이지·버전 행과 스토리지 객체를 제거한다.
export async function deleteVersion(
  id: string,
  variantId: string,
  versionId: string,
): Promise<void> {
  await requireEditor();

  const owns = await db
    .select({ currentVersionId: proposalVariants.currentVersionId })
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
  if (owns.length === 0) throw new Error("NOT_FOUND");

  const all = await db
    .select({ id: proposalVersions.id })
    .from(proposalVersions)
    .where(eq(proposalVersions.variantId, variantId))
    .orderBy(desc(proposalVersions.versionNo));
  if (all.length <= 1) throw new Error("LAST_VERSION");

  const pages = await db
    .select({ path: proposalPages.storagePath })
    .from(proposalPages)
    .where(eq(proposalPages.versionId, versionId));

  const wasCurrent = owns[0].currentVersionId === versionId;
  const nextCurrent = all.find((v) => v.id !== versionId)!.id; // 남은 최신(desc 정렬 첫 항목)

  await db.transaction(async (tx) => {
    if (wasCurrent) {
      await tx
        .update(proposalVariants)
        .set({ currentVersionId: nextCurrent })
        .where(eq(proposalVariants.id, variantId));
    }
    await tx.delete(proposalPages).where(eq(proposalPages.versionId, versionId));
    await tx.delete(proposalVersions).where(eq(proposalVersions.id, versionId));
  });

  await removeObjects([...new Set(pages.map((p) => p.path))]); // best-effort, 행 삭제 후
  await db.update(proposals).set({ updatedAt: new Date() }).where(eq(proposals.id, id));
}
