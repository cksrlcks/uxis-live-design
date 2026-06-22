"use client";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, MessagesSquare, X } from "lucide-react";
import { pinQueries, type PinContext, type PinDTO } from "@/entities/pin";
import { useToggleResolved } from "@/features/pin-comment";
import { useRealtimeOptional } from "@/shared/realtime/realtime-provider";
import { cn } from "@/shared/lib/utils";
import { formatRelativeTime, initialOf } from "../lib/format";

type Filter = "all" | "open";

export function CommentsPanel({
  pin,
  selectedId,
  onSelect,
  onClose,
}: {
  pin: PinContext;
  selectedId: string | null;
  // 리스트에서 항목 클릭 시 해당 핀을 선택하고 캔버스를 그쪽으로 이동.
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const { publicId, variantId, versionId } = pin;
  const { data: pins = [] } = useQuery(pinQueries.list(publicId, variantId, versionId));
  const rt = useRealtimeOptional();
  const resolveMut = useToggleResolved(publicId, variantId, versionId);
  const [filter, setFilter] = useState<Filter>("all");

  // 시간순(오래된 → 최신) 정렬. 필터로 미해결만 볼 수 있다.
  const sorted = useMemo(() => {
    const byTime = [...pins].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    return filter === "open" ? byTime.filter((p) => !p.resolved) : byTime;
  }, [pins, filter]);

  const openCount = pins.filter((p) => !p.resolved).length;

  const toggleResolve = (p: PinDTO) =>
    resolveMut.mutate(
      { pinId: p.id, resolved: !p.resolved },
      { onSuccess: (saved) => rt?.broadcastPinUpdated(saved) },
    );

  return (
    <aside className="border-border bg-background absolute inset-y-0 left-0 z-40 flex w-80 flex-col border-r shadow-xl">
      <header className="flex shrink-0 items-center gap-2 px-4 py-3.5">
        <MessagesSquare className="h-4.5 w-4.5 shrink-0" aria-hidden="true" />
        <h2 className="text-[15px] font-semibold">코멘트</h2>
        <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[11px] font-medium tabular-nums">
          {pins.length}
        </span>
        <button
          onClick={onClose}
          aria-label="코멘트 목록 닫기"
          className="text-muted-foreground hover:bg-muted hover:text-foreground ml-auto flex h-7 w-7 cursor-pointer items-center justify-center rounded-md transition-colors"
        >
          <X className="h-4.5 w-4.5" aria-hidden="true" />
        </button>
      </header>

      <div className="px-3 pb-2.5">
        <div className="bg-muted/70 inline-flex items-center rounded-lg p-0.5 text-xs font-medium">
          <SegTab active={filter === "all"} onClick={() => setFilter("all")}>
            전체 {pins.length}
          </SegTab>
          <SegTab active={filter === "open"} onClick={() => setFilter("open")}>
            미해결 {openCount}
          </SegTab>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {sorted.length === 0 ? (
          <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <div className="bg-muted flex h-11 w-11 items-center justify-center rounded-full">
              <MessagesSquare className="h-5 w-5" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium">
              {filter === "open" ? "미해결 코멘트가 없습니다" : "아직 코멘트가 없습니다"}
            </p>
            {filter !== "open" && (
              <p className="text-xs">시안 위를 클릭해 코멘트를 남겨보세요.</p>
            )}
          </div>
        ) : (
          <ul className="space-y-0.5">
            {sorted.map((p) => (
              <CommentItem
                key={p.id}
                pin={p}
                selected={p.id === selectedId}
                onClick={() => onSelect(p.id)}
                onToggleResolve={() => toggleResolve(p)}
              />
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

function SegTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "cursor-pointer rounded-md px-2.5 py-1 tabular-nums transition-colors",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function CommentItem({
  pin,
  selected,
  onClick,
  onToggleResolve,
}: {
  pin: PinDTO;
  selected: boolean;
  onClick: () => void;
  onToggleResolve: () => void;
}) {
  return (
    // 중첩 버튼 금지 → 본문 버튼과 해결 버튼을 형제로 두고 li를 group으로.
    <li className="group relative">
      <button
        onClick={onClick}
        aria-current={selected}
        className={cn(
          "flex w-full cursor-pointer items-start gap-3 rounded-xl py-2.5 pr-2.5 pl-3 text-left transition-colors",
          selected ? "bg-primary/10" : "hover:bg-muted/60",
        )}
      >
        <span className="relative mt-0.5 shrink-0" aria-hidden="true">
          <span
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-semibold text-white",
              pin.resolved && "opacity-40",
            )}
            style={{ backgroundColor: pin.authorColor }}
          >
            {initialOf(pin.authorName)}
          </span>
          {pin.resolved && (
            <span className="border-background absolute -right-0.5 -bottom-0.5 flex h-3.75 w-3.75 items-center justify-center rounded-full border-2 bg-emerald-500 text-white">
              <Check className="h-2.5 w-2.5" strokeWidth={3} />
            </span>
          )}
        </span>

        <div className="min-w-0 flex-1 pt-px">
          <div className="flex items-center gap-2">
            <span className="truncate text-[13px] leading-tight font-semibold">
              {pin.authorName}
            </span>
            <time className="text-muted-foreground ml-auto shrink-0 pr-7 text-[11px] leading-tight">
              {formatRelativeTime(pin.createdAt)}
            </time>
          </div>
          <p
            className={cn(
              "mt-1 text-[13px] leading-relaxed wrap-break-word",
              pin.resolved ? "text-muted-foreground line-through" : "text-foreground/80",
            )}
          >
            {pin.body}
          </p>
        </div>
      </button>

      {/* 해결 토글 — 피그마처럼 우상단, hover 시 노출(해결됨이면 항상 표시) */}
      <button
        type="button"
        onClick={onToggleResolve}
        aria-label={pin.resolved ? "재오픈" : "해결로 표시"}
        title={pin.resolved ? "재오픈" : "해결로 표시"}
        className={cn(
          "absolute top-2.5 right-2.5 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border transition-all",
          pin.resolved
            ? "border-emerald-500 bg-emerald-500 text-white opacity-100"
            : "border-border bg-background text-muted-foreground opacity-0 shadow-sm group-hover:opacity-100 hover:border-emerald-500 hover:text-emerald-600 focus-visible:opacity-100",
        )}
      >
        <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
      </button>
    </li>
  );
}
