import { NextRequest } from "next/server";
import { deleteVariant } from "@/entities/proposal/api/variant-mutations.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

type Ctx = { params: Promise<{ id: string; variantId: string }> };

// 안(variant) 삭제 → 버전/페이지 cascade + 스토리지 객체 제거. 마지막 안은 거부(LAST_VARIANT).
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { id, variantId } = await params;
    await deleteVariant(id, variantId);
    return new Response(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
