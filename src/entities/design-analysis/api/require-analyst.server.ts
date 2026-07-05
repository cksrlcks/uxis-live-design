import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { profiles } from "@drizzle/schema";
import { validateApiToken } from "@/entities/api-token/api/token.server";

// x-design-token으로 소유자를 인증하고 allow_analyze 권한을 확인한다.
// 토큰 없음/무효 → UNAUTHORIZED(401), 권한 없음 → FORBIDDEN(403). 통과 시 ownerId.
export async function requireAnalyst(token: string | null | undefined): Promise<string> {
  const ownerId = await validateApiToken(token);
  if (!ownerId) throw new Error("UNAUTHORIZED");
  const [me] = await db
    .select({ allowAnalyze: profiles.allowAnalyze })
    .from(profiles)
    .where(eq(profiles.id, ownerId))
    .limit(1);
  if (!me?.allowAnalyze) throw new Error("FORBIDDEN");
  return ownerId;
}
