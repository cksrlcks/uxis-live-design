import { NextRequest } from "next/server";
import { getOfflinePackagePlan } from "@/entities/proposal/api/export-offline.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

// 오프라인 패키지의 설계도(index.html + 이미지 URL 목록)만 내려준다.
// 이미지 다운로드와 zip 조립은 브라우저가 하므로 이 함수는 짧게 끝난다.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return Response.json(await getOfflinePackagePlan(id), {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
