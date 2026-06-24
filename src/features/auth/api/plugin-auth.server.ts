import "server-only";
import { createClient, type Session } from "@supabase/supabase-js";
import { eq, lt } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/shared/db";
import { profiles, pluginAuthPairings } from "@drizzle/schema";
import { createSupabaseServer } from "@/shared/supabase/server";

// 쿠키에 세션을 심지 않는 인증 전용 클라이언트. 토큰을 응답 본문으로 돌려주어
// 플러그인이 figma.clientStorage에 직접 보관하게 한다(웹 앱의 Set-Cookie 경로와 분리).
function authClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

const refreshSchema = z.object({ refreshToken: z.string().min(1) });

const PAIRING_TTL_MS = 5 * 60 * 1000;
const pollSchema = z.object({ key: z.string().min(1).max(200) });

// 외부 브라우저에서 로그인된 쿠키 세션을 읽어, 플러그인이 폴링으로 회수할 토큰을 key로 임시 저장한다.
// getUser로 진위를 검증한 뒤 getSession으로 토큰을 얻는다. 미로그인이면 false(호출 페이지가 로그인으로 보냄).
export async function storePluginPairing(key: string): Promise<boolean> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  // getUser() 성공 시 세션은 사실상 항상 존재하지만 타입 안전을 위해 검사한다.
  // key는 플러그인이 생성해 외부에서 주입할 수 없으므로 세션 고정(fixation) 위험이 없다.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return false;

  const rows = await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1);
  const profile = rows[0];
  const payload = {
    ...tokens(session),
    user: {
      id: user.id,
      email: user.email ?? null,
      name: profile?.displayName ?? null,
      role: profile?.role ?? null,
    },
  };
  const expiresAt = new Date(Date.now() + PAIRING_TTL_MS);
  await db
    .insert(pluginAuthPairings)
    .values({ key, payload, expiresAt })
    .onConflictDoUpdate({ target: pluginAuthPairings.key, set: { payload, expiresAt } });
  return true;
}

// 플러그인이 key로 폴링. 준비되면 토큰(로그인 응답과 동일 shape) 반환 + 즉시 삭제(1회용), 아니면 pending.
// 매 호출 시 만료 행을 베스트에포트로 정리한다.
export async function pollPluginPairing(input: unknown) {
  const { key } = pollSchema.parse(input);
  await db.delete(pluginAuthPairings).where(lt(pluginAuthPairings.expiresAt, new Date()));
  const rows = await db
    .select()
    .from(pluginAuthPairings)
    .where(eq(pluginAuthPairings.key, key))
    .limit(1);
  const row = rows[0];
  if (!row) return { status: "pending" as const };
  await db.delete(pluginAuthPairings).where(eq(pluginAuthPairings.key, key));
  return row.payload as {
    accessToken: string;
    refreshToken: string;
    expiresAt: unknown;
    user: { id: string; email: string | null; name: string | null; role: string | null };
  };
}

// 리프레시 토큰으로 새 액세스 토큰 발급. 액세스 토큰은 수명이 짧으므로 만료 전 갱신한다.
export async function pluginRefresh(input: unknown) {
  const { refreshToken } = refreshSchema.parse(input);
  const { data, error } = await authClient().auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session) throw new Error("INVALID_CREDENTIALS");
  return tokens(data.session);
}

function tokens(session: Session) {
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at ?? null, // unix seconds
  };
}
