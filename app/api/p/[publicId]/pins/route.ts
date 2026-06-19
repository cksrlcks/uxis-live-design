import { getPins } from "@/entities/pin/api/get-pins.server";
import { toErrorResponse } from "@/shared/api/to-error-response";
import { createPinComment } from "@/features/pin-comment/api/create-pin-comment.server";

export async function GET(req: Request, { params }: { params: Promise<{ publicId: string }> }) {
  try {
    const { publicId } = await params;
    const url = new URL(req.url);
    const variantId = url.searchParams.get("variant") ?? "";
    const versionId = url.searchParams.get("version") ?? "";
    return Response.json({ pins: await getPins(publicId, variantId, versionId) });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ publicId: string }> }) {
  try {
    const { publicId } = await params;
    const raw = await req.json().catch(() => null);
    const pin = await createPinComment(publicId, raw);
    return Response.json({ pin });
  } catch (error) {
    return toErrorResponse(error);
  }
}
