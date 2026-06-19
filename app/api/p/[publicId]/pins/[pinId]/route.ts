import { toErrorResponse } from "@/shared/api/to-error-response";
import { updatePinComment } from "@/features/pin-comment/api/update-pin-comment.server";
import { deletePinComment } from "@/features/pin-comment/api/delete-pin-comment.server";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ publicId: string; pinId: string }> },
) {
  try {
    const { publicId, pinId } = await params;
    const raw = await req.json().catch(() => null);
    const pin = await updatePinComment(publicId, pinId, raw);
    return Response.json({ pin });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ publicId: string; pinId: string }> },
) {
  try {
    const { publicId, pinId } = await params;
    const result = await deletePinComment(publicId, pinId);
    return Response.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
