import { NextRequest } from "next/server";
import { createVersion } from "@/entities/proposal/api/create-version.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; variantId: string }> },
) {
  try {
    const { id, variantId } = await params;
    return Response.json(await createVersion(id, variantId, await req.json()));
  } catch (error) {
    return toErrorResponse(error);
  }
}
