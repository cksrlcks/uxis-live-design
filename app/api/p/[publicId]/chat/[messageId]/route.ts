import { toErrorResponse } from "@/shared/api/to-error-response";
import { updateChatMessage } from "@/features/manage-chat-message/api/update-chat-message.server";
import { deleteChatMessage } from "@/features/manage-chat-message/api/delete-chat-message.server";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ publicId: string; messageId: string }> },
) {
  try {
    const { publicId, messageId } = await params;
    const raw = await req.json().catch(() => null);
    const message = await updateChatMessage(publicId, messageId, raw);
    return Response.json({ message });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ publicId: string; messageId: string }> },
) {
  try {
    const { publicId, messageId } = await params;
    const message = await deleteChatMessage(publicId, messageId);
    return Response.json({ message });
  } catch (error) {
    return toErrorResponse(error);
  }
}
