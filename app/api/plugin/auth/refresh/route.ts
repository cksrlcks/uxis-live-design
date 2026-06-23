import { NextRequest } from "next/server";
import { pluginRefresh } from "@/features/auth/api/plugin-auth.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

// 액세스 토큰 갱신.
export async function POST(req: NextRequest) {
  try {
    return Response.json(await pluginRefresh(await req.json()));
  } catch (error) {
    return toErrorResponse(error);
  }
}
