import { NextRequest } from "next/server";
import { approveCliAuthSession, denyCliAuthSession } from "@/entities/cli-auth";
import { toErrorResponse } from "@/shared/api/to-error-response";

// 승인 페이지의 버튼이 호출(세션 쿠키 인증 — 엔티티의 requireEditor가 가드).
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ authId: string }> },
) {
  try {
    await approveCliAuthSession((await params).authId);
    return new Response(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ authId: string }> },
) {
  try {
    await denyCliAuthSession((await params).authId);
    return new Response(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
