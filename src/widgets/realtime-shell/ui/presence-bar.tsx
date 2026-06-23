"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LogIn, LogOut, MessageCircle, Pencil } from "lucide-react";
import { useRealtime } from "@/shared/realtime/realtime-provider";
import type { Identity } from "@/shared/realtime/identity";
import { useLogout } from "@/features/auth";
import { Input } from "@/shared/ui/input";
import { cn } from "@/shared/lib/utils";

export function PresenceBar({
  identity,
  onRename,
  isAuthed,
  chatOpen,
  onToggleChat,
  chatCount,
}: {
  identity: Identity;
  onRename: (name: string) => void;
  isAuthed: boolean;
  chatOpen: boolean;
  onToggleChat: () => void;
  chatCount: number;
}) {
  const { participants } = useRealtime();
  const [editing, setEditing] = useState(false);
  const router = useRouter();
  const logout = useLogout();

  // 공개 뷰어에서 로그아웃 — /login으로 보내지 않고 현재 페이지를 새로고침해 익명 뷰어로 전환.
  // 게이트(비공개/비번)는 서버가 다시 판단한다.
  async function handleLogout() {
    if (logout.isPending) return;
    try {
      await logout.mutateAsync();
    } finally {
      router.refresh();
    }
  }

  // Show others first, then me (presence includes my own key).
  const others = participants.filter((p) => p.id !== identity.id);
  const onlineCount = others.length + 1;

  return (
    <div className="bg-foreground/95 text-background flex items-center gap-2.5 rounded-full py-1.5 pr-2 pl-3 shadow-lg backdrop-blur-md">
      {/* 접속자 */}
      <div className="flex items-center gap-2 pl-1">
        <span className="relative flex h-2 w-2" aria-hidden="true">
          <span className="bg-accent-green/60 absolute inline-flex h-full w-full animate-ping rounded-full" />
          <span className="bg-accent-green relative inline-flex h-2 w-2 rounded-full" />
        </span>
        <div className="flex items-center">
          <div className="flex -space-x-2">
            {others.slice(0, 4).map((p) => (
              <span
                key={p.id}
                title={p.name}
                className="ring-foreground flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-medium text-white ring-2"
                style={{ backgroundColor: p.color }}
              >
                {p.name.slice(0, 1).toUpperCase()}
              </span>
            ))}
            {others.length > 4 && (
              <span className="ring-foreground flex h-6 w-6 items-center justify-center rounded-full bg-white/15 text-[10px] font-medium text-white ring-2">
                +{others.length - 4}
              </span>
            )}
          </div>
          <span className="ml-1 text-xs text-white/60 tabular-nums">
            {others.length === 0 ? "혼자 보는 중" : `${onlineCount}명 접속`}
          </span>
        </div>
      </div>

      <span className="h-5 w-px bg-white/15" />

      {/* 내 이름 — 로그인 사용자는 계정 이름으로 고정(편집 불가) */}
      {isAuthed ? (
        <div
          className="flex items-center gap-1.5 py-1 pr-2 pl-1 text-xs text-white"
          title="로그인 계정 이름"
        >
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: identity.color }}
          />
          <span className="max-w-24 truncate font-medium">{identity.name}</span>
        </div>
      ) : editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const name = (
              e.currentTarget.elements.namedItem("name") as HTMLInputElement
            ).value.trim();
            if (name) onRename(name);
            setEditing(false);
          }}
          className="flex items-center gap-1"
        >
          <Input
            name="name"
            defaultValue={identity.name}
            autoFocus
            className="h-7 w-24 border-white/15 bg-white/10 text-xs text-white placeholder:text-white/40"
          />
          <button
            type="submit"
            aria-label="이름 저장"
            className="bg-primary text-primary-foreground hover:bg-primary/90 flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors"
          >
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </form>
      ) : (
        <button
          onClick={() => setEditing(true)}
          aria-label="이름 변경"
          className="group flex cursor-pointer items-center gap-1.5 rounded-md py-1 pr-2 pl-1 text-xs text-white transition-colors hover:bg-white/10"
        >
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: identity.color }}
          />
          <span className="max-w-24 truncate font-medium">{identity.name}</span>
        </button>
      )}

      <span className="h-5 w-px bg-white/15" />

      <div className="flex">

      {/* 로그인/로그아웃 */}
      {isAuthed ? (
        <button
          type="button"
          onClick={handleLogout}
          disabled={logout.isPending}
          aria-label={logout.isPending ? "로그아웃 중" : "로그아웃"}
          title="로그아웃"
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : (
        <a
          href={`/login?returnTo=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname + window.location.search : "/")}`}
          aria-label="로그인"
          title="로그인"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <LogIn className="h-4 w-4" aria-hidden="true" />
        </a>
      )}


      {/* 채팅 토글 */}
      <button
        onClick={onToggleChat}
        aria-label="채팅 열기"
        aria-pressed={chatOpen}
        className={cn(
          "relative flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors",
          chatOpen
            ? "bg-primary text-primary-foreground hover:bg-primary/90"
            : "text-white/70 hover:bg-white/10 hover:text-white",
        )}
      >
        <MessageCircle className="h-4 w-4" aria-hidden="true" />
        {chatCount > 0 && !chatOpen && (
          <span className="bg-destructive ring-foreground absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-semibold text-white ring-2">
            {chatCount > 99 ? "99+" : chatCount}
          </span>
        )}
      </button>
      </div>

    </div>
  );
}
