import { useMutation, useQueryClient } from "@tanstack/react-query";
import { http } from "@/shared/api/http";
import { chatQueries, type ChatMessageDTO, type CreateChatInput } from "@/entities/chat-message";

export function useSendChatMessage(publicId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateChatInput) =>
      http<{ message: ChatMessageDTO }>(`/api/p/${publicId}/chat`, {
        method: "POST",
        body: JSON.stringify(input),
      }).then((r) => r.message),
    onSuccess: (message) => {
      qc.setQueryData<ChatMessageDTO[]>(chatQueries.list(publicId).queryKey, (prev) =>
        prev && prev.some((m) => m.id === message.id) ? prev : [...(prev ?? []), message],
      );
    },
  });
}
