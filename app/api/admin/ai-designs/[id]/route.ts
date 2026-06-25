import { NextRequest } from "next/server";
import { deleteAiDesign } from "@/entities/ai-design/api/delete-ai-design.server";
import { getAiDesignDetail } from "@/entities/ai-design/api/get-ai-design-detail.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return Response.json(await getAiDesignDetail(id));
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await deleteAiDesign(id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
