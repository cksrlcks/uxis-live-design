import { NextRequest } from "next/server";
import { createVariant } from "@/entities/proposal/api/create-variant.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

// 새 안(variant) 생성 — slug/label(A·B·C…) 자동 부여, 빈 v1 생성, 초기 이미지 업로드 URL 발급.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return Response.json(await createVariant(id, await req.json()));
  } catch (error) {
    return toErrorResponse(error);
  }
}
