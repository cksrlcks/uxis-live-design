import { NextRequest } from "next/server";
import { getVariantTags } from "@/entities/tag/api/get-variant-tags.server";
import { putVariantTags } from "@/entities/tag/api/put-variant-tags.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

// 안(variant) 단위 태그 조회/저장.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return Response.json(await getVariantTags(id));
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await putVariantTags(id, await req.json());
    return new Response(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
