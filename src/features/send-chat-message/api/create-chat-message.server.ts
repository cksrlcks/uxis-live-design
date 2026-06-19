import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "@/shared/db";
import { chatMessages } from "@drizzle/schema";
import { resolveViewerGate } from "@/shared/access/resolve-viewer-gate.server";
import { createChatInputSchema } from "@/entities/chat-message";
import type { ChatMessageDTO } from "@/entities/chat-message";

export async function createChatMessage(publicId: string, raw: unknown): Promise<ChatMessageDTO> {
  const { proposal, decision } = await resolveViewerGate(publicId);
  if (!proposal) throw new Error("NOT_FOUND");
  if (decision !== "allow") throw new Error("FORBIDDEN");

  const { body, authorName, authorColor } = createChatInputSchema.parse(raw);

  const id = randomUUID();
  const createdAt = new Date();
  await db
    .insert(chatMessages)
    .values({ id, proposalId: proposal.id, authorName, authorColor, body, createdAt });
  return { id, authorName, authorColor, body, createdAt: createdAt.toISOString() };
}
