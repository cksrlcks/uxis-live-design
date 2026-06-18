import { NextRequest } from "next/server";
import { getProposalDetail } from "@/entities/proposal/api/get-proposal-detail.server";
import {
  updateProposalSettings,
  deleteProposal,
} from "@/entities/proposal/api/proposal-mutations.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return Response.json(await getProposalDetail(id));
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await updateProposalSettings(id, await req.json());
    return new Response(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await deleteProposal(id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
