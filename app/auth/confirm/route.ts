import { NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServer } from "@/shared/supabase/server";
import { isSafeInternalPath } from "@/shared/lib/safe-redirect";

// 비밀번호 재설정 메일 링크의 착지점. token_hash를 verifyOtp로 검증해 recovery 세션 쿠키를
// 심고(= createSupabaseServer의 쿠키 어댑터가 응답에 반영), next로 보낸다.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const rawNext = searchParams.get("next");
  const next = isSafeInternalPath(rawNext) ? rawNext : "/reset-password";

  if (tokenHash && type) {
    const supabase = await createSupabaseServer();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(new URL(next, req.url));
    }
  }

  return NextResponse.redirect(new URL("/forgot-password?error=invalid", req.url));
}
