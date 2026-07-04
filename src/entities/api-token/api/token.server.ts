import "server-only";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { apiTokens } from "@drizzle/schema";
import { requireAdmin } from "@/shared/auth/guards.server";
import type { MyToken } from "../model/types";

// "cova_" 접두 + 24바이트 랜덤(48 hex). 식별 쉽고 충분한 엔트로피.
function generateToken(): string {
  return `cova_${randomBytes(24).toString("hex")}`;
}

// 현재 사용자의 토큰(없으면 null). studio에서 열람용.
export async function getMyToken(): Promise<MyToken> {
  const me = await requireAdmin();
  const [row] = await db.select().from(apiTokens).where(eq(apiTokens.ownerId, me.id)).limit(1);
  if (!row) return null;
  return {
    token: row.token,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
  };
}

// 발급/재발급 — 사용자당 1개(owner_id unique)라 upsert로 교체. 새 토큰 문자열을 반환.
export async function regenerateMyToken(): Promise<{ token: string }> {
  const me = await requireAdmin();
  const token = generateToken();
  await db
    .insert(apiTokens)
    .values({ ownerId: me.id, token })
    .onConflictDoUpdate({
      target: apiTokens.ownerId,
      set: { token, createdAt: new Date(), lastUsedAt: null },
    });
  return { token };
}

// 폐기.
export async function revokeMyToken(): Promise<void> {
  const me = await requireAdmin();
  await db.delete(apiTokens).where(eq(apiTokens.ownerId, me.id));
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
