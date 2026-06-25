import "server-only";
import { eq } from "drizzle-orm";
import { after } from "next/server";
import { db } from "@/shared/db";
import { aiDesigns } from "@drizzle/schema";
import { requireAdmin } from "@/shared/auth/guards.server";
import { runGeneration } from "./run-generation.server";

// failed/멈춘 행을 다시 working으로 되돌리고 생성을 after로 재실행.
export async function retryAiDesign(id: string): Promise<void> {
  await requireAdmin();
  const [row] = await db.select({ id: aiDesigns.id, status: aiDesigns.status }).from(aiDesigns).where(eq(aiDesigns.id, id)).limit(1);
  if (!row) throw new Error("NOT_FOUND");
  // 이미 working 중이면 중복 트리거 방지 — 아무것도 하지 않고 반환.
  if (row.status === "working") return;
  await db
    .update(aiDesigns)
    .set({ status: "working", errorMessage: null, html: null, updatedAt: new Date() })
    .where(eq(aiDesigns.id, id));
  after(() => runGeneration(id));
}
