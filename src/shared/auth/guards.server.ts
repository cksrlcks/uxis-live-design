import "server-only";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { profiles, type Profile } from "@drizzle/schema";
import { createSupabaseServer } from "@/shared/supabase/server";
import { createSupabaseService } from "@/shared/supabase/service";
import { isEditor, isAdmin, type Role } from "@/shared/auth/roles";

export async function getSessionUser() {
  // Bearer 경로: 쿠키를 못 쓰는 클라이언트(피그마 플러그인 등)는
  // `Authorization: Bearer <supabase access token>`로 인증한다. 토큰이 있으면 우선 검증하고,
  // 없으면 웹 앱의 쿠키 세션으로 폴백한다.
  const authorization = (await headers()).get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    return getBearerUser(authorization.slice("Bearer ".length).trim());
  }

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getUser();
  // "AuthSessionMissingError" is the normal not-signed-in case — don't log it.
  // Log only unexpected failures (network, invalid JWT) so they're observable.
  if (error && error.name !== "AuthSessionMissingError") {
    console.error("[auth] getUser error:", error.message);
  }
  return data.user; // null if not signed in
}

// Bearer 액세스 토큰을 GoTrue로 검증한다. 서명·만료가 유효하면 사용자, 아니면 null.
// 만료·위조 토큰은 흔한 클라이언트 오류이므로 로깅하지 않는다(비로그인과 동일 취급).
async function getBearerUser(token: string) {
  if (!token) return null;
  const { data } = await createSupabaseService().auth.getUser(token);
  return data.user;
}

export async function getProfile(): Promise<Profile | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const rows = await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1);
  return rows[0] ?? null;
}

// 미인증(토큰 없음/만료/위조)과 권한 부족을 구분한다.
// 미인증은 LOGIN_REQUIRED(401) — Bearer 클라이언트(피그마 플러그인)가 401에서만
// 토큰 리프레시 후 재시도하므로, 만료 토큰을 403으로 내리면 리프레시가 영영 안 돈다.
// 인증됐으나 권한이 없으면 FORBIDDEN(403).
export async function requireEditor(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) throw new Error("LOGIN_REQUIRED");
  if (!isEditor(profile.role as Role)) throw new Error("FORBIDDEN");
  return profile;
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) throw new Error("LOGIN_REQUIRED");
  if (!isAdmin(profile.role as Role)) throw new Error("FORBIDDEN");
  return profile;
}
