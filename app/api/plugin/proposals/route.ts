import { NextRequest } from "next/server";
import { getProposals } from "@/entities/proposal/api/get-proposals.server";
import { createProposal } from "@/entities/proposal/api/create-proposal.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

// 시안 목록(피커용). 인가는 getProposals 내부 requireEditor가 Bearer 토큰으로 검증한다.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Number(searchParams.get("page") ?? "1");
    const pageSize = Number(searchParams.get("pageSize") ?? "");
    const search = searchParams.get("q") ?? "";
    return Response.json(
      await getProposals(
        Number.isFinite(page) ? page : 1,
        Number.isFinite(pageSize) && pageSize > 0 ? pageSize : undefined,
        search,
      ),
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}

// 새 시안 생성 — 초기 이미지 업로드 URL을 함께 발급한다.
export async function POST(req: NextRequest) {
  try {
    return Response.json(await createProposal(await req.json()));
  } catch (error) {
    return toErrorResponse(error);
  }
}
