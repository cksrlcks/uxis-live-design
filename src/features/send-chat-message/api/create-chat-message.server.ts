import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "@/shared/db";
import { chatMessages } from "@drizzle/schema";
import { resolveViewerGate } from "@/shared/access/resolve-viewer-gate.server";
import { createChatInputSchema } from "@/entities/chat-message";
import type { ChatMessageDTO } from "@/entities/chat-message";

export async function createChatMessage(publicId: string, raw: unknown): Promise<ChatMessageDTO> {
  const { proposal, decision, viewer } = await resolveViewerGate(publicId);
  if (!proposal) throw new Error("NOT_FOUND");
  if (decision !== "allow") throw new Error("FORBIDDEN");
  // 라이브 모드 OFF → 협업 쓰기를 서버에서 거부(클라이언트 우회 차단).
  if (!proposal.liveMode) throw new Error("FORBIDDEN");

  const { body, authorName, authorColor } = createChatInputSchema.parse(raw);

  // 로그인 사용자면 authorId를 박아 소유권 기준으로 삼는다(게스트는 null → 수정/삭제 불가).
  const authorId = viewer?.id ?? null;

  const id = randomUUID();
  const createdAt = new Date();
  await db
    .insert(chatMessages)
    .values({ id, proposalId: proposal.id, authorId, authorName, authorColor, body, createdAt });
  return {
    id,
    authorId,
    authorName,
    authorColor,
    body,
    createdAt: createdAt.toISOString(),
    editedAt: null,
    deletedAt: null,
  };
}
