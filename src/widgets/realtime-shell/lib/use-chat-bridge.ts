"use client";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRealtime } from "@/shared/realtime/realtime-provider";
import { chatQueries, upsertChatMessage, type ChatMessageDTO } from "@/entities/chat-message";

// 실시간 broadcast 채팅 메시지를 RQ 캐시로 흘려보낸다(id 기준 upsert).
// 신규는 추가, 같은 id(수정/삭제)는 교체 → 다른 참가자 화면에도 수정/삭제가 반영된다.
// 채팅 패널 열림 여부와 무관하게 캐시를 갱신해야 도크의 메시지 수 배지가
// 실시간으로 바뀌므로, 항상 마운트되는 레벨(도크/standalone)에서 호출한다.
export function useChatBridge(publicId: string) {
  const { subscribeChat } = useRealtime();
  const qc = useQueryClient();

  useEffect(
    () =>
      subscribeChat((raw) => {
        const m = raw as ChatMessageDTO;
        qc.setQueryData<ChatMessageDTO[]>(chatQueries.list(publicId).queryKey, (prev) =>
          upsertChatMessage(prev, m),
        );
      }),
    [subscribeChat, qc, publicId],
  );
}
