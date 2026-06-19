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

  const rows = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.proposalId, proposal.id))
    .orderBy(desc(chatMessages.createdAt), desc(chatMessages.id))
    .limit(INITIAL_CHAT_LIMIT);
  return rows.reverse().map((r) => ({
    id: r.id,
    authorName: r.authorName,
    authorColor: r.authorColor,
    body: r.body,
    createdAt: r.createdAt.toISOString(),
  }));
}
