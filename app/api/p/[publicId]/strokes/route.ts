import { getStrokes } from "@/entities/whiteboard/api/get-strokes.server";
import { toErrorResponse } from "@/shared/api/to-error-response";
import { createStroke } from "@/features/whiteboard/api/create-stroke.server";

export async function GET(req: Request, { params }: { params: Promise<{ publicId: string }> }) {
  try {
    const { publicId } = await params;
    const url = new URL(req.url);
    const variantId = url.searchParams.get("variant") ?? "";
    const versionId = url.searchParams.get("version") ?? "";
    return Response.json({ strokes: await getStrokes(publicId, variantId, versionId) });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ publicId: string }> }) {
  try {
    const { publicId } = await params;
    const raw = await req.json().catch(() => null);
    const stroke = await createStroke(publicId, raw);
    return Response.json({ stroke });
  } catch (error) {
    return toErrorResponse(error);
  }
}
