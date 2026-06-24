import { NextRequest } from "next/server";
import { getPublicProposals } from "@/entities/proposal/api/get-public-proposals.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

// 유시스웍스 공개 목록 — 무인증. exposed 시안만 페이지네이션해 반환(클램프는 쿼리 내부).
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Number(searchParams.get("page") ?? "1");
    const pageSize = Number(searchParams.get("pageSize") ?? "20");
    return Response.json(await getPublicProposals(page, pageSize));
  } catch (error) {
    return toErrorResponse(error);
  }
}
