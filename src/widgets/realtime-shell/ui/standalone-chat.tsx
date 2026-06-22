"use client";
import { useEffect, useState } from "react";
import { RealtimeProvider } from "@/shared/realtime/realtime-provider";
import { type Identity, loadOrCreateIdentity } from "@/shared/realtime/identity";
import { useChatBridge } from "../lib/use-chat-bridge";
import { ChatPanel } from "./chat-panel";

// 새 창(window.open)에서 채팅만 단독으로 띄우는 셸.
// identity는 브라우저 localStorage 공유라 부모 창과 동일 참가자로 잡힌다.
export function StandaloneChat({
  publicId,
  viewerName,
  viewerId,
}: {
  publicId: string;
  viewerName: string | null;
  viewerId: string | null;
}) {
  const [identity, setIdentity] = useState<Identity | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: localStorage is browser-only; deferring to effect prevents SSR hydration mismatch
    setIdentity(loadOrCreateIdentity(viewerName));
  }, [viewerName]);

  if (!identity) return null;

  return (
    <RealtimeProvider publicId={publicId} identity={identity}>
      <ChatRoom publicId={publicId} identity={identity} viewerId={viewerId} />
    </RealtimeProvider>
  );
}

// provider 내부에서 broadcast→캐시 bridge를 켜고 전체 화면 채팅을 렌더.
function ChatRoom({
  publicId,
  identity,
  viewerId,
}: {
  publicId: string;
  identity: Identity;
  viewerId: string | null;
}) {
  useChatBridge(publicId);
  return (
    <ChatPanel
      publicId={publicId}
      identity={identity}
      viewerId={viewerId}
      className="h-screen w-full rounded-none border-0 shadow-none"
    />
  );
}
