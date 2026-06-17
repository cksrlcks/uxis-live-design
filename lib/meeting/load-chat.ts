import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { chatMessages } from "@/drizzle/schema";
import type { ChatMessageDTO } from "@/lib/meeting/types";

const INITIAL_CHAT_LIMIT = 50;

// 한 시안의 최근 메시지 N개를 오래된→최신(렌더) 순으로 DTO 반환. DB Date → ISO 문자열.
export async function loadRecentChat(proposalId: string): Promise<ChatMessageDTO[]> {
  const rows = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.proposalId, proposalId))
    .orderBy(desc(chatMessages.createdAt))
    .limit(INITIAL_CHAT_LIMIT);
  return rows
    .reverse()
    .map((r) => ({
      id: r.id,
      authorName: r.authorName,
      authorColor: r.authorColor,
      body: r.body,
      createdAt: r.createdAt.toISOString(),
    }));
}
