import { NextRequest } from "next/server";
import { confirmPages } from "@/entities/proposal/api/confirm-pages.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; variantId: string; versionId: string }> },
) {
  try {
    const { id, variantId, versionId } = await params;
    await confirmPages(id, variantId, versionId, await req.json());
    return new Response(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
