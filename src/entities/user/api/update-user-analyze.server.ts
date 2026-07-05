import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { profiles } from "@drizzle/schema";
import { requireAdmin } from "@/shared/auth/guards.server";
import { updateAnalyzeSchema } from "../model/analyze-schema";

// 분석 권한 토글(관리자만). role 변경과 달리 자기 자신도 허용(권한 상승 아님, 특수 기능 부여).
export async function updateUserAnalyze(id: string, input: unknown): Promise<void> {
  await requireAdmin();
  const { allowAnalyze } = updateAnalyzeSchema.parse(input);
  await db.update(profiles).set({ allowAnalyze }).where(eq(profiles.id, id));
}
