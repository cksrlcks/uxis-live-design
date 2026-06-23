import { NextRequest } from "next/server";
import { requestPageUploads, appendPages } from "@/entities/proposal/api/page-mutations.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

type Ctx = { params: Promise<{ id: string; variantId: string; versionId: string }> };

// 이미지 추가용 서명 업로드 URL 발급(append). body: { files: [{ contentType, size }] }
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const { id, variantId, versionId } = await params;
    return Response.json(await requestPageUploads(id, variantId, versionId, await req.json()));
  } catch (error) {
    return toErrorResponse(error);
  }
}

// 업로드 완료 확인 → 페이지 행 기록. body: { pages: [{ pageId, pageOrder, path, width, height }] }
export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const { id, variantId, versionId } = await params;
    await appendPages(id, variantId, versionId, await req.json());
    return new Response(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
