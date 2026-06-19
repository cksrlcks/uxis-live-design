import { http } from "@/shared/api/http";
import type { ChatMessageDTO } from "../model/types";

export function getRecentChat(publicId: string): Promise<ChatMessageDTO[]> {
  return http<ChatMessageDTO[]>(`/api/p/${publicId}/chat`);
}
