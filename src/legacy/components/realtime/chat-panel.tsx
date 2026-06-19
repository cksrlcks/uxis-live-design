"use client";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRealtime } from "./realtime-provider";
import type { Identity } from "@/shared/realtime/identity";
import { chatQueries, MAX_CHAT_BODY, type ChatMessageDTO } from "@/entities/chat-message";
import { useSendChatMessage } from "@/features/send-chat-message";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";

export function ChatPanel({ publicId, identity }: { publicId: string; identity: Identity }) {
  const { subscribeChat, broadcastChat } = useRealtime();
  const { data: chatMessages = [] } = useQuery(chatQueries.list(publicId));
  const qc = useQueryClient();
  const send = useSendChatMessage(publicId);

  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [failed, setFailed] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Bridge: fan realtime broadcast messages into the RQ cache (dedup by id).
  useEffect(
    () =>
      subscribeChat((m) => {
        qc.setQueryData<ChatMessageDTO[]>(
          chatQueries.list(publicId).queryKey,
          (prev) =>
            prev && prev.some((x) => x.id === m.id) ? prev : [...(prev ?? []), m],
        );
      }),
    [subscribeChat, qc, publicId],
  );

  // 새 메시지/열림 시 맨 아래로.
  useEffect(() => {
    if (open && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [chatMessages, open]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || send.isPending) return;
    setFailed(false);
    send.mutate(
      { body, authorName: identity.name, authorColor: identity.color },
      {
        onSuccess: (message) => {
          broadcastChat(message);
          setText("");
        },
        onError: () => setFailed(true),
      },
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-3 left-3 z-50 rounded-full border border-border bg-background/90 px-4 py-2 text-sm font-medium shadow-sm backdrop-blur"
      >
        채팅
        {chatMessages.length > 0 && (
          <span className="ml-1 text-muted-foreground">{chatMessages.length}</span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed bottom-3 left-3 z-50 flex h-96 w-80 flex-col rounded-lg border border-border bg-background/95 shadow-lg backdrop-blur">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
        <span className="text-sm font-medium">채팅</span>
        <button onClick={() => setOpen(false)} className="text-sm text-muted-foreground">
          닫기
        </button>
      </div>
      <div ref={listRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {chatMessages.length === 0 && (
          <p className="text-xs text-muted-foreground">아직 메시지가 없습니다.</p>
        )}
        {chatMessages.map((m) => (
          <div key={m.id} className="text-sm">
            <span className="font-medium" style={{ color: m.authorColor }}>
              {m.authorName}
            </span>
            <span className="ml-2 whitespace-pre-wrap break-words">{m.body}</span>
          </div>
        ))}
      </div>
      {(failed || send.isError) && (
        <p className="shrink-0 px-3 pb-1 text-xs text-destructive">전송 실패 — 다시 시도해 주세요.</p>
      )}
      <form onSubmit={submit} className="flex shrink-0 items-center gap-2 border-t border-border p-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={MAX_CHAT_BODY}
          placeholder="메시지 입력"
          aria-label="메시지 입력"
          className="h-8"
        />
        <Button type="submit" size="sm" className="h-8" disabled={send.isPending || !text.trim()}>
          전송
        </Button>
      </form>
    </div>
  );
}
