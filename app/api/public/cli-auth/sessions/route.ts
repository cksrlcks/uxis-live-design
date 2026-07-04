import { NextRequest } from "next/server";
import { createCliAuthSession } from "@/entities/cli-auth";
import { toErrorResponse } from "@/shared/api/to-error-response";

// 스킬 웹 로그인 1단계(무인증): 승인 대기 세션 생성. 사용자가 verifyUrl을 브라우저로 열어 승인한다.
// 서버-서버(curl) 용도. 세션은 10분 뒤 만료되므로 별도 정리 배치는 두지 않는다.
export async function POST(req: NextRequest) {
  try {
    const { authId, expiresIn } = await createCliAuthSession();
    const verifyUrl = `${req.nextUrl.origin}/cli-auth/${authId}`;
    return Response.json({ authId, verifyUrl, expiresIn }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
