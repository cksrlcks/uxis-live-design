import { getStrokes } from "@/entities/whiteboard/api/get-strokes.server";
import { toErrorResponse } from "@/shared/api/to-error-response";
import { upsertLayer } from "@/features/whiteboard/api/upsert-layer.server";

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

export async function PUT(req: Request, { params }: { params: Promise<{ publicId: string }> }) {
  try {
    const { publicId } = await params;
    const raw = await req.json().catch(() => null);
    return Response.json(await upsertLayer(publicId, raw));
  } catch (error) {
    return toErrorResponse(error);
  }
}
