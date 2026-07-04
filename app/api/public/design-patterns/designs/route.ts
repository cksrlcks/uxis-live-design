import { NextRequest } from "next/server";
import { saveGeneratedDesign } from "@/entities/design-analysis/api/save-generated-design.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

// (옵션) 생성된 HTML 시안을 실서비스 ai_designs에 저장 → studio 목록/뷰어에서 열람.
// 쓰기 보호: DESIGN_WRITE_TOKEN env가 설정돼 있으면 헤더 x-design-token 일치를 요구하고,
// 없으면 공개(무인증). 서버-서버(curl) 용도 — 브라우저 CORS는 public 브랜치가 GET만 허용한다.
export async function POST(req: NextRequest) {
  try {
    const required = process.env.DESIGN_WRITE_TOKEN;
    if (required && req.headers.get("x-design-token") !== required) {
      throw new Error("UNAUTHORIZED");
    }
    const body = await req.json();
    const { id } = await saveGeneratedDesign(body);
    return Response.json({ id, viewerPath: `/studio/ai-designs/${id}/raw` });
  } catch (error) {
    return toErrorResponse(error);
  }
}
