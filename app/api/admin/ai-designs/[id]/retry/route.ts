import { NextRequest } from "next/server";
import { retryAiDesign } from "@/entities/ai-design/api/retry-ai-design.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await retryAiDesign(id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
