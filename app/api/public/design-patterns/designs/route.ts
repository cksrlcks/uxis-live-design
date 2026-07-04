import { NextRequest } from "next/server";
import { saveGeneratedDesign } from "@/entities/design-analysis/api/save-generated-design.server";
import { validateApiToken } from "@/entities/api-token/api/token.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

// (옵션) 생성된 HTML 시안을 실서비스 ai_designs에 저장 → studio 목록/뷰어에서 열람.
// 쓰기 보호: 헤더 x-design-token을 studio에서 발급한 개인 API 토큰과 대조(DB). 유효하지 않으면 401.
// 저장된 시안은 토큰 소유자에게 귀속(created_by). 조회(GET)는 무인증 공개 유지.
// 서버-서버(curl) 용도 — 브라우저 CORS는 public 브랜치가 GET만 허용한다.
export async function POST(req: NextRequest) {
  try {
    const ownerId = await validateApiToken(req.headers.get("x-design-token"));
    if (!ownerId) throw new Error("UNAUTHORIZED");
    const body = await req.json();
    const { id } = await saveGeneratedDesign({ ...body, createdBy: ownerId });
    return Response.json({ id, viewerPath: `/studio/ai-designs/${id}/raw` });
  } catch (error) {
    return toErrorResponse(error);
  }
}
