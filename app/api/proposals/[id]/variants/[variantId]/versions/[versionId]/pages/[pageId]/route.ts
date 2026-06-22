import { NextRequest } from "next/server";
import { confirmReplacePage, deletePage } from "@/entities/proposal/api/page-mutations.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

type Ctx = {
  params: Promise<{ id: string; variantId: string; versionId: string; pageId: string }>;
};

// 교체 업로드 완료 확인.
export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const { id, variantId, versionId, pageId } = await params;
    await confirmReplacePage(id, variantId, versionId, pageId, await req.json());
    return new Response(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}

// 페이지 삭제.
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { id, variantId, versionId, pageId } = await params;
    await deletePage(id, variantId, versionId, pageId);
    return new Response(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
