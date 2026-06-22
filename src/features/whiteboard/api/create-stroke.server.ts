import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { whiteboardStrokes, proposalVariants, proposalVersions, proposalPages } from "@drizzle/schema";
import { resolveViewerGate } from "@/shared/access/resolve-viewer-gate.server";
import { createStrokeInputSchema } from "@/entities/whiteboard";
import type { StrokeDTO } from "@/entities/whiteboard";

export async function createStroke(publicId: string, raw: unknown): Promise<StrokeDTO> {
  // 게스트도 그릴 수 있다(채팅과 동일) — getProfile이 아닌 viewer gate만 통과시킨다.
  const { proposal, decision, viewer } = await resolveViewerGate(publicId);
  if (!proposal) throw new Error("NOT_FOUND");
  if (decision !== "allow") throw new Error("FORBIDDEN");

  const { variantId, versionId, pageOrder, points, color, width, authorName, authorColor } =
    createStrokeInputSchema.parse(raw);

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

  // 로그인 사용자면 author_id를 박는다(게스트는 null). 누구나 삭제 가능이라 소유권엔 쓰이지 않고 표기용.
  const authorId = viewer?.id ?? null;
  const id = randomUUID();
  const createdAt = new Date();
  await db.insert(whiteboardStrokes).values({
    id,
    proposalId: proposal.id,
    variantId,
    versionId,
    pageOrder,
    points,
    color,
    width,
    authorId,
    authorName,
    authorColor,
    createdAt,
  });
  return {
    id,
    variantId,
    versionId,
    pageOrder,
    points,
    color,
    width,
    authorId,
    authorName,
    authorColor,
    createdAt: createdAt.toISOString(),
  };
}
