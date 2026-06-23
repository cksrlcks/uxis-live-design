import { NextRequest } from "next/server";
import { requestReplacePageUpload } from "@/entities/proposal/api/page-mutations.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

type Ctx = {
  params: Promise<{ id: string; variantId: string; versionId: string; pageId: string }>;
};

// 페이지 이미지 교체용 서명 업로드 URL 발급. body: { contentType, size }
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const { id, variantId, versionId, pageId } = await params;
    return Response.json(
      await requestReplacePageUpload(id, variantId, versionId, pageId, await req.json()),
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
