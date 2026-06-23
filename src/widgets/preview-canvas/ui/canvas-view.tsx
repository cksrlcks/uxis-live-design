"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Hand, MessageSquare, MessagesSquare, Pen } from "lucide-react";
import {
  TransformWrapper,
  TransformComponent,
  type ReactZoomPanPinchRef,
} from "react-zoom-pan-pinch";
import type { ProposalPage } from "@/entities/proposal";
import type { PinContext } from "@/entities/pin";
import { CanvasCursorLayer, CanvasCursorCapture } from "./canvas-cursors";
import { PinLayer } from "./pin-layer";
import { WhiteboardLayer } from "./whiteboard-layer";
import { CommentsPanel } from "./comments-panel";
import { pinElementId } from "../lib/format";
import { computeFitScale } from "../lib/fit-zoom";
import { cn } from "@/shared/lib/utils";

// 화이트보드(그리기) 기능은 DB 쓰기 부담으로 현재 비활성화. 진입 버튼·표시 토글·레이어를
// 모두 이 플래그로 숨긴다. 코드는 남겨두므로 다시 켜려면 true로 바꾸면 된다.
const WHITEBOARD_ENABLED: boolean = true;

export function CanvasView({
  pages,
  pin,
  controlsHidden = false,
}: {
  pages: ProposalPage[];
  pin?: PinContext;
  // 하단 dock이 접히면 일반/코멘트 컨트롤러도 함께 숨긴다.
  controlsHidden?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const transformRef = useRef<ReactZoomPanPinchRef>(null);
  const [mode, setMode] = useState<"pan" | "comment" | "draw">("pan");
  // 스페이스를 누르고 있는 동안은 코멘트 모드여도 좌클릭 드래그로 화면 이동.
  const [spaceHeld, setSpaceHeld] = useState(false);
  // 핀 선택 상태는 여기서 들고, 캔버스(PinLayer)·코멘트 리스트가 공유한다.
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  // 화이트보드 그림 표시/숨김(로컬 보기 설정). 숨기면 그리기·지우기도 비활성.
  const [strokesVisible, setStrokesVisible] = useState(true);

  // 리스트에서 핀 클릭 → 선택 + 해당 핀이 화면 중앙에 오도록 이동(줌 레벨은 유지).
  const focusPin = useCallback((id: string) => {
    setSelectedPinId(id);
    const api = transformRef.current;
    const el = typeof document !== "undefined" ? document.getElementById(pinElementId(id)) : null;
    if (!api || !el) return;
    const scale = Math.max(api.state.scale, 0.7);
    api.zoomToElement(el, scale, 300);
  }, []);

  useEffect(() => {
    const isTyping = (t: EventTarget | null) =>
      t instanceof HTMLElement &&
      (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat || isTyping(e.target)) return;
      e.preventDefault(); // 스페이스로 인한 페이지 스크롤 방지
      setSpaceHeld(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceHeld(false);
    };
    const reset = () => setSpaceHeld(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", reset);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", reset);
    };
  }, []);

  const applyInvScale = useCallback((scale: number) => {
    const el = contentRef.current;
    if (el && scale > 0) el.style.setProperty("--inv-scale", String(1 / scale));
  }, []);

  // 캔버스 첫 진입(마운트) 시: 모든 페이지가 한눈에 들어오도록 콘텐츠 strip 전체를
  // 뷰포트에 맞춰 줌·중앙 정렬한다. 세로까지 fit 하므로 상단이 잘리지 않는다.
  const fitToView = useCallback(
    (api: ReactZoomPanPinchRef) => {
      const viewport = rootRef.current;
      const content = contentRef.current;
      if (!viewport || !content) return;
      const scale = computeFitScale({
        // offsetWidth/Height는 CSS transform 영향을 받지 않으므로 scale=1 기준 원본 크기.
        contentWidth: content.offsetWidth,
        contentHeight: content.offsetHeight,
        viewportWidth: viewport.clientWidth,
        viewportHeight: viewport.clientHeight,
      });
      api.centerView(scale, 0);
      applyInvScale(scale);
    },
    [applyInvScale],
  );

  if (pages.length === 0) {
    return <div className="text-muted-foreground p-8 text-sm">페이지가 없습니다.</div>;
  }

  const commenting = !!pin && mode === "comment";
  // 그리기 모드에서도 좌클릭은 펜 입력이므로 패닝 비활성(스페이스 예외).
  const drawing = !!pin && mode === "draw";

  return (
    <div ref={rootRef} className="bg-dot-grid relative h-full w-full">
      {pin && !controlsHidden && (
        <div className="pointer-events-none fixed inset-x-0 bottom-20 z-40 flex justify-center px-4">
          <div className="bg-foreground/95 pointer-events-auto flex items-center gap-1 rounded-full px-1.5 py-1.5 shadow-lg backdrop-blur-md">
            <button
              type="button"
              onClick={() => setMode("pan")}
              className={cn(
                "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
                mode === "pan"
                  ? "text-foreground bg-white shadow-sm"
                  : "text-white/60 hover:bg-white/10 hover:text-white",
              )}
            >
              <Hand className="h-3.5 w-3.5" aria-hidden="true" />
              일반
            </button>
            <button
              type="button"
              onClick={() => setMode("comment")}
              className={cn(
                "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
                mode === "comment"
                  ? "text-foreground bg-white shadow-sm"
                  : "text-white/60 hover:bg-white/10 hover:text-white",
              )}
            >
              <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
              코멘트
            </button>
            {WHITEBOARD_ENABLED && (
              <>
                <button
                  type="button"
                  // 그리기에 진입하면 숨김 상태였더라도 그림을 다시 보이게 한다(숨긴 채 그리는 혼란 방지).
                  onClick={() => {
                    setMode("draw");
                    setStrokesVisible(true);
                  }}
                  className={cn(
                    "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
                    mode === "draw"
                      ? "text-foreground bg-white shadow-sm"
                      : "text-white/60 hover:bg-white/10 hover:text-white",
                  )}
                >
                  <Pen className="h-3.5 w-3.5" aria-hidden="true" />
                  그리기
                </button>
                <button
                  type="button"
                  onClick={() => setStrokesVisible((v) => !v)}
                  aria-pressed={!strokesVisible}
                  title={strokesVisible ? "화이트보드 숨기기" : "화이트보드 보이기"}
                  className={cn(
                    "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
                    !strokesVisible
                      ? "text-foreground bg-white shadow-sm"
                      : "text-white/60 hover:bg-white/10 hover:text-white",
                  )}
                >
                  {strokesVisible ? (
                    <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  화이트보드
                </button>
              </>
            )}

            <span className="mx-0.5 h-5 w-px bg-white/15" aria-hidden="true" />

            <button
              type="button"
              onClick={() => setListOpen((v) => !v)}
              aria-pressed={listOpen}
              className={cn(
                "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
                listOpen
                  ? "text-foreground bg-white shadow-sm"
                  : "text-white/60 hover:bg-white/10 hover:text-white",
              )}
            >
              <MessagesSquare className="h-3.5 w-3.5" aria-hidden="true" />
              목록
            </button>
          </div>
        </div>
      )}

      {pin && !controlsHidden && listOpen && (
        <CommentsPanel
          pin={pin}
          selectedId={selectedPinId}
          onSelect={focusPin}
          onClose={() => setListOpen(false)}
        />
      )}
      <TransformWrapper
        ref={transformRef}
        minScale={0.1}
        maxScale={3}
        initialScale={0.2}
        centerOnInit
        limitToBounds={false}
        wheel={{ step: 0.001 }}
        panning={{
          // 코멘트/그리기 모드에서는 좌클릭이 핀 배치·펜 입력이므로 패닝 비활성. 단 스페이스를 누르면 좌클릭 패닝 허용.
          allowLeftClickPan: !(commenting || drawing) || spaceHeld,
          // 휠(미들) 클릭 드래그는 어느 모드에서나 화면 이동.
          allowMiddleClickPan: true,
        }}
        onInit={(ref) => fitToView(ref)}
        onTransform={(_ref, state) => applyInvScale(state.scale)}
      >
        <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }}>
          <div ref={contentRef} style={{ position: "relative", width: "max-content" }}>
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                flexWrap: "nowrap",
                alignItems: "flex-start",
                gap: "3rem",
                padding: "2rem",
                width: "max-content",
              }}
            >
              {pages.map((pg, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={pg.id}
                  data-page-index={i}
                  src={pg.url}
                  alt=""
                  width={pg.width}
                  height={pg.height}
                  draggable={false}
                  className="border-border bg-background block max-w-none shrink-0 border select-none"
                />
              ))}
            </div>
            <CanvasCursorLayer />
            {pin && (
              <PinLayer
                contentRef={contentRef}
                pages={pages}
                pin={pin}
                mode={mode}
                spaceHeld={spaceHeld}
                selectedId={selectedPinId}
                onSelectId={setSelectedPinId}
              />
            )}
            {WHITEBOARD_ENABLED && pin && (
              <WhiteboardLayer
                contentRef={contentRef}
                pages={pages}
                ctx={{
                  publicId: pin.publicId,
                  variantId: pin.variantId,
                  versionId: pin.versionId,
                  viewerId: pin.viewerId,
                }}
                mode={mode}
                spaceHeld={spaceHeld}
                visible={strokesVisible}
              />
            )}
          </div>
        </TransformComponent>
        <CanvasCursorCapture rootRef={rootRef} contentRef={contentRef} />
      </TransformWrapper>
    </div>
  );
}
