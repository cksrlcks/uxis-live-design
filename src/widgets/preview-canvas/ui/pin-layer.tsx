"use client";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toContent } from "@/shared/realtime/coords";
import { locatePin, placePin, type PageBox } from "../lib/locate";
import { formatPinTime, initialOf, pinElementId } from "../lib/format";
import { pinQueries, type PinDTO, type PinContext } from "@/entities/pin";
import { useCreatePin, useEditPin, useToggleResolved, useDeletePin } from "@/features/pin-comment";
import { useRealtimeOptional } from "@/shared/realtime/realtime-provider";
import type { ProposalPage } from "@/entities/proposal";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

type Draft = { pageOrder: number; xNorm: number; yNorm: number } | null;
const INV = "scale(var(--inv-scale,5))";

// 팝오버 헤더용 원형 아바타.
function PinAvatar({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
      style={{ backgroundColor: color }}
      aria-hidden="true"
    >
      {initialOf(name)}
    </span>
  );
}

// 피그마식 코멘트 핀 — 좌하단이 뾰족한 말풍선(teardrop). transformOrigin "0 100%"라
// 뾰족한 꼭짓점이 정확히 클릭 지점을 가리킨다. 안에는 작성자 이니셜(또는 처리됨 체크).
function PinMarker({
  name,
  color,
  resolved,
  active,
}: {
  name?: string;
  color: string;
  resolved?: boolean;
  active?: boolean;
}) {
  return (
    <span
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-tl-full rounded-tr-full rounded-br-full border-2 border-white text-xs font-semibold text-white shadow-md transition-all duration-150",
        active && "ring-2 ring-sky-500",
      )}
      style={{ backgroundColor: color, opacity: resolved ? 0.55 : 1 }}
      aria-hidden="true"
    >
      {resolved ? (
        <Check className="h-4 w-4" strokeWidth={3} />
      ) : name ? (
        initialOf(name)
      ) : null}
    </span>
  );
}

export function PinLayer({
  contentRef,
  pages,
  pin,
  mode,
  spaceHeld,
  selectedId,
  onSelectId,
}: {
  contentRef: React.RefObject<HTMLDivElement | null>;
  pages: ProposalPage[];
  pin: PinContext;
  mode: "pan" | "comment" | "draw";
  spaceHeld: boolean;
  // 선택 상태는 CanvasView로 끌어올려 코멘트 리스트와 공유한다(제어형).
  selectedId: string | null;
  onSelectId: (id: string | null) => void;
}) {
  const { publicId, variantId, versionId } = pin;
  const rt = useRealtimeOptional();
  const { data: pins = [] } = useQuery(pinQueries.list(publicId, variantId, versionId));
  const qc = useQueryClient();
  const createMut = useCreatePin(publicId, variantId, versionId);
  const editMut = useEditPin(publicId, variantId, versionId);
  const resolveMut = useToggleResolved(publicId, variantId, versionId);
  const deleteMut = useDeletePin(publicId, variantId, versionId);

  const [draft, setDraft] = useState<Draft>(null);
  const [draftBody, setDraftBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [loginOpen, setLoginOpen] = useState(false);
  const isGuest = pin.viewerId == null;

  // 실시간 병합(현재 버전 대상만). subscribePins는 안정 참조(provider useCallback)라
  // dep으로 쓰면, rt 전체(매 렌더 새 객체)와 달리 커서 등 고빈도 갱신마다
  // 재구독되지 않는다 — 재구독 사이 broadcast 누락 윈도우 방지.
  const subscribePins = rt?.subscribePins;
  useEffect(() => {
    if (!subscribePins) return;
    return subscribePins((e) => {
      const key = pinQueries.list(publicId, variantId, versionId).queryKey;
      if (e.type === "pin_deleted") {
        qc.setQueryData<PinDTO[]>(key, (prev) => prev?.filter((p) => p.id !== e.id));
        return;
      }
      const p = e.pin as PinDTO;
      if (p.variantId !== variantId || p.versionId !== versionId) return;
      qc.setQueryData<PinDTO[]>(key, (prev) => {
        if (!prev) return prev;
        return prev.some((x) => x.id === p.id)
          ? prev.map((x) => (x.id === p.id ? p : x))
          : [...prev, p];
      });
    });
  }, [subscribePins, qc, publicId, variantId, versionId]);

  // Esc로 팝오버/작성기를 닫는다(피그마식). 입력 중이든 보기 중이든 일관되게.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setEditingId(null);
      onSelectId(null);
      setDraft(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSelectId]);

  // 페이지 박스를 매 렌더/클릭 시점의 실제 DOM에서 직접 측정한다. offset*은 레이아웃
  // 좌표라 줌/팬(CSS transform)과 무관하다. 단발성 측정(useLayoutEffect+state)은
  // react-zoom-pan-pinch 초기 레이아웃 타이밍에 따라 비어버릴 수 있어, 마커·작성기
  // 위치가 항상 정확하도록 현재 DOM을 읽는다. (offsetParent = position:relative contentRef)
  function measureBoxes(): PageBox[] {
    const content = contentRef.current;
    if (!content) return [];
    const out: PageBox[] = [];
    content.querySelectorAll<HTMLElement>("[data-page-index]").forEach((el) => {
      const i = Number(el.dataset.pageIndex);
      const po = pages[i]?.pageOrder;
      if (po == null) return;
      out.push({
        left: el.offsetLeft,
        top: el.offsetTop,
        width: el.offsetWidth,
        height: el.offsetHeight,
        pageOrder: po,
      });
    });
    return out;
  }

  function onCaptureClick(e: React.MouseEvent) {
    // 스페이스 패닝 중 발생한 클릭은 핀 배치로 처리하지 않는다.
    if (spaceHeld) return;
    // 비로그인 상태에서 핀을 찍으면 로그인 유도 모달.
    if (isGuest) {
      setLoginOpen(true);
      return;
    }
    const content = contentRef.current;
    if (!content) return;
    const rect = content.getBoundingClientRect();
    const ow = content.offsetWidth;
    if (ow <= 0) return;
    const { cx, cy } = toContent(e.clientX, e.clientY, rect, rect.width / ow);
    const loc = locatePin(cx, cy, measureBoxes());
    if (!loc) return;
    onSelectId(null);
    setEditingId(null);
    setDraftBody("");
    setDraft(loc);
  }

  function submitDraft() {
    if (!draft) return;
    const body = draftBody.trim();
    if (!body) return;
    createMut.mutate(
      { ...draft, body, variantId, versionId, authorColor: rt?.myColor ?? "#3b82f6" },
      {
        onSuccess: (saved) => {
          rt?.broadcastPin(saved);
          setDraft(null);
          setDraftBody("");
        },
      },
    );
  }

  // 렌더 시점 실측: contentRef.current를 읽지만 반응형 상태가 아닌 DOM 레이아웃
  // 측정이며 매 렌더 재계산된다(오버레이 위치용). 마운트 후 setDraft/setPins 리렌더
  // 시점엔 ref가 연결돼 정확한 값을 얻는다.
  // eslint-disable-next-line react-hooks/refs
  const boxesByOrder = new Map(measureBoxes().map((b) => [b.pageOrder, b]));

  return (
    <div className="pointer-events-none absolute inset-0">
      {mode === "comment" && (
        // 시안 밖에도 핀을 찍을 수 있도록 콘텐츠(이미지 묶음) 박스보다 크게 확장한다.
        // 핀 마커/작성기는 DOM상 이 오버레이 뒤에 와서 위에 깔리므로 클릭이 유지된다.
        <div
          className={cn(
            "pointer-events-auto absolute",
            spaceHeld ? "cursor-grab" : "cursor-crosshair",
          )}
          style={{ inset: "-100000px" }}
          onClick={onCaptureClick}
        />
      )}

      {/* 팝오버가 열려 있을 때 바깥 클릭으로 닫는다(피그마식). 마커/팝오버는 DOM상
          뒤에 와서 위에 깔리므로, 이 백드롭은 그 외 영역의 클릭만 받는다. */}
      {selectedId && (
        <div
          className="pointer-events-auto absolute"
          style={{ inset: "-100000px" }}
          onClick={() => onSelectId(null)}
        />
      )}

      {pins.map((p) => {
        const b = boxesByOrder.get(p.pageOrder);
        if (!b) return null;
        const { x, y } = placePin(b, p.xNorm, p.yNorm);
        const mine = !isGuest && p.authorId === pin.viewerId;
        const open = selectedId === p.id;
        return (
          <div
            key={p.id}
            id={pinElementId(p.id)}
            className="absolute"
            style={{ left: x, top: y }}
          >
            <button
              className="pointer-events-auto block"
              style={{ transform: INV, transformOrigin: "0 100%" }}
              aria-label={`${p.authorName}의 코멘트`}
              onClick={(e) => {
                e.stopPropagation();
                setDraft(null);
                setEditingId(null);
                onSelectId(open ? null : p.id);
              }}
            >
              <PinMarker name={p.authorName} color={p.authorColor} resolved={p.resolved} active={open} />
            </button>
            {open && (
              <div
                className="border-border/70 bg-background pointer-events-auto absolute top-0 left-3 w-72 origin-top-left rounded-2xl border shadow-[0_8px_30px_rgb(0,0,0,0.12)]"
                style={{ transform: INV, transformOrigin: "0 0" }}
              >
                {/* 헤더 — 아바타 · 이름 · 시각 · 처리 토글 · 더보기(피그마 스레드 카드) */}
                <div className="flex items-center gap-2.5 px-3.5 pt-3 pb-1">
                  <PinAvatar name={p.authorName} color={p.authorColor} />
                  <div className="min-w-0 flex-1 leading-tight">
                    <div className="truncate text-[13px] font-semibold">{p.authorName}</div>
                    <time className="text-muted-foreground text-[11px] tabular-nums">
                      {formatPinTime(p.createdAt)}
                    </time>
                  </div>
                  {!isGuest && (
                    <button
                      aria-label={p.resolved ? "재오픈" : "해결로 표시"}
                      title={p.resolved ? "재오픈" : "해결로 표시"}
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors",
                        p.resolved
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : "border-border text-muted-foreground hover:border-emerald-500 hover:text-emerald-600",
                      )}
                      onClick={() =>
                        resolveMut.mutate(
                          { pinId: p.id, resolved: !p.resolved },
                          { onSuccess: (saved) => rt?.broadcastPinUpdated(saved) },
                        )
                      }
                    >
                      <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
                    </button>
                  )}
                  {mine && editingId !== p.id && (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        aria-label="더보기"
                        className="text-muted-foreground hover:bg-muted hover:text-foreground flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors"
                      >
                        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-32">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditBody(p.body);
                            setEditingId(p.id);
                          }}
                        >
                          <Pencil aria-hidden="true" />
                          수정
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() =>
                            deleteMut.mutate(p.id, {
                              onSuccess: (id) => rt?.broadcastPinDeleted(id),
                            })
                          }
                        >
                          <Trash2 aria-hidden="true" />
                          삭제
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>

                {editingId === p.id ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      editMut.mutate(
                        { pinId: p.id, body: editBody.trim() },
                        {
                          onSuccess: (saved) => {
                            rt?.broadcastPinUpdated(saved);
                            setEditingId(null);
                          },
                        },
                      );
                    }}
                    className="space-y-2 px-3.5 pt-2 pb-3.5"
                  >
                    <Input
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      maxLength={2000}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="h-9 rounded-lg"
                      aria-label="코멘트 수정"
                    />
                    <div className="flex justify-end gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7"
                        onClick={() => setEditingId(null)}
                      >
                        취소
                      </Button>
                      <Button type="submit" size="sm" className="h-7" disabled={!editBody.trim()}>
                        저장
                      </Button>
                    </div>
                  </form>
                ) : (
                  <p className="text-foreground px-3.5 pt-1 pb-3.5 text-[13px] leading-relaxed wrap-break-word whitespace-pre-wrap">
                    {p.body}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}

      {draft &&
        (() => {
          const b = boxesByOrder.get(draft.pageOrder);
          if (!b) return null;
          const { x, y } = placePin(b, draft.xNorm, draft.yNorm);
          return (
            <div className="absolute" style={{ left: x, top: y }}>
              <span className="block" style={{ transform: INV, transformOrigin: "0 100%" }}>
                <PinMarker color={rt?.myColor ?? "#3b82f6"} active />
              </span>
              <div
                className="border-border/70 bg-background pointer-events-auto absolute top-0 left-3 w-72 origin-top-left rounded-2xl border p-3.5 text-sm shadow-[0_8px_30px_rgb(0,0,0,0.12)]"
                style={{ transform: INV, transformOrigin: "0 0" }}
              >
                {/* 게스트는 클릭 시 로그인 모달로 분기하므로 draft는 로그인 사용자만 생성된다. */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    submitDraft();
                  }}
                  className="space-y-2"
                >
                  <Input
                    autoFocus
                    value={draftBody}
                    onChange={(e) => setDraftBody(e.target.value)}
                    maxLength={2000}
                    placeholder="코멘트를 남겨주세요…"
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setDraft(null);
                    }}
                    className="h-9 rounded-lg"
                    aria-label="코멘트 입력"
                  />
                  <div className="flex justify-end gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7"
                      onClick={() => setDraft(null)}
                    >
                      취소
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      className="h-7"
                      disabled={!draftBody.trim() || createMut.isPending}
                    >
                      저장
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          );
        })()}

      <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
        <DialogContent className="pointer-events-auto gap-6 p-6">
          <DialogHeader className="gap-3">
            <DialogTitle>로그인이 필요합니다</DialogTitle>
            <DialogDescription>
              코멘트 핀을 남기려면 로그인해 주세요.
              <br />
              로그인 후 현재 화면으로 돌아옵니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLoginOpen(false)}>
              취소
            </Button>
            <Button
              onClick={() => {
                const returnTo =
                  typeof window !== "undefined"
                    ? window.location.pathname + window.location.search
                    : "/";
                window.location.href = `/login?returnTo=${encodeURIComponent(returnTo)}`;
              }}
            >
              로그인
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
