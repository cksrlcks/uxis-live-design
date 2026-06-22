import { NextRequest } from "next/server";
import { createVersion } from "@/entities/proposal/api/version-mutations.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

// 새 버전 생성(빈 상태, 최신이 기본이 됨).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; variantId: string }> },
) {
  try {
    const { id, variantId } = await params;
    return Response.json(await createVersion(id, variantId, await req.json()));
  } catch (error) {
    return toErrorResponse(error);
  }
}
