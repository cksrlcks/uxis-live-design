import { NextRequest } from "next/server";
import { createVariant } from "@/entities/proposal/api/create-variant.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return Response.json(await createVariant(id, await req.json()));
  } catch (error) {
    return toErrorResponse(error);
  }
}
