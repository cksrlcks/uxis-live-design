import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/shared/supabase/server";
import { isSafeInternalPath } from "@/shared/lib/safe-redirect";

// 구글 OAuth 로그인의 착지점. code를 세션으로 교환해 쿠키를 심고(= createSupabaseServer의
// 쿠키 어댑터가 응답에 반영), next로 보낸다. 실패하면 로그인 페이지에 에러를 표시한다.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next");
  const next = isSafeInternalPath(rawNext) ? rawNext : "/";

  if (code) {
    const supabase = await createSupabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, req.url));
    }
  }

  return NextResponse.redirect(new URL("/login?error=oauth", req.url));
}
