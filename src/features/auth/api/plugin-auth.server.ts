import "server-only";
import { createClient, type Session } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/shared/db";
import { profiles } from "@drizzle/schema";
import { loginSchema } from "../model/schema";

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

// 이메일/비밀번호 로그인 → 액세스·리프레시 토큰을 본문으로 반환. 권한(editor) 검증은
// 각 작업 라우트의 requireEditor가 하므로 여기서는 인증만 하고 role을 함께 돌려준다.
export async function pluginLogin(input: unknown) {
  const { email, password } = loginSchema.parse(input);
  const { data, error } = await authClient().auth.signInWithPassword({ email, password });
  if (error || !data.session || !data.user) {
    if (error?.status === 429) throw new Error("RATE_LIMITED");
    throw new Error("INVALID_CREDENTIALS");
  }

  const rows = await db.select().from(profiles).where(eq(profiles.id, data.user.id)).limit(1);
  const profile = rows[0];
  return {
    ...tokens(data.session),
    user: {
      id: data.user.id,
      email: data.user.email ?? null,
      name: profile?.displayName ?? null,
      role: profile?.role ?? null, // 'pending' | 'editor' | 'admin'
    },
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
