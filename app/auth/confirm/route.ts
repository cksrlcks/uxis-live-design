import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/shared/supabase/server";
import { isSafeInternalPath } from "@/shared/lib/safe-redirect";

// 비밀번호 재설정 메일 링크의 착지점.
// self-host 기본(PKCE) 흐름: GoTrue /auth/v1/verify가 토큰 검증 후
// ?code=... 를 붙여 이 경로로 리다이렉트한다. 여기서 code를 세션으로 교환한다.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next");
  const next = isSafeInternalPath(rawNext) ? rawNext : "/reset-password";

  if (code) {
    const supabase = await createSupabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, req.url));
    }
  }

  return NextResponse.redirect(new URL("/forgot-password?error=invalid", req.url));
}