import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { whiteboardStrokes } from "@drizzle/schema";
import { resolveViewerGate } from "@/shared/access/resolve-viewer-gate.server";

// 공유 화이트보드 — 방에 접근 가능한 누구나(게스트 포함) 어떤 stroke든 지울 수 있다.
// 소유권 검사 없음(핀 코멘트와 다른 지점). proposal 스코프 내로만 한정한다.
export async function deleteStroke(publicId: string, strokeId: string): Promise<{ id: string }> {
  const { proposal, decision } = await resolveViewerGate(publicId);
  if (!proposal) throw new Error("NOT_FOUND");
  if (decision !== "allow") throw new Error("FORBIDDEN");

  const rows = await db
    .select({ id: whiteboardStrokes.id })
    .from(whiteboardStrokes)
    .where(and(eq(whiteboardStrokes.id, strokeId), eq(whiteboardStrokes.proposalId, proposal.id)))
    .limit(1);
  if (rows.length === 0) throw new Error("NOT_FOUND");
  await db.delete(whiteboardStrokes).where(eq(whiteboardStrokes.id, strokeId));
  return { id: strokeId };
}
