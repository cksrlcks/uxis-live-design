"use client";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toContent } from "@/shared/realtime/coords";
import { locatePin, placePin, type PageBox } from "../lib/locate";
import { pinQueries, type PinDTO, type PinContext } from "@/entities/pin";
import { useCreatePin, useEditPin, useToggleResolved, useDeletePin } from "@/features/pin-comment";
import { useRealtimeOptional } from "@/shared/realtime/realtime-provider";
import type { ProposalPage } from "@/entities/proposal";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

type Draft = { pageOrder: number; xNorm: number; yNorm: number } | null;
const INV = "scale(var(--inv-scale,5))";

function PinDot({ color, faded }: { color: string; faded?: boolean }) {
  return (
    <span
      className="block h-3.5 w-3.5 rounded-full border-2 border-white shadow"
      style={{ backgroundColor: color, opacity: faded ? 0.4 : 1 }}
    />
  );
}

export function PinLayer({
  contentRef,
  pages,
  pin,
  mode,
}: {
  contentRef: React.RefObject<HTMLDivElement | null>;
  pages: ProposalPage[];
  pin: PinContext;
  mode: "pan" | "comment";
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
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
    const content = contentRef.current;
    if (!content) return;
    const rect = content.getBoundingClientRect();
    const ow = content.offsetWidth;
    if (ow <= 0) return;
    const { cx, cy } = toContent(e.clientX, e.clientY, rect, rect.width / ow);
    const loc = locatePin(cx, cy, measureBoxes());
    if (!loc) return;
    setSelectedId(null);
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
        <div
          className="pointer-events-auto absolute inset-0 cursor-crosshair"
          onClick={onCaptureClick}
        />
      )}

      {pins.map((p) => {
        const b = boxesByOrder.get(p.pageOrder);
        if (!b) return null;
        const { x, y } = placePin(b, p.xNorm, p.yNorm);
        const mine = !isGuest && p.authorId === pin.viewerId;
        const open = selectedId === p.id;
        return (
          <div key={p.id} className="absolute" style={{ left: x, top: y }}>
            <button
              className="pointer-events-auto block"
              style={{ transform: INV, transformOrigin: "0 100%" }}
              onClick={(e) => {
                e.stopPropagation();
                setDraft(null);
                setEditingId(null);
                setSelectedId(open ? null : p.id);
              }}
            >
              <PinDot color={p.authorColor} faded={p.resolved} />
            </button>
            {open && (
              <div
                className="border-border bg-background pointer-events-auto absolute top-0 left-2 w-56 rounded-lg border p-3 text-sm shadow-lg"
                style={{ transform: INV, transformOrigin: "0 0" }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium" style={{ color: p.authorColor }}>
                    {p.authorName}
                  </span>
                  <button
                    className="text-muted-foreground text-xs"
                    onClick={() => setSelectedId(null)}
                  >
                    닫기
                  </button>
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
                    className="mt-2 space-y-2"
                  >
                    <Input
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      maxLength={2000}
                      className="h-8"
                      aria-label="코멘트 수정"
                    />
                    <div className="flex gap-1">
                      <Button type="submit" size="sm" className="h-7" disabled={!editBody.trim()}>
                        저장
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7"
                        onClick={() => setEditingId(null)}
                      >
                        취소
                      </Button>
                    </div>
                  </form>
                ) : (
                  <p className="mt-2 break-words whitespace-pre-wrap">{p.body}</p>
                )}
                {!isGuest && editingId !== p.id && (
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <button
                      className="underline"
                      onClick={() =>
                        resolveMut.mutate(
                          { pinId: p.id, resolved: !p.resolved },
                          { onSuccess: (saved) => rt?.broadcastPinUpdated(saved) },
                        )
                      }
                    >
                      {p.resolved ? "재오픈" : "처리됨"}
                    </button>
                    {mine && (
                      <button
                        className="underline"
                        onClick={() => {
                          setEditBody(p.body);
                          setEditingId(p.id);
                        }}
                      >
                        수정
                      </button>
                    )}
                    {mine && (
                      <button
                        className="text-destructive underline"
                        onClick={() =>
                          deleteMut.mutate(p.id, {
                            onSuccess: (id) => rt?.broadcastPinDeleted(id),
                          })
                        }
                      >
                        삭제
                      </button>
                    )}
                  </div>
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
                <PinDot color="#3b82f6" />
              </span>
              <div
                className="border-border bg-background pointer-events-auto absolute top-0 left-2 w-56 rounded-lg border p-3 text-sm shadow-lg"
                style={{ transform: INV, transformOrigin: "0 0" }}
              >
                {isGuest ? (
                  <div className="space-y-2">
                    <p>핀을 남기려면 로그인이 필요합니다.</p>
                    <a
                      className="inline-block underline"
                      href={`/login?returnTo=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname + window.location.search : "/")}`}
                    >
                      로그인
                    </a>
                    <button
                      className="text-muted-foreground ml-2 text-xs"
                      onClick={() => setDraft(null)}
                    >
                      닫기
                    </button>
                  </div>
                ) : (
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
                      placeholder="코멘트 입력"
                      className="h-8"
                      aria-label="코멘트 입력"
                    />
                    <div className="flex gap-1">
                      <Button type="submit" size="sm" className="h-7" disabled={!draftBody.trim()}>
                        저장
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7"
                        onClick={() => setDraft(null)}
                      >
                        취소
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          );
        })()}
    </div>
  );
}
