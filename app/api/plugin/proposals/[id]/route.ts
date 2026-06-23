import { NextRequest } from "next/server";
import { getProposalDetail } from "@/entities/proposal/api/get-proposal-detail.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

// 시안 상세 — 안(variant)/버전/페이지 트리. 어떤 안·버전·페이지를 바꿀지 고르는 데 쓴다.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return Response.json(await getProposalDetail(id));
  } catch (error) {
    return toErrorResponse(error);
  }
}
