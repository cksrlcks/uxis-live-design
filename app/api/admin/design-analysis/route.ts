import { getAnalysisOverview } from "@/entities/design-analysis/api/get-analysis-overview.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

// 분석 데이터 뷰어(admin) — analyzed된 페이지 + 섹션.
export async function GET() {
  try {
    return Response.json(await getAnalysisOverview());
  } catch (error) {
    return toErrorResponse(error);
  }
}
