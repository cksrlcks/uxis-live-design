import { NextRequest } from "next/server";
import { updateVariant, deleteVariant } from "@/entities/proposal/api/variant-mutations.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; variantId: string }> },
) {
  try {
    const { id, variantId } = await params;
    await updateVariant(id, variantId, await req.json());
    return new Response(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; variantId: string }> },
) {
  try {
    const { id, variantId } = await params;
    await deleteVariant(id, variantId);
    return new Response(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
