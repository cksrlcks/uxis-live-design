import { NextRequest } from "next/server";
import { getProposalTags } from "@/entities/tag/api/get-proposal-tags.server";
import { putProposalTags } from "@/entities/tag/api/put-proposal-tags.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return Response.json(await getProposalTags(id));
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await putProposalTags(id, await req.json());
    return new Response(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
