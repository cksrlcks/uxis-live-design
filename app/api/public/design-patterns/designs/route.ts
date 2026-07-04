import { NextRequest } from "next/server";
import { saveGeneratedDesign } from "@/entities/design-analysis/api/save-generated-design.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

// (옵션) 생성된 HTML 시안을 실서비스 ai_designs에 저장 → studio 목록/뷰어에서 열람.
// 쓰기 보호(fail-closed): DESIGN_WRITE_TOKEN env가 설정돼 있고 헤더 x-design-token이 일치할 때만 허용.
// env 미설정이면 저장 API는 비활성(항상 401) — 실수로 공개 쓰기가 열려있지 않도록. 조회(GET)는 무인증 유지.
// 서버-서버(curl) 용도 — 브라우저 CORS는 public 브랜치가 GET만 허용한다.
export async function POST(req: NextRequest) {
  try {
    const configured = process.env.DESIGN_WRITE_TOKEN;
    if (!configured || req.headers.get("x-design-token") !== configured) {
      throw new Error("UNAUTHORIZED");
    }
    const body = await req.json();
    const { id } = await saveGeneratedDesign(body);
    return Response.json({ id, viewerPath: `/studio/ai-designs/${id}/raw` });
  } catch (error) {
    return toErrorResponse(error);
  }
}
