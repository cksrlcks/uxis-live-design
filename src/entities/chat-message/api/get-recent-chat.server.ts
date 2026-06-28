import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { chatMessages } from "@drizzle/schema";
import { resolveViewerGate } from "@/shared/access/resolve-viewer-gate.server";
import type { ChatMessageDTO } from "../model/types";

const INITIAL_CHAT_LIMIT = 50;

export async function getRecentChat(publicId: string): Promise<ChatMessageDTO[]> {
  const { proposal, decision } = await resolveViewerGate(publicId);
  if (!proposal) throw new Error("NOT_FOUND");
  if (decision !== "allow") throw new Error("FORBIDDEN");
  // 라이브 모드 OFF → 협업 데이터를 일절 제공하지 않는다(클라이언트 우회 차단).
  if (!proposal.liveMode) return [];

  const rows = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.proposalId, proposal.id))
    .orderBy(desc(chatMessages.createdAt), desc(chatMessages.id))
    .limit(INITIAL_CHAT_LIMIT);
  return rows.reverse().map((r) => ({
    id: r.id,
    authorId: r.authorId,
    authorName: r.authorName,
    // 삭제된 메시지의 원문은 클라이언트로 내보내지 않는다(빈 문자열).
    body: r.deletedAt ? "" : r.body,
    authorColor: r.authorColor,
    createdAt: r.createdAt.toISOString(),
    editedAt: r.editedAt?.toISOString() ?? null,
    deletedAt: r.deletedAt?.toISOString() ?? null,
  }));
}
