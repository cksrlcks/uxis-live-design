import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { apiTokens, cliAuthSessions } from "@drizzle/schema";
import { requireEditor } from "@/shared/auth/guards.server";
import { getOrCreateMyToken } from "@/entities/api-token/api/token.server";
import { isValidAuthId } from "../model/auth-id";
import type { CliAuthPollResult, CliAuthSessionStatus } from "../model/types";

const SESSION_TTL_MS = 10 * 60 * 1000;

// 스킬(무인증)이 호출: 승인 대기 세션 생성.
export async function createCliAuthSession(): Promise<{ authId: string; expiresIn: number }> {
  const [row] = await db
    .insert(cliAuthSessions)
    .values({ expiresAt: new Date(Date.now() + SESSION_TTL_MS) })
    .returning({ id: cliAuthSessions.id });
  return { authId: row.id, expiresIn: SESSION_TTL_MS / 1000 };
}

// 만료 판정 + lazy 삭제. 유효하면 row 반환.
async function getLiveSession(authId: string) {
  if (!isValidAuthId(authId)) return null;
  const [row] = await db
    .select()
    .from(cliAuthSessions)
    .where(eq(cliAuthSessions.id, authId))
    .limit(1);
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) {
    await db.delete(cliAuthSessions).where(eq(cliAuthSessions.id, row.id));
    return null;
  }
  return row;
}

// 스킬(무인증)이 폴링. approved/denied는 1회 반환 후 세션 삭제(토큰 재수령 불가).
export async function pollCliAuthSession(authId: string): Promise<CliAuthPollResult | null> {
  const row = await getLiveSession(authId);
  if (!row) return null;
  if (row.status === "pending") return { status: "pending" };
  if (row.status === "denied") {
    await db.delete(cliAuthSessions).where(eq(cliAuthSessions.id, row.id));
    return { status: "denied" };
  }
  // approved: 승인자 토큰 조회 → 세션 폐기(1회 수령)
  if (!row.ownerId) return null; // 방어: approved인데 승인자 없음 — 만료와 동일 취급
  const [tokenRow] = await db
    .select({ token: apiTokens.token })
    .from(apiTokens)
    .where(eq(apiTokens.ownerId, row.ownerId))
    .limit(1);
  await db.delete(cliAuthSessions).where(eq(cliAuthSessions.id, row.id));
  if (!tokenRow) return null; // 방어: 승인 후 토큰이 폐기된 경우
  return { status: "approved", token: tokenRow.token };
}

// 승인 페이지 로드용: 상태만 반환(토큰 노출·세션 소비 없음). null = 없음/만료.
export async function getCliAuthSession(
  authId: string,
): Promise<{ status: CliAuthSessionStatus } | null> {
  const row = await getLiveSession(authId);
  if (!row) return null;
  return { status: row.status as CliAuthSessionStatus };
}

// 승인(에디터): 내 토큰을 보장한 뒤 세션을 approved로 전환.
export async function approveCliAuthSession(authId: string): Promise<void> {
  const me = await requireEditor();
  const row = await getLiveSession(authId);
  if (!row || row.status !== "pending") throw new Error("NOT_FOUND");
  await getOrCreateMyToken();
  await db
    .update(cliAuthSessions)
    .set({ status: "approved", ownerId: me.id })
    .where(and(eq(cliAuthSessions.id, row.id), eq(cliAuthSessions.status, "pending")));
}

// 거부(에디터): denied로 전환 — 폴링이 만료(404)와 구분해 "취소"로 안내할 수 있게 삭제하지 않는다.
export async function denyCliAuthSession(authId: string): Promise<void> {
  await requireEditor();
  const row = await getLiveSession(authId);
  if (!row || row.status !== "pending") throw new Error("NOT_FOUND");
  await db
    .update(cliAuthSessions)
    .set({ status: "denied" })
    .where(and(eq(cliAuthSessions.id, row.id), eq(cliAuthSessions.status, "pending")));
}
