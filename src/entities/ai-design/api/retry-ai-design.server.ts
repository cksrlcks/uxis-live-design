import "server-only";
import { eq } from "drizzle-orm";
import { start } from "workflow/api";
import { db } from "@/shared/db";
import { aiDesigns } from "@drizzle/schema";
import { requireAdmin } from "@/shared/auth/guards.server";
import { generateAiDesignWorkflow } from "../workflow/generate-ai-design.workflow";

// failed/멈춘 행을 다시 working으로 되돌리고 워크플로우 재트리거.
export async function retryAiDesign(id: string): Promise<void> {
  await requireAdmin();
  const [row] = await db.select({ id: aiDesigns.id }).from(aiDesigns).where(eq(aiDesigns.id, id)).limit(1);
  if (!row) throw new Error("NOT_FOUND");
  await db
    .update(aiDesigns)
    .set({ status: "working", errorMessage: null, html: null, updatedAt: new Date() })
    .where(eq(aiDesigns.id, id));
  await start(generateAiDesignWorkflow, [id]);
}
