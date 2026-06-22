import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { chatMessages } from "@drizzle/schema";
import { resolveViewerGate } from "@/shared/access/resolve-viewer-gate.server";
import { editChatInputSchema } from "@/entities/chat-message";
import type { ChatMessageDTO } from "@/entities/chat-message";

function toDTO(r: typeof chatMessages.$inferSelect): ChatMessageDTO {
  return {
    id: r.id,
    authorId: r.authorId,
    authorName: r.authorName,
    authorColor: r.authorColor,
    body: r.deletedAt ? "" : r.body,
    createdAt: r.createdAt.toISOString(),
    editedAt: r.editedAt?.toISOString() ?? null,
    deletedAt: r.deletedAt?.toISOString() ?? null,
  };
}

export async function updateChatMessage(
  publicId: string,
  messageId: string,
  raw: unknown,
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
  if (message.deletedAt) throw new Error("ALREADY_DELETED");

  const { body } = editChatInputSchema.parse(raw);
  const editedAt = new Date();
  await db.update(chatMessages).set({ body, editedAt }).where(eq(chatMessages.id, messageId));
  return toDTO({ ...message, body, editedAt });
}
