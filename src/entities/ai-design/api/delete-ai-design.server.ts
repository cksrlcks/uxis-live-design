import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { aiDesigns } from "@drizzle/schema";
import { requireAdmin } from "@/shared/auth/guards.server";

// ai_design_tags는 FK ON DELETE CASCADE로 함께 삭제된다.
export async function deleteAiDesign(id: string): Promise<void> {
  await requireAdmin();
  await db.delete(aiDesigns).where(eq(aiDesigns.id, id));
}
