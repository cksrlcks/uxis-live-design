import { getRecentChat } from "@/entities/chat-message/api/get-recent-chat.server";
import { toErrorResponse } from "@/shared/api/to-error-response";
import { createChatMessage } from "@/features/send-chat-message/api/create-chat-message.server";

export async function GET(_req: Request, { params }: { params: Promise<{ publicId: string }> }) {
  try {
    const { publicId } = await params;
    return Response.json(await getRecentChat(publicId));
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ publicId: string }> }) {
  try {
    const { publicId } = await params;
    const raw = await req.json().catch(() => null);
    const message = await createChatMessage(publicId, raw);
    return Response.json({ message });
  } catch (error) {
    return toErrorResponse(error);
  }
}
