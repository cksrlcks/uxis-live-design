import { useMutation, useQueryClient } from "@tanstack/react-query";
import { http } from "@/shared/api/http";
import {
  chatQueries,
  upsertChatMessage,
  type ChatMessageDTO,
  type EditChatInput,
} from "@/entities/chat-message";

// 수정/삭제 모두 갱신된 메시지(DTO)를 돌려받아 캐시에 upsert한다.
// 다른 참가자에게 전파하려면 호출부에서 broadcastChat(message)를 함께 호출한다.
export function useEditChatMessage(publicId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string } & EditChatInput) =>
      http<{ message: ChatMessageDTO }>(`/api/p/${publicId}/chat/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ body }),
      }).then((r) => r.message),
    onSuccess: (message) => {
      qc.setQueryData<ChatMessageDTO[]>(chatQueries.list(publicId).queryKey, (prev) =>
        upsertChatMessage(prev, message),
      );
    },
  });
}

export function useDeleteChatMessage(publicId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      http<{ message: ChatMessageDTO }>(`/api/p/${publicId}/chat/${id}`, {
        method: "DELETE",
      }).then((r) => r.message),
    onSuccess: (message) => {
      qc.setQueryData<ChatMessageDTO[]>(chatQueries.list(publicId).queryKey, (prev) =>
        upsertChatMessage(prev, message),
      );
    },
  });
}
