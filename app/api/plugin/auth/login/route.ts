import { NextRequest } from "next/server";
import { pluginLogin } from "@/features/auth/api/plugin-auth.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

// 플러그인 로그인 — 토큰을 본문으로 반환(쿠키 미사용).
export async function POST(req: NextRequest) {
  try {
    return Response.json(await pluginLogin(await req.json()));
  } catch (error) {
    return toErrorResponse(error);
  }
}
