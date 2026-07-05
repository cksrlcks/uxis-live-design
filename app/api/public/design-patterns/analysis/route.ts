import { NextRequest } from "next/server";
import { requireAnalyst } from "@/entities/design-analysis/api/require-analyst.server";
import { getPageIdentity } from "@/entities/design-analysis/api/get-page-identity.server";
import { saveAnalysis } from "@/entities/design-analysis/api/analysis-mutations.server";
import { parsePageAnalysis } from "@/entities/design-analysis/model/schemas";
import { saveRequestSchema } from "@/entities/design-analysis/model/analysis-request-schema";
import { toErrorResponse } from "@/shared/api/to-error-response";

// 분석 결과 저장(인증+allow_analyze). pageId로 귀속을 서버 재조회해 무결성을 지키고,
// overall/sections는 parsePageAnalysis로 관대하게 검증(목록 밖 값 드롭) 후 saveAnalysis(upsert).
export async function POST(req: NextRequest) {
  try {
    await requireAnalyst(req.headers.get("x-design-token"));
    const { model, analyses } = saveRequestSchema.parse(await req.json());
    let saved = 0;
    const skipped: { pageId: string; reason: string }[] = [];
    for (const item of analyses) {
      const page = await getPageIdentity(item.pageId);
      if (!page) {
        skipped.push({ pageId: item.pageId, reason: "unknown pageId" });
        continue;
      }
      const result = parsePageAnalysis({ overall: item.overall, sections: item.sections });
      await saveAnalysis(page, result, model);
      saved += 1;
    }
    return Response.json({ saved, skipped });
  } catch (error) {
    return toErrorResponse(error);
  }
}
