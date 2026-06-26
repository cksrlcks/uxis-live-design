import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { aiSettings } from "@drizzle/schema";
import { requireAdmin } from "@/shared/auth/guards.server";

// DB에 행이 없을 때 생성을 중단시키지 않기 위한 안전장치.
const FALLBACK_SYSTEM_PROMPT =
  "당신은 시니어 웹 디자이너 겸 프론트엔드 개발자입니다. 요구사항에 맞는 HTML 시안을 생성하세요.";

export async function getAiSystemPrompt(): Promise<string> {
  const rows = await db
    .select({ value: aiSettings.value })
    .from(aiSettings)
    .where(eq(aiSettings.key, "system_prompt"))
    .limit(1);
  return rows[0]?.value ?? FALLBACK_SYSTEM_PROMPT;
}

export async function updateAiSystemPrompt(content: string): Promise<void> {
  await requireAdmin();
  await db
    .insert(aiSettings)
    .values({ key: "system_prompt", value: content })
    .onConflictDoUpdate({
      target: aiSettings.key,
      set: { value: content, updatedAt: new Date() },
    });
}
