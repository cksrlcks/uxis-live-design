"use client";
import { useEffect, useState } from "react";
import { RealtimeProvider } from "./realtime-provider";
import { PresenceBar } from "./presence-bar";
import { ChatPanel } from "./chat-panel";
import { type Identity, loadOrCreateIdentity, saveIdentity } from "@/shared/realtime/identity";
import type { ChatMessageDTO } from "@/legacy/lib/meeting/types";

export function RealtimeShell({ publicId, editorName, initialChat, children }: {
  publicId: string; editorName: string | null; initialChat: ChatMessageDTO[]; children: React.ReactNode;
}) {
  const [identity, setIdentity] = useState<Identity | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: localStorage is browser-only; deferring to effect prevents SSR hydration mismatch
    setIdentity(loadOrCreateIdentity(editorName));
  }, [editorName]);

  if (!identity) return <>{children}</>;

  function rename(name: string) {
    setIdentity((prev) => {
      if (!prev) return prev;
      const next = { ...prev, name };
      saveIdentity(next);
      return next;
    });
  }

  return (
    <RealtimeProvider publicId={publicId} identity={identity} initialChat={initialChat}>
      {children}
      <PresenceBar identity={identity} onRename={rename} />
      <ChatPanel publicId={publicId} identity={identity} />
    </RealtimeProvider>
  );
}
