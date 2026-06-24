import { NextRequest } from "next/server";
import { pollPluginPairing } from "@/features/auth/api/plugin-auth.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

// 플러그인이 페어링 key로 폴링. 준비되면 토큰, 아니면 { status: 'pending' }. CORS/CSRF는 proxy.ts 처리.
export async function POST(req: NextRequest) {
  try {
    return Response.json(await pollPluginPairing(await req.json()));
  } catch (error) {
    return toErrorResponse(error);
  }
}
