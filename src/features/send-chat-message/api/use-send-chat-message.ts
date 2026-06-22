import { useMutation, useQueryClient } from "@tanstack/react-query";
import { http } from "@/shared/api/http";
import {
  chatQueries,
  upsertChatMessage,
  type ChatMessageDTO,
  type CreateChatInput,
} from "@/entities/chat-message";

type SendContext = { prev: ChatMessageDTO[] | undefined; tempId: string };

export function useSendChatMessage(publicId: string) {
  const qc = useQueryClient();
  const key = chatQueries.list(publicId).queryKey;
  return useMutation({
    mutationFn: (input: CreateChatInput) =>
      http<{ message: ChatMessageDTO }>(`/api/p/${publicId}/chat`, {
        method: "POST",
        body: JSON.stringify(input),
      }).then((r) => r.message),
    // 낙관적 삽입: 서버 응답 전 임시 메시지를 즉시 목록에 올린다.
    onMutate: async (input): Promise<SendContext> => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<ChatMessageDTO[]>(key);
      const tempId = `optimistic-${crypto.randomUUID()}`;
      const optimistic: ChatMessageDTO = {
        id: tempId,
        authorId: null, // 확정 전엔 소유권 미부여(수정/삭제 버튼 숨김)
        authorName: input.authorName,
        authorColor: input.authorColor,
        body: input.body,
        createdAt: new Date().toISOString(),
        editedAt: null,
        deletedAt: null,
      };
      qc.setQueryData<ChatMessageDTO[]>(key, (p) => upsertChatMessage(p, optimistic));
      return { prev, tempId };
    },
    // 확정: 임시 메시지를 서버가 돌려준 실제 메시지로 교체.
    onSuccess: (message, _input, ctx) => {
      qc.setQueryData<ChatMessageDTO[]>(key, (prev) => {
        if (!prev) return [message];
        const idx = prev.findIndex((m) => m.id === ctx?.tempId);
        if (idx === -1) return upsertChatMessage(prev, message);
        const next = prev.slice();
        next[idx] = message;
        return next;
      });
    },
    // 실패: 낙관적 삽입 이전 상태로 롤백.
    onError: (_err, _input, ctx) => {
      if (ctx) qc.setQueryData(key, ctx.prev);
    },
  });
}
