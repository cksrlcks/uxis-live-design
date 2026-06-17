import { NextRequest } from "next/server";
import { getProposals } from "@/entities/proposal/api/get-proposals.server";
import { createProposal } from "@/entities/proposal/api/create-proposal.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

export async function GET() {
  try {
    return Response.json(await getProposals());
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
