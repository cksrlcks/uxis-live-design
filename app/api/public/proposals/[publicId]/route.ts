import { NextRequest } from "next/server";
import { getPublicProposal } from "@/entities/proposal/api/get-public-proposal.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

// 유시스웍스 공개 상세 — 무인증. 비노출/부재는 NOT_FOUND(404).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ publicId: string }> },
) {
  try {
    const { publicId } = await params;
    return Response.json(await getPublicProposal(publicId));
  } catch (error) {
    return toErrorResponse(error);
  }
}
