import { NextRequest } from "next/server";
import { pollCliAuthSession } from "@/entities/cli-auth";
import { toErrorResponse } from "@/shared/api/to-error-response";

// 스킬 웹 로그인 2단계(무인증 폴링). approved 응답은 1회뿐 — 토큰 수령 즉시 세션이 삭제된다.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ authId: string }> },
) {
  try {
    const { authId } = await params;
    const result = await pollCliAuthSession(authId);
    if (!result) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
    return Response.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
