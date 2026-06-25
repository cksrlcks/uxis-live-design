import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { aiDesigns } from "@drizzle/schema";
import { requireAdmin } from "@/shared/auth/guards.server";

// raw 뷰어용. 행이 없으면 NOT_FOUND, 아직 생성 전이면 NOT_FOUND(뷰어는 done일 때만 연다).
export async function getAiDesignHtml(id: string): Promise<string> {
  await requireAdmin();
  const [row] = await db.select({ html: aiDesigns.html }).from(aiDesigns).where(eq(aiDesigns.id, id)).limit(1);
  if (!row || !row.html) throw new Error("NOT_FOUND");
  return row.html;
}
