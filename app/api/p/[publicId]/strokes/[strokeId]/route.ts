import { toErrorResponse } from "@/shared/api/to-error-response";
import { deleteStroke } from "@/features/whiteboard/api/delete-stroke.server";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ publicId: string; strokeId: string }> },
) {
  try {
    const { publicId, strokeId } = await params;
    const result = await deleteStroke(publicId, strokeId);
    return Response.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
