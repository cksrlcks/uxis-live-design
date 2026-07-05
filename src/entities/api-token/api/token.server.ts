import "server-only";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { apiTokens } from "@drizzle/schema";
import { requireEditor } from "@/shared/auth/guards.server";

// "cova_" 접두 + 24바이트 랜덤(48 hex). 식별 쉽고 충분한 엔트로피.
function generateToken(): string {
  return `cova_${randomBytes(24).toString("hex")}`;
}

// CLI 승인용: 있으면 그대로, 없을 때만 생성. 기존 토큰을 무효화하지 않는다.
export async function getOrCreateMyToken(): Promise<{ token: string }> {
  const me = await requireEditor();
  const [existing] = await db
    .select({ token: apiTokens.token })
    .from(apiTokens)
    .where(eq(apiTokens.ownerId, me.id))
    .limit(1);
  if (existing) return { token: existing.token };
  const token = generateToken();
  // 동시 승인 경쟁 시 한쪽만 insert되도록 하고, 진 쪽은 재조회로 수렴.
  await db.insert(apiTokens).values({ ownerId: me.id, token }).onConflictDoNothing({
    target: apiTokens.ownerId,
  });
  const [row] = await db
    .select({ token: apiTokens.token })
    .from(apiTokens)
    .where(eq(apiTokens.ownerId, me.id))
    .limit(1);
  // 왜: 경쟁 승자의 토큰이 그 사이 폐기된 극단 케이스 — row가 없으면 재조회로도 복구 불가.
  if (!row) throw new Error("NOT_FOUND");
  return { token: row.token };
}

// 저장 API 인증: 토큰으로 소유자 조회 + last_used_at 갱신. 유효하면 owner_id, 아니면 null.
// (guard 없음 — 이 함수 자체가 토큰으로 인증한다.)
export async function validateApiToken(token: string | null | undefined): Promise<string | null> {
  if (!token) return null;
  const [row] = await db
    .select({ id: apiTokens.id, ownerId: apiTokens.ownerId })
    .from(apiTokens)
    .where(eq(apiTokens.token, token))
    .limit(1);
  if (!row) return null;
  await db.update(apiTokens).set({ lastUsedAt: new Date() }).where(eq(apiTokens.id, row.id));
  return row.ownerId;
}
