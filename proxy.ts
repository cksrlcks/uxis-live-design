import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isSameOrigin } from "@/shared/api/same-origin";

// 플러그인 네임스페이스(/api/plugin/*)는 쿠키가 아닌 Bearer 토큰으로만 인증하는
// 교차 출처(cross-origin) 표면이다. 피그마 플러그인 등 비브라우저 클라이언트가 호출하므로
// CORS 프리플라이트를 허용한다. Bearer는 브라우저가 자동으로 싣지 않는 명시적 자격증명이라
// CSRF 위험이 없어 동일 출처(CSRF) 검사에서도 제외한다. 쿠키 자격증명을 받지 않으니
// 와일드카드 Origin(*) 을 안전하게 허용할 수 있다.
const PLUGIN_CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
};

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // 플러그인 표면: 프리플라이트는 즉시 응답하고, 그 외에는 CORS 헤더만 달아 통과시킨다.
  // CSRF 동일 출처 검사와 쿠키 세션 처리는 적용하지 않는다(Bearer 전용).
  if (path.startsWith("/api/plugin/")) {
    if (request.method === "OPTIONS") {
      return new NextResponse(null, { status: 204, headers: PLUGIN_CORS });
    }
    const response = NextResponse.next({ request });
    for (const [key, value] of Object.entries(PLUGIN_CORS)) response.headers.set(key, value);
    return response;
  }

  // CSRF: reject cross-origin state-changing requests to our API (cookie-session protection).
  const method = request.method;
  const isMutation =
    method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE";
  if (path.startsWith("/api/") && isMutation) {
    if (!isSameOrigin(request.headers.get("origin"), request.headers.get("host"))) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protect the studio area: unauthenticated -> /login
  if (path.startsWith("/studio")) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|fonts|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)"],
};
