import { NextRequest, NextResponse } from "next/server";
import { getGoogleOAuthUrl } from "@/features/auth/api/auth.server";
import { isSafeInternalPath } from "@/shared/lib/safe-redirect";

// 구글 로그인 시작점. 동의 화면 URL을 받아 그쪽으로 redirect한다. 이때 getGoogleOAuthUrl이
// 심은 PKCE 쿠키가 응답에 함께 실려 나가야 callback에서 code 교환이 성공한다.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawNext = searchParams.get("next");
  const next = isSafeInternalPath(rawNext) ? rawNext : "/";

  try {
    const url = await getGoogleOAuthUrl(next);
    return NextResponse.redirect(url);
  } catch {
    return NextResponse.redirect(new URL("/login?error=oauth", req.url));
  }
}
