import { NextRequest } from "next/server";
import { getProposals } from "@/entities/proposal/api/get-proposals.server";
import { createProposal } from "@/entities/proposal/api/create-proposal.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

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

export async function POST(req: NextRequest) {
  try {
    const result = await createProposal(await req.json());
    return Response.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
