"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { chatQueries } from "@/entities/chat-message";
import type { Identity } from "@/shared/realtime/identity";
import { useChatBridge } from "../lib/use-chat-bridge";
import { PresenceBar } from "./presence-bar";
import { ChatPanel } from "./chat-panel";

// 우측 상단에서 접속자 바와 채팅을 묶는 dock — 코너에 붙지 않는 독립 pill 형태로 띄운다.
export function CollaborationDock({
  publicId,
  identity,
  onRename,
  isAuthed,
  viewerId,
}: {
  publicId: string;
  identity: Identity;
  onRename: (name: string) => void;
  isAuthed: boolean;
  viewerId: string | null;
}) {
  const [chatOpen, setChatOpen] = useState(false);
  const { data: chatMessages = [] } = useQuery(chatQueries.list(publicId));

  // 채팅 닫혀 있어도(패널 언마운트) broadcast를 캐시에 반영 → 아이콘 갯수 실시간 갱신.
  useChatBridge(publicId);

  return (
    <div className="fixed top-3 right-3 z-50 flex flex-col items-end gap-2">
      <PresenceBar
        identity={identity}
        onRename={onRename}
        isAuthed={isAuthed}
        chatOpen={chatOpen}
        onToggleChat={() => setChatOpen((v) => !v)}
        chatCount={chatMessages.length}
      />
      {chatOpen && (
        <ChatPanel
          publicId={publicId}
          identity={identity}
          viewerId={viewerId}
          onClose={() => setChatOpen(false)}
          onPopOut={() => {
            window.open(
              `/chat/${publicId}`,
              `uxis-chat-${publicId}`,
              "width=400,height=640,menubar=no,toolbar=no,location=no,status=no",
            );
            setChatOpen(false);
          }}
          className="rounded-xl"
        />
      )}
    </div>
  );
}
