import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { whiteboardStrokes, proposalVariants, proposalVersions, proposalPages } from "@drizzle/schema";
import { resolveViewerGate } from "@/shared/access/resolve-viewer-gate.server";
import { getProfile } from "@/shared/auth/guards.server";
import { layerUpsertInputSchema } from "@/entities/whiteboard";

// 내 레이어(한 사용자×페이지의 획 전체)를 idempotent upsert. 로그인 필수 + 본인 row만.
// strokes가 비면 내 레이어 삭제. author_id/author_name은 세션에서만(위조 불가).
export async function upsertLayer(publicId: string, raw: unknown): Promise<{ ok: true }> {
  const { proposal, decision } = await resolveViewerGate(publicId);
  if (!proposal) throw new Error("NOT_FOUND");
  if (decision !== "allow") throw new Error("FORBIDDEN");
  const profile = await getProfile();
  if (!profile) throw new Error("LOGIN_REQUIRED");

  const { variantId, versionId, pageOrder, strokes, authorColor } =
    layerUpsertInputSchema.parse(raw);

  const v = await db
    .select({ id: proposalVariants.id })
    .from(proposalVariants)
    .where(and(eq(proposalVariants.id, variantId), eq(proposalVariants.proposalId, proposal.id)))
    .limit(1);
  if (v.length === 0) throw new Error("NOT_FOUND");
  const ver = await db
    .select({ id: proposalVersions.id })
    .from(proposalVersions)
    .where(and(eq(proposalVersions.id, versionId), eq(proposalVersions.variantId, variantId)))
    .limit(1);
  if (ver.length === 0) throw new Error("NOT_FOUND");
  const pg = await db
    .select({ id: proposalPages.id })
    .from(proposalPages)
    .where(and(eq(proposalPages.versionId, versionId), eq(proposalPages.pageOrder, pageOrder)))
    .limit(1);
  if (pg.length === 0) throw new Error("BAD_PAGE");

  const authorName = profile.displayName ?? profile.email.split("@")[0] ?? "사용자";

  // 빈 배열 = 내 레이어 삭제(소유권 키로만 한정 → 남의 레이어 못 건드림).
  if (strokes.length === 0) {
    await db
      .delete(whiteboardStrokes)
      .where(
        and(
          eq(whiteboardStrokes.authorId, profile.id),
          eq(whiteboardStrokes.variantId, variantId),
          eq(whiteboardStrokes.versionId, versionId),
          eq(whiteboardStrokes.pageOrder, pageOrder),
        ),
      );
    return { ok: true };
  }

  const now = new Date();
  await db
    .insert(whiteboardStrokes)
    .values({
      proposalId: proposal.id,
      variantId,
      versionId,
      pageOrder,
      authorId: profile.id,
      authorName,
      authorColor,
      strokes,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        whiteboardStrokes.authorId,
        whiteboardStrokes.variantId,
        whiteboardStrokes.versionId,
        whiteboardStrokes.pageOrder,
      ],
      set: { strokes, authorName, authorColor, updatedAt: now },
    });
  return { ok: true };
}
