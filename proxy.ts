import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isSameOrigin } from "@/shared/api/same-origin";

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // CSRF: reject cross-origin state-changing requests to our API.
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
