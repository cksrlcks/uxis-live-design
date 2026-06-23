"use client";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ExternalLink, Pencil, SendHorizontal, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useRealtime } from "@/shared/realtime/realtime-provider";
import type { Identity } from "@/shared/realtime/identity";
import { chatQueries, MAX_CHAT_BODY } from "@/entities/chat-message";
import type { ChatMessageDTO } from "@/entities/chat-message";
import { useSendChatMessage } from "@/features/send-chat-message";
import { useDeleteChatMessage, useEditChatMessage } from "@/features/manage-chat-message";
import { Input } from "@/shared/ui/input";
import { cn } from "@/shared/lib/utils";

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

// 연속 메시지 묶음 기준: 같은 작성자가 이 시간 안에 보내면 헤더를 숨기고 간격을 좁힌다(슬랙/디스코드식).
const GROUP_WINDOW_MS = 5 * 60 * 1000;

function sameAuthor(a: ChatMessageDTO, b: ChatMessageDTO): boolean {
  return a.authorName === b.authorName && a.authorColor === b.authorColor;
}

export function ChatPanel({
  publicId,
  identity,
  viewerId,
  onClose,
  onPopOut,
  className,
}: {
  publicId: string;
  identity: Identity;
  viewerId: string | null;
  onClose?: () => void;
  onPopOut?: () => void;
  className?: string;
}) {
  const { broadcastChat } = useRealtime();
  const { data: chatMessages = [] } = useQuery(chatQueries.list(publicId));
  const send = useSendChatMessage(publicId);
  const editMessage = useEditChatMessage(publicId);
  const deleteMessage = useDeleteChatMessage(publicId);

  const [text, setText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  // 캐시 갱신(broadcast → RQ)은 항상 마운트된 useChatBridge가 담당. 여기선 캐시를 읽기만 한다.
  // 새 메시지/열림 시 맨 아래로.
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [chatMessages]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setText(""); // 낙관적: 입력창을 즉시 비운다(메시지는 mutation onMutate가 바로 띄움)
    send.mutate(
      { body, authorName: identity.name, authorColor: identity.color },
      {
        onSuccess: (message) => broadcastChat(message),
        onError: (e) => {
          setText(body); // 실패 시 입력 복구
          toast.error(e instanceof Error ? e.message : "메시지 전송에 실패했습니다");
        },
      },
    );
  }

  // 정렬용 "내 메시지": 게스트도 우측 정렬되도록 이름+색으로 식별.
  function isMine(m: ChatMessageDTO): boolean {
    return m.authorName === identity.name && m.authorColor === identity.color;
  }

  // 수정/삭제 권한: 로그인 사용자가 자기 메시지일 때만(삭제된 건 제외).
  // 서버가 authorId === profile.id로 한 번 더 검증하므로 여기선 버튼 노출 판단용.
  function canManage(m: ChatMessageDTO): boolean {
    return viewerId != null && m.authorId === viewerId && !m.deletedAt;
  }

  function startEdit(m: ChatMessageDTO) {
    setEditingId(m.id);
    setEditText(m.body);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditText("");
  }

  function submitEdit(m: ChatMessageDTO) {
    const body = editText.trim();
    if (!body || editMessage.isPending) return;
    if (body === m.body) return cancelEdit();
    editMessage.mutate(
      { id: m.id, body },
      {
        onSuccess: (message) => {
          broadcastChat(message);
          cancelEdit();
          toast.success("수정했습니다");
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "수정에 실패했습니다"),
      },
    );
  }

  function removeMessage(m: ChatMessageDTO) {
    if (deleteMessage.isPending) return;
    deleteMessage.mutate(m.id, {
      onSuccess: (message) => {
        broadcastChat(message);
        toast.success("삭제했습니다");
      },
      onError: (e) => toast.error(e instanceof Error ? e.message : "삭제에 실패했습니다"),
    });
  }

  return (
    <div
      className={cn(
        "bg-foreground/95 text-background flex h-120 w-96 flex-col overflow-hidden rounded-l-xl shadow-2xl backdrop-blur-md",
        className,
      )}
    >
      <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <span className="bg-accent-green relative inline-flex h-2 w-2 rounded-full" />
          <span className="text-base font-medium">채팅</span>
        </div>
        <div className="flex items-center gap-0.5">
          {onPopOut && (
            <button
              onClick={onPopOut}
              aria-label="새 창으로 열기"
              title="새 창으로 열기"
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              aria-label="채팅 닫기"
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </header>

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {chatMessages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-center text-white/50">
            <p className="text-sm">아직 메시지가 없습니다.</p>
            <p className="text-xs">첫 메시지를 남겨보세요.</p>
          </div>
        )}
        {chatMessages.map((m, i) => {
          const mine = isMine(m);
          const deleted = !!m.deletedAt;
          const editing = editingId === m.id;
          const prev = chatMessages[i - 1];
          const grouped =
            !!prev &&
            sameAuthor(prev, m) &&
            new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < GROUP_WINDOW_MS;

          return (
            <div
              key={m.id}
              className={cn(
                "group flex flex-col first:mt-0",
                mine ? "items-end" : "items-start",
                grouped ? "mt-0.5" : "mt-3",
              )}
            >
              {!mine && !grouped && (
                <div className="mb-1 flex items-center gap-1.5 px-1">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: m.authorColor }}
                  />
                  <span className="text-[13px] font-medium text-white/70">{m.authorName}</span>
                </div>
              )}

              {editing ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    submitEdit(m);
                  }}
                  className="flex w-[92%] flex-col gap-1"
                >
                  <div className="flex items-center gap-1.5">
                    <Input
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      maxLength={MAX_CHAT_BODY}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Escape") cancelEdit();
                      }}
                      aria-label="메시지 수정"
                      className="h-10 rounded-lg border-white/15 bg-white/10 text-[15px] text-white placeholder:text-white/40"
                    />
                    <button
                      type="submit"
                      aria-label="수정 저장"
                      disabled={editMessage.isPending || !editText.trim()}
                      className="bg-primary text-primary-foreground hover:bg-primary/90 flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Check className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      aria-label="수정 취소"
                      className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                  <span className="px-1 text-[10px] text-white/40">Enter 저장 · Esc 취소</span>
                </form>
              ) : (
                <div
                  className={cn(
                    "relative flex max-w-[85%] items-end gap-1.5",
                    mine ? "flex-row-reverse" : "flex-row",
                  )}
                >
                  <div
                    className={cn(
                      "rounded-2xl px-3.5 py-3 text-[15px] leading-tight wrap-break-word whitespace-pre-wrap",
                      deleted
                        ? "border border-dashed border-white/15 bg-transparent text-white/40 not-italic"
                        : mine
                          ? "bg-primary text-primary-foreground"
                          : "bg-white/10 text-white",
                      !deleted && !grouped && (mine ? "rounded-tr-sm" : "rounded-tl-sm"),
                    )}
                  >
                    {deleted ? "삭제된 메시지" : m.body}
                    {!deleted && m.editedAt && (
                      <span className="ml-1.5 text-[10px] opacity-60 not-italic">(수정됨)</span>
                    )}
                  </div>

                  <time className="shrink-0 pb-0.5 text-[11px] tabular-nums text-white/35">
                    {formatTime(m.createdAt)}
                  </time>

                  {/* 플로팅 액션 툴바 — 시간 옆(말풍선 바깥)에 떠오른다.
                      absolute라 공간을 차지하지 않고 본문도 가리지 않음. */}
                  {canManage(m) && (
                    <div
                      className={cn(
                        "absolute bottom-0 z-10 flex items-center gap-0.5 rounded-lg border border-white/10 bg-white/10 p-0.5 opacity-0 shadow-lg backdrop-blur-md transition-opacity group-hover:opacity-100 focus-within:opacity-100",
                        mine ? "right-full mr-1.5" : "left-full ml-1.5",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => startEdit(m)}
                        aria-label="메시지 수정"
                        title="수정"
                        className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/15 hover:text-white"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeMessage(m)}
                        aria-label="메시지 삭제"
                        title="삭제"
                        className="hover:text-destructive flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/15"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <form
        onSubmit={submit}
        className="flex shrink-0 items-center gap-2 border-t border-white/10 p-2.5"
      >
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={MAX_CHAT_BODY}
          placeholder="메시지 입력…"
          aria-label="메시지 입력"
          className="h-10 rounded-full border-white/15 bg-white/10 px-4 text-[15px] text-white placeholder:text-white/40"
        />
        <button
          type="submit"
          aria-label="전송"
          disabled={!text.trim()}
          className="bg-primary text-primary-foreground hover:bg-primary/90 flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        >
          <SendHorizontal className="h-4.5 w-4.5" aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}
