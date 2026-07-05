import { NextRequest } from "next/server";
import { requireAnalyst } from "@/entities/design-analysis/api/require-analyst.server";
import { listPendingPages } from "@/entities/design-analysis/api/list-pending-pages.server";
import { pendingRequestSchema } from "@/entities/design-analysis/model/analysis-request-schema";
import { publicUrl } from "@/shared/lib/proposals/constants";
import { toErrorResponse } from "@/shared/api/to-error-response";

// 분석 대기목록 조회(인증+allow_analyze). mode=pending(미분석) | reanalyze(proposalId 강제 재분석).
// 페이지별 이미지 공개 URL을 함께 반환해 스킬이 로컬로 내려받아 vision 분석하게 한다.
export async function POST(req: NextRequest) {
  try {
    await requireAnalyst(req.headers.get("x-design-token"));
    const { mode, proposalId, limit, onlyExposed } = pendingRequestSchema.parse(await req.json());
    const pages = await listPendingPages(
      mode === "reanalyze"
        ? { proposalId, force: true, limit, onlyExposed }
        : { limit, onlyExposed },
    );
    return Response.json({
      pages: pages.map((p) => ({
        pageId: p.pageId,
        versionId: p.versionId,
        proposalId: p.proposalId,
        proposalTitle: p.proposalTitle,
        storagePath: p.storagePath,
        imageUrl: publicUrl(p.storagePath),
      })),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
