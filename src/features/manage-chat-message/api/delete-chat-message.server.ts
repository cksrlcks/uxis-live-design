import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { chatMessages } from "@drizzle/schema";
import { resolveViewerGate } from "@/shared/access/resolve-viewer-gate.server";
import type { ChatMessageDTO } from "@/entities/chat-message";

// 소프트 삭제: 행을 남기고 deletedAt만 찍는다("삭제된 메시지" 자리표시 유지).
export async function deleteChatMessage(
  publicId: string,
  messageId: string,
): Promise<ChatMessageDTO> {
  const { proposal, decision, viewer } = await resolveViewerGate(publicId);
  if (!proposal) throw new Error("NOT_FOUND");
  if (decision !== "allow") throw new Error("FORBIDDEN");
  if (!viewer) throw new Error("LOGIN_REQUIRED");

  const rows = await db
    .select()
    .from(chatMessages)
    .where(and(eq(chatMessages.id, messageId), eq(chatMessages.proposalId, proposal.id)))
    .limit(1);
  const message = rows[0];
  if (!message) throw new Error("NOT_FOUND");
  if (message.authorId !== viewer.id) throw new Error("NOT_AUTHOR");

  const deletedAt = message.deletedAt ?? new Date();
  await db.update(chatMessages).set({ deletedAt }).where(eq(chatMessages.id, messageId));
  return {
    id: message.id,
    authorId: message.authorId,
    authorName: message.authorName,
    authorColor: message.authorColor,
    body: "",
    createdAt: message.createdAt.toISOString(),
    editedAt: message.editedAt?.toISOString() ?? null,
    deletedAt: deletedAt.toISOString(),
  };
}
