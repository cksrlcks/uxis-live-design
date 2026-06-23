import "server-only";
import { headers } from "next/headers";
import { createSupabaseServer } from "@/shared/supabase/server";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
} from "../model/schema";
import { signupErrorCode } from "./signup-error";

export async function signIn(input: unknown): Promise<void> {
  const { email, password } = loginSchema.parse(input);
  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.status === 429) throw new Error("RATE_LIMITED");
    throw new Error("INVALID_CREDENTIALS");
  }
}

export async function signUp(input: unknown): Promise<void> {
  const { name, email, password } = signupSchema.parse(input);
  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: name } },
  });
  if (error) {
    if (error.status === 429) throw new Error("RATE_LIMITED");
    throw new Error(signupErrorCode(error));
  }
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
}

// 구글 OAuth 동의 화면 URL을 만든다. PKCE code-verifier 쿠키는 서버 클라이언트의
// 쿠키 어댑터가 응답에 심고(skipBrowserRedirect로 즉시 리다이렉트는 막음), 호출한
// 라우트가 반환된 url로 직접 redirect한다. 착지점은 /auth/callback?next=...이다.
export async function getGoogleOAuthUrl(next: string): Promise<string> {
  const supabase = await createSupabaseServer();
  const redirectTo = `${await resolveOrigin()}/auth/callback?next=${encodeURIComponent(next)}`;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data.url) throw new Error("OAUTH_INIT_FAILED");
  return data.url;
}

// 이메일 재설정 링크의 베이스 URL. 요청 Origin을 우선 쓰고(로컬·운영 무관), 없으면
// Host 헤더, 마지막으로 NEXT_PUBLIC_SITE_URL로 폴백한다.
async function resolveOrigin(): Promise<string> {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("host");
  if (host) return `${h.get("x-forwarded-proto") ?? "https"}://${host}`;
  return process.env.NEXT_PUBLIC_SITE_URL ?? "";
}

export async function requestPasswordReset(input: unknown): Promise<void> {
  const { email } = forgotPasswordSchema.parse(input);
  const supabase = await createSupabaseServer();
  const redirectTo = `${await resolveOrigin()}/auth/confirm`;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  // 레이트 리밋만 노출. 그 외 에러는 삼켜 호출자가 이메일 존재 여부를 추측하지 못하게 한다.
  if (error?.status === 429) throw new Error("RATE_LIMITED");
}

export async function resetPassword(input: unknown): Promise<void> {
  const { newPassword } = resetPasswordSchema.parse(input);
  const supabase = await createSupabaseServer();

  // recovery 세션(=verifyOtp 성공)이 있어야만 갱신 가능.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("UNAUTHORIZED");

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    if (error.status === 429) throw new Error("RATE_LIMITED");
    if (error.code === "same_password") throw new Error("SAME_PASSWORD");
    if (error.code === "weak_password") throw new Error("WEAK_PASSWORD");
    throw new Error("PASSWORD_UPDATE_FAILED");
  }

  // recovery 세션은 역할을 다했으니 종료 → 새 비밀번호로 재로그인하게 한다.
  await supabase.auth.signOut();
}

export async function changePassword(input: unknown): Promise<void> {
  const { currentPassword, newPassword } = changePasswordSchema.parse(input);
  const supabase = await createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) throw new Error("UNAUTHORIZED");

  // Supabase updateUser doesn't verify the old password — re-authenticate first so a
  // hijacked session can't silently change the password.
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (signInError) {
    if (signInError.status === 429) throw new Error("RATE_LIMITED");
    throw new Error("INVALID_CREDENTIALS");
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    if (error.status === 429) throw new Error("RATE_LIMITED");
    if (error.code === "same_password") throw new Error("SAME_PASSWORD");
    if (error.code === "weak_password") throw new Error("WEAK_PASSWORD");
    throw new Error("PASSWORD_UPDATE_FAILED");
  }
}
