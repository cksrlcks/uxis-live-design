import { NextRequest } from "next/server";
import { exportProposalOffline } from "@/entities/proposal/api/export-offline.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

// 시안을 오프라인 패키지(zip)로 내려준다. 이미지 수십 장을 받아 흘려보내므로
// 응답은 스트리밍이며 Content-Length가 없다(청크 전송).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { filename, body } = await exportProposalOffline(id);
    return new Response(body, {
      headers: {
        "content-type": "application/zip",
        // 한글 파일명은 filename*(RFC 5987)으로, 구형 클라이언트용 ASCII 폴백도 함께 준다.
        "content-disposition": `attachment; filename="proposal.zip"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
