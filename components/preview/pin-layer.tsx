"use client";
import { useCallback, useLayoutEffect, useState } from "react";
import { toContent } from "@/lib/realtime/coords";
import { locatePin, placePin, type PageBox } from "@/lib/pins/locate";
import { usePins } from "@/lib/pins/use-pins";
import type { PinContext } from "@/lib/pins/types";
import type { PreviewPage } from "@/lib/preview/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Draft = { pageOrder: number; xNorm: number; yNorm: number } | null;
const INV = "scale(var(--inv-scale,5))";

function PinDot({ color, faded }: { color: string; faded?: boolean }) {
  return (
    <span className="block h-3.5 w-3.5 rounded-full border-2 border-white shadow"
      style={{ backgroundColor: color, opacity: faded ? 0.4 : 1 }} />
  );
}

export function PinLayer({ contentRef, pages, pin, mode }: {
  contentRef: React.RefObject<HTMLDivElement | null>;
  pages: PreviewPage[];
  pin: PinContext;
  mode: "pan" | "comment";
}) {
  const { pins, createPin, editPin, toggleResolved, deletePin } = usePins(pin);
  const [draft, setDraft] = useState<Draft>(null);
  const [draftBody, setDraftBody] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const isGuest = pin.viewerId == null;

  // Page boxes are measured from the DOM after paint, stored in state so they
  // can be used safely during render without accessing the ref directly.
  const [boxes, setBoxes] = useState<PageBox[]>([]);
  const pagesKey = pages.map((p) => p.pageOrder).join(",");

  // 박스는 레이아웃 좌표(offset*) — 줌/팬(CSS transform)과 무관하므로 페이지 집합이
  // 바뀔 때만 재측정하면 된다. 이미지에 width/height가 명시돼 마운트 시점에 이미 정확.
  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const out: PageBox[] = [];
    content.querySelectorAll<HTMLElement>("[data-page-index]").forEach((el) => {
      const i = Number(el.dataset.pageIndex);
      const po = pages[i]?.pageOrder;
      if (po == null) return;
      out.push({ left: el.offsetLeft, top: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight, pageOrder: po });
    });
    setBoxes(out);
  // contentRef는 안정 ref; pagesKey가 페이지 집합 변경을 커버한다.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagesKey]);

  // Kept as a ref-accessor used only from event handlers (not render).
  const readBoxes = useCallback((): PageBox[] => {
    const content = contentRef.current;
    if (!content) return [];
    const out: PageBox[] = [];
    content.querySelectorAll<HTMLElement>("[data-page-index]").forEach((el) => {
      const i = Number(el.dataset.pageIndex);
      const po = pages[i]?.pageOrder;
      if (po == null) return;
      out.push({ left: el.offsetLeft, top: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight, pageOrder: po });
    });
    return out;
  // pages is stable-by-reference from parent memoisation; pagesKey covers identity changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagesKey]);

  function onCaptureClick(e: React.MouseEvent) {
    const content = contentRef.current;
    if (!content) return;
    const rect = content.getBoundingClientRect();
    const ow = content.offsetWidth;
    if (ow <= 0) return;
    const { cx, cy } = toContent(e.clientX, e.clientY, rect, rect.width / ow);
    const loc = locatePin(cx, cy, readBoxes());
    if (!loc) return;
    setSelectedId(null);
    setEditingId(null);
    setDraftBody("");
    setDraft(loc);
  }

  async function submitDraft() {
    if (!draft) return;
    const body = draftBody.trim();
    if (!body) return;
    const ok = await createPin({ ...draft, body });
    if (ok) { setDraft(null); setDraftBody(""); }
  }

  const boxesByOrder = new Map(boxes.map((b) => [b.pageOrder, b]));

  return (
    <div className="pointer-events-none absolute inset-0">
      {mode === "comment" && <div className="pointer-events-auto absolute inset-0 cursor-crosshair" onClick={onCaptureClick} />}

      {pins.map((p) => {
        const b = boxesByOrder.get(p.pageOrder);
        if (!b) return null;
        const { x, y } = placePin(b, p.xNorm, p.yNorm);
        const mine = !isGuest && p.authorId === pin.viewerId;
        const open = selectedId === p.id;
        return (
          <div key={p.id} className="absolute" style={{ left: x, top: y }}>
            <button className="pointer-events-auto block"
              style={{ transform: INV, transformOrigin: "0 100%" }}
              onClick={(e) => { e.stopPropagation(); setDraft(null); setEditingId(null); setSelectedId(open ? null : p.id); }}>
              <PinDot color={p.authorColor} faded={p.resolved} />
            </button>
            {open && (
              <div className="pointer-events-auto absolute left-2 top-0 w-56 rounded-lg border border-border bg-background p-3 text-sm shadow-lg"
                style={{ transform: INV, transformOrigin: "0 0" }}>
                <div className="flex items-center justify-between">
                  <span className="font-medium" style={{ color: p.authorColor }}>{p.authorName}</span>
                  <button className="text-xs text-muted-foreground" onClick={() => setSelectedId(null)}>닫기</button>
                </div>
                {editingId === p.id ? (
                  <form onSubmit={async (e) => { e.preventDefault(); if (await editPin(p.id, editBody.trim())) setEditingId(null); }} className="mt-2 space-y-2">
                    <Input value={editBody} onChange={(e) => setEditBody(e.target.value)} maxLength={2000} className="h-8" aria-label="코멘트 수정" />
                    <div className="flex gap-1">
                      <Button type="submit" size="sm" className="h-7" disabled={!editBody.trim()}>저장</Button>
                      <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => setEditingId(null)}>취소</Button>
                    </div>
                  </form>
                ) : (
                  <p className="mt-2 whitespace-pre-wrap break-words">{p.body}</p>
                )}
                {!isGuest && editingId !== p.id && (
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <button className="underline" onClick={() => toggleResolved(p.id, !p.resolved)}>
                      {p.resolved ? "재오픈" : "처리됨"}
                    </button>
                    {mine && <button className="underline" onClick={() => { setEditBody(p.body); setEditingId(p.id); }}>수정</button>}
                    {mine && <button className="text-destructive underline" onClick={() => deletePin(p.id)}>삭제</button>}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {draft && (() => {
        const b = boxesByOrder.get(draft.pageOrder);
        if (!b) return null;
        const { x, y } = placePin(b, draft.xNorm, draft.yNorm);
        return (
          <div className="absolute" style={{ left: x, top: y }}>
            <span className="block" style={{ transform: INV, transformOrigin: "0 100%" }}><PinDot color="#3b82f6" /></span>
            <div className="pointer-events-auto absolute left-2 top-0 w-56 rounded-lg border border-border bg-background p-3 text-sm shadow-lg"
              style={{ transform: INV, transformOrigin: "0 0" }}>
              {isGuest ? (
                <div className="space-y-2">
                  <p>핀을 남기려면 로그인이 필요합니다.</p>
                  <a className="inline-block underline" href={`/login?returnTo=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname + window.location.search : "/")}`}>로그인</a>
                  <button className="ml-2 text-xs text-muted-foreground" onClick={() => setDraft(null)}>닫기</button>
                </div>
              ) : (
                <form onSubmit={(e) => { e.preventDefault(); submitDraft(); }} className="space-y-2">
                  <Input autoFocus value={draftBody} onChange={(e) => setDraftBody(e.target.value)} maxLength={2000} placeholder="코멘트 입력" className="h-8" aria-label="코멘트 입력" />
                  <div className="flex gap-1">
                    <Button type="submit" size="sm" className="h-7" disabled={!draftBody.trim()}>저장</Button>
                    <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => setDraft(null)}>취소</Button>
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
