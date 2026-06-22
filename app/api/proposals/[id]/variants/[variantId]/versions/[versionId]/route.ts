import { NextRequest } from "next/server";
import { deleteVersion } from "@/entities/proposal/api/version-mutations.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

// 버전 삭제(마지막 버전은 불가).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; variantId: string; versionId: string }> },
) {
  try {
    const { id, variantId, versionId } = await params;
    await deleteVersion(id, variantId, versionId);
    return new Response(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
