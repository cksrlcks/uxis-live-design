import { getViewerVariants } from "@/entities/proposal/api/get-viewer-variants.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

export async function GET(_req: Request, { params }: { params: Promise<{ publicId: string }> }) {
  try {
    const { publicId } = await params;
    return Response.json(await getViewerVariants(publicId));
  } catch (error) {
    return toErrorResponse(error);
  }
}
