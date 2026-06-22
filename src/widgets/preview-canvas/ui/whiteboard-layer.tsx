"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eraser, Pen } from "lucide-react";
import { toast } from "sonner";
import { toContent } from "@/shared/realtime/coords";
import { locatePin, type PageBox } from "../lib/locate";
import { eraseStrokePoints, eraserBBox, strokeIntersectsBBox } from "../lib/erase";
import {
  strokeQueries,
  type StrokeDTO,
  type CreateStrokeInput,
  type WhiteboardContext,
} from "@/entities/whiteboard";
import { useCreateStroke, useDeleteStroke } from "@/features/whiteboard";
import { useRealtimeOptional } from "@/shared/realtime/realtime-provider";
import type { ProposalPage } from "@/entities/proposal";
import { cn } from "@/shared/lib/utils";

type Tool = "pen" | "eraser";

// peer의 그리는 중 라이브 스트로크(정규화 좌표 누적).
type LiveStroke = {
  variantId: string;
  versionId: string;
  pageOrder: number;
  color: string;
  width: number;
  points: { x: number; y: number }[];
};
// 내 드로잉 세션(시작 시 앵커 페이지·색·굵기를 고정).
type DrawSession = { drawId: string; pageOrder: number; color: string; width: number };

// 라이브 스트림용 stroke 식별자.
function newDrawId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

// 펜 색상 팔레트(스트로크 색). 작성자 표기색(identity color)과는 별개다.
const PALETTE = ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#111827"];
// 페이지 폭 기준 정규화 굵기 — 해상도가 다른 시안에서도 동일한 두께로 보이게 한다.
const WIDTHS: { key: string; w: number }[] = [
  { key: "S", w: 0.002 },
  { key: "M", w: 0.004 },
  { key: "L", w: 0.008 },
];

// 콘텐츠 좌표 점들을 stroke의 앵커 페이지 박스 기준으로 정규화/역변환.
function normPoint(cx: number, cy: number, b: PageBox) {
  return { x: (cx - b.left) / b.width, y: (cy - b.top) / b.height };
}
function strokePath(points: { x: number; y: number }[], b: PageBox): string {
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${b.left + p.x * b.width} ${b.top + p.y * b.height}`)
    .join(" ");
}

export function WhiteboardLayer({
  contentRef,
  pages,
  ctx,
  mode,
  spaceHeld,
  visible = true,
}: {
  contentRef: React.RefObject<HTMLDivElement | null>;
  pages: ProposalPage[];
  ctx: WhiteboardContext;
  mode: "pan" | "comment" | "draw";
  spaceHeld: boolean;
  // 그림 표시/숨김(로컬). 숨기면 stroke 렌더와 그리기·지우기 입력을 모두 끈다.
  visible?: boolean;
}) {
  const { publicId, variantId, versionId } = ctx;
  const rt = useRealtimeOptional();
  const qc = useQueryClient();
  const { data: strokes = [] } = useQuery(strokeQueries.list(publicId, variantId, versionId));
  const createMut = useCreateStroke(publicId, variantId, versionId);
  const deleteMut = useDeleteStroke(publicId, variantId, versionId);

  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState(PALETTE[3]);
  const [width, setWidth] = useState(WIDTHS[1].w);
  // 그리는 중인 경로(콘텐츠 좌표). 펜을 떼면 정규화하여 저장한다.
  const [drawing, setDrawing] = useState<{ x: number; y: number }[] | null>(null);

  // 지우개(부분 삭제) — 지우개가 지나간 경로(콘텐츠 좌표). 떼면 잘린 결과를 커밋.
  // 미리보기 갱신만 state(rAF로 합침)로, 커서는 ref로 직접 조작(hover 리렌더 0).
  const [eraserPath, setEraserPath] = useState<{ x: number; y: number }[]>([]);
  const eraserPathRef = useRef<{ x: number; y: number }[]>([]);
  const eraserDownRef = useRef(false);
  const cursorRef = useRef<SVGCircleElement | null>(null);
  const rafRef = useRef<number | null>(null);

  // peer가 "지금 그리는 중"인 라이브 스트로크(정규화 좌표). drawId로 키잉, pen-up(draw_end) 시 제거.
  const [liveStrokes, setLiveStrokes] = useState<Map<string, LiveStroke>>(() => new Map());
  // 내 드로잉 세션 상태(고빈도 스트리밍용 ref — 리렌더 없이 인터벌에서 읽는다).
  const sessionRef = useRef<DrawSession | null>(null);
  const pointsRef = useRef<{ x: number; y: number }[]>([]);
  const sentLenRef = useRef(0);
  // 마지막 라이브 전송 시각 — move 핸들러에서 직접 throttle(공식 예제처럼). interval 클로저 의존 제거.
  const lastSentRef = useRef(0);
  // 툴바는 줌/팬 transform 컨테이닝 블록을 벗어나야 하므로 body로 포털한다(SSR 가드).
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: portal target(body)는 클라이언트에서만 — SSR 하이드레이션 불일치 방지
    setMounted(true);
  }, []);

  // 언마운트 시 대기 중인 지우개 미리보기 rAF 정리.
  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // 숨김 상태면 그리기·지우기 입력을 막는다(숨긴 레이어에 그리는 혼란 방지).
  const active = mode === "draw" && visible;

  // 실시간 병합(현재 버전 대상만). subscribeStrokes는 안정 참조라 재구독 누락 윈도우가 없다.
  const subscribeStrokes = rt?.subscribeStrokes;
  useEffect(() => {
    if (!subscribeStrokes) return;
    return subscribeStrokes((e) => {
      const key = strokeQueries.list(publicId, variantId, versionId).queryKey;
      if (e.type === "stroke_deleted") {
        qc.setQueryData<StrokeDTO[]>(key, (prev) => prev?.filter((s) => s.id !== e.id));
        return;
      }
      const s = e.stroke as StrokeDTO;
      if (s.variantId !== variantId || s.versionId !== versionId) return;
      qc.setQueryData<StrokeDTO[]>(key, (prev) => {
        if (!prev) return prev;
        return prev.some((x) => x.id === s.id) ? prev : [...prev, s];
      });
    });
  }, [subscribeStrokes, qc, publicId, variantId, versionId]);

  // peer의 라이브 드로잉 수신(현재 버전 대상만). draw_end로 라이브 제거 — 직후 영구 stroke가 대체.
  const subscribeDraw = rt?.subscribeDraw;
  useEffect(() => {
    if (!subscribeDraw) return;
    return subscribeDraw((e) => {
      if (e.type === "draw_end") {
        setLiveStrokes((prev) => {
          if (!prev.has(e.drawId)) return prev;
          const next = new Map(prev);
          next.delete(e.drawId);
          return next;
        });
        return;
      }
      const d = e.data as {
        drawId: string;
        variantId: string;
        versionId: string;
        pageOrder: number;
        color: string;
        width: number;
        points: { x: number; y: number }[];
      };
      if (d.variantId !== variantId || d.versionId !== versionId) {
        console.debug("[wb] draw 수신 but 버전 불일치(필터)", {
          got: { v: d.variantId, ver: d.versionId },
          mine: { v: variantId, ver: versionId },
        });
        return;
      }
      console.debug("[wb] draw 수신 적용", { drawId: d.drawId, n: d.points.length });
      setLiveStrokes((prev) => {
        const next = new Map(prev);
        const cur = next.get(d.drawId);
        next.set(
          d.drawId,
          cur
            ? { ...cur, points: [...cur.points, ...d.points] }
            : {
                variantId: d.variantId,
                versionId: d.versionId,
                pageOrder: d.pageOrder,
                color: d.color,
                width: d.width,
                points: d.points,
              },
        );
        return next;
      });
    });
  }, [subscribeDraw, variantId, versionId]);

  // 페이지 박스를 현재 DOM에서 직접 측정(줌/팬과 무관한 레이아웃 좌표). pin-layer와 동일.
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

  // client 좌표 → 콘텐츠 좌표(줌/팬 보정).
  function toContentPoint(clientX: number, clientY: number): { cx: number; cy: number } | null {
    const content = contentRef.current;
    if (!content) return null;
    const rect = content.getBoundingClientRect();
    const ow = content.offsetWidth;
    if (ow <= 0) return null;
    return toContent(clientX, clientY, rect, rect.width / ow);
  }

  // 아직 안 보낸 점들을 앵커 박스 기준으로 정규화해 배치 broadcast(고빈도 라이브 스트림).
  function flushDraw() {
    const s = sessionRef.current;
    if (!s) return;
    if (!rt) {
      console.warn("[wb] flushDraw: rt(RealtimeProvider) 없음 — broadcast 불가");
      return;
    }
    const pts = pointsRef.current;
    if (pts.length <= sentLenRef.current) return;
    const box = measureBoxes().find((b) => b.pageOrder === s.pageOrder);
    if (!box) return;
    const batch = pts.slice(sentLenRef.current).map((p) => normPoint(p.x, p.y, box));
    sentLenRef.current = pts.length;
    console.debug("[wb] broadcastDraw", { drawId: s.drawId, n: batch.length, variantId, versionId });
    rt.broadcastDraw({
      drawId: s.drawId,
      variantId,
      versionId,
      pageOrder: s.pageOrder,
      color: s.color,
      width: s.width,
      points: batch,
    });
  }

  function onPenDown(e: React.PointerEvent) {
    if (spaceHeld || e.button !== 0) return; // 스페이스 패닝/우클릭은 그리기 아님
    const p = toContentPoint(e.clientX, e.clientY);
    if (!p) return;
    const loc = locatePin(p.cx, p.cy, measureBoxes());
    if (!loc) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    sessionRef.current = { drawId: newDrawId(), pageOrder: loc.pageOrder, color, width };
    pointsRef.current = [{ x: p.cx, y: p.cy }];
    sentLenRef.current = 0;
    lastSentRef.current = 0;
    setDrawing([{ x: p.cx, y: p.cy }]);
  }
  function onPenMove(e: React.PointerEvent) {
    if (!sessionRef.current) return;
    const p = toContentPoint(e.clientX, e.clientY);
    if (!p) return;
    const pts = pointsRef.current;
    const last = pts[pts.length - 1];
    // 콘텐츠 px 기준 최소 간격 — 점 폭주 방지.
    if (last && Math.hypot(p.cx - last.x, p.cy - last.y) < 3) return;
    pts.push({ x: p.cx, y: p.cy });
    setDrawing([...pts]);
    // 공식 예제처럼 move에서 직접 전송하되 ~30ms throttle(메시지 수 제한). 항상 최신 클로저로 실행.
    // e.timeStamp는 이벤트에 담긴 순수 단조 증가 값(performance.now 호출 회피).
    if (e.timeStamp - lastSentRef.current >= 30) {
      lastSentRef.current = e.timeStamp;
      flushDraw();
    }
  }
  function onPenUp() {
    const s = sessionRef.current;
    const pts = pointsRef.current;
    flushDraw(); // 남은 점 전송
    sessionRef.current = null;
    pointsRef.current = [];
    sentLenRef.current = 0;
    if (!s) {
      setDrawing(null);
      return;
    }
    const box = measureBoxes().find((b) => b.pageOrder === s.pageOrder);
    // 점이 부족하거나 앵커 박스를 못 찾으면 저장하지 않고 peer 라이브만 정리.
    if (pts.length < 2 || !box) {
      setDrawing(null);
      rt?.broadcastDrawEnd(s.drawId);
      return;
    }
    const points = pts.map((p) => normPoint(p.x, p.y, box));
    const key = strokeQueries.list(publicId, variantId, versionId).queryKey;
    // 낙관적 삽입 — 임시 stroke를 즉시 캐시에 넣고 로컬 선을 제거한다(같은 핸들러 → 한 커밋, 공백/깜빡임 없음).
    const temp: StrokeDTO = {
      id: s.drawId,
      variantId,
      versionId,
      pageOrder: s.pageOrder,
      points,
      color: s.color,
      width: s.width,
      authorId: null,
      authorName: rt?.myName ?? "Guest",
      authorColor: rt?.myColor ?? "#3b82f6",
      createdAt: "",
    };
    qc.setQueryData<StrokeDTO[]>(key, (prev) => [...(prev ?? []), temp]);
    setDrawing(null);
    createMut.mutate(
      {
        variantId,
        versionId,
        pageOrder: s.pageOrder,
        points,
        color: s.color,
        width: s.width,
        authorName: rt?.myName ?? "Guest",
        authorColor: rt?.myColor ?? "#3b82f6",
      },
      {
        // 저장 성공 시 임시본 제거(실 stroke는 mutation 내부 onSuccess가 이미 append). 위치 동일 → 무플리커.
        onSuccess: (saved) => {
          qc.setQueryData<StrokeDTO[]>(key, (prev) => prev?.filter((x) => x.id !== s.drawId));
          rt?.broadcastStroke(saved);
          rt?.broadcastDrawEnd(s.drawId);
        },
        // 저장 실패 시 임시본 롤백 + peer 라이브 정리.
        onError: () => {
          qc.setQueryData<StrokeDTO[]>(key, (prev) => prev?.filter((x) => x.id !== s.drawId));
          rt?.broadcastDrawEnd(s.drawId);
        },
      },
    );
  }

  // 현재 줌 배율(콘텐츠↔화면). 지우개 반경을 화면 px로 일정하게 유지하는 데 쓴다.
  const ERASER_SCREEN_PX = 14;
  function currentScale(): number {
    const content = contentRef.current;
    if (!content) return 1;
    const rect = content.getBoundingClientRect();
    const ow = content.offsetWidth;
    return ow > 0 ? rect.width / ow : 1;
  }
  function eraserRadiusContent(): number {
    const s = currentScale();
    return s > 0 ? ERASER_SCREEN_PX / s : ERASER_SCREEN_PX;
  }

  // 지우개 커서(원)는 React state가 아니라 ref로 직접 조작 → hover만으로는 리렌더/레이아웃 안 함.
  function moveCursor(cx: number, cy: number) {
    const c = cursorRef.current;
    if (!c) return;
    c.setAttribute("cx", String(cx));
    c.setAttribute("cy", String(cy));
    c.setAttribute("r", String(eraserRadiusContent()));
    c.setAttribute("visibility", "visible");
  }
  function hideCursor() {
    cursorRef.current?.setAttribute("visibility", "hidden");
  }

  function onEraserDown(e: React.PointerEvent) {
    if (spaceHeld || e.button !== 0) return;
    const p = toContentPoint(e.clientX, e.clientY);
    if (!p) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    eraserDownRef.current = true;
    eraserPathRef.current = [{ x: p.cx, y: p.cy }];
    setEraserPath([{ x: p.cx, y: p.cy }]);
    moveCursor(p.cx, p.cy);
  }
  function onEraserMove(e: React.PointerEvent) {
    const p = toContentPoint(e.clientX, e.clientY);
    if (!p) return;
    moveCursor(p.cx, p.cy); // hover 포함 — imperative라 리렌더 없음
    if (!eraserDownRef.current) return;
    const path = eraserPathRef.current;
    const last = path[path.length - 1];
    // 콘텐츠 px 최소 간격으로 다운샘플(점-선분 거리 판정이라 촘촘할 필요 없음).
    const minGap = eraserRadiusContent() / 2;
    if (last && Math.hypot(p.cx - last.x, p.cy - last.y) < minGap) return;
    path.push({ x: p.cx, y: p.cy });
    // 미리보기 갱신을 프레임당 1회로 합친다(rAF). 전체 경로는 ref에 그대로 누적.
    if (rafRef.current == null) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        setEraserPath([...eraserPathRef.current]);
      });
    }
  }
  function onEraserUp() {
    if (!eraserDownRef.current) return;
    eraserDownRef.current = false;
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const path = eraserPathRef.current;
    eraserPathRef.current = [];
    setEraserPath([]);
    void commitErase(path);
  }

  // 지우개 경로로 잘린 결과를 영구화한다. 변경된 stroke는 [살아남은 세그먼트 생성] 후 [원본 삭제].
  // 조각 저장이 모두 성공한 뒤에만 원본을 지운다 → 실패 시 원본 보존(데이터 손실 방지).
  async function commitErase(eraser: { x: number; y: number }[]) {
    if (eraser.length === 0) return;
    const radius = eraserRadiusContent();
    const boxes = measureBoxes();
    const eBox = eraserBBox(eraser, radius);
    const key = strokeQueries.list(publicId, variantId, versionId).queryKey;
    const current = qc.getQueryData<StrokeDTO[]>(key) ?? [];

    const next: StrokeDTO[] = [];
    const ops: { original: StrokeDTO; creates: { tempId: string; input: CreateStrokeInput }[] }[] =
      [];
    for (const stroke of current) {
      const box = boxes.find((b) => b.pageOrder === stroke.pageOrder);
      // 멀리 있는 stroke는 AABB로 빠르게 스킵.
      if (!box || !strokeIntersectsBBox(stroke.points, box, eBox)) {
        next.push(stroke);
        continue;
      }
      const segs = eraseStrokePoints(stroke.points, box, eraser, radius);
      if (segs.length === 1 && segs[0] === stroke.points) {
        next.push(stroke); // 미변경(참조 동일)
        continue;
      }
      const creates: { tempId: string; input: CreateStrokeInput }[] = [];
      for (const seg of segs) {
        const tempId = newDrawId();
        next.push({ ...stroke, id: tempId, points: seg, createdAt: "" });
        creates.push({
          tempId,
          input: {
            variantId,
            versionId,
            pageOrder: stroke.pageOrder,
            points: seg,
            color: stroke.color,
            width: stroke.width,
            // 남의 그림을 부분 지워도 남은 조각은 원작자 표기를 유지한다.
            authorName: stroke.authorName,
            authorColor: stroke.authorColor,
          },
        });
      }
      ops.push({ original: stroke, creates });
    }
    if (ops.length === 0) return; // 아무것도 안 지워짐

    qc.setQueryData<StrokeDTO[]>(key, next); // 낙관적: 즉시 잘린 결과 표시(공백 없음)

    for (const op of ops) {
      try {
        // 1) 살아남은 세그먼트를 모두 저장(성공해야 다음으로). 내부 onSuccess가 saved를 append.
        const saved = await Promise.all(op.creates.map((c) => createMut.mutateAsync(c.input)));
        // 임시본 제거(saved는 이미 추가됨) 후, 조각부터 broadcast.
        qc.setQueryData<StrokeDTO[]>(key, (prev) =>
          prev?.filter((x) => !op.creates.some((c) => c.tempId === x.id)),
        );
        saved.forEach((s) => rt?.broadcastStroke(s));
        // 2) 조각 저장이 끝난 뒤에만 원본 삭제(+broadcast) → 데이터 손실/peer 갭 방지.
        await deleteMut.mutateAsync(op.original.id);
        rt?.broadcastStrokeDeleted(op.original.id);
      } catch (err) {
        // 롤백: 임시 세그먼트 제거 + 원본 복원(원본은 삭제하지 않았다).
        qc.setQueryData<StrokeDTO[]>(key, (prev) => {
          const cleaned = (prev ?? []).filter((x) => !op.creates.some((c) => c.tempId === x.id));
          return cleaned.some((x) => x.id === op.original.id) ? cleaned : [...cleaned, op.original];
        });
        toast.error(err instanceof Error ? err.message : "지우기 저장에 실패했습니다");
      }
    }
  }

  // 렌더 시점 실측(매 렌더 재계산, pin-layer와 동일 패턴).
  // eslint-disable-next-line react-hooks/refs
  const boxes = measureBoxes();
  const boxesByOrder = new Map(boxes.map((b) => [b.pageOrder, b]));
  const drawAnchor = drawing && drawing.length > 0 ? locatePin(drawing[0].x, drawing[0].y, boxes) : null;
  // 지우개 드래그 중에만 반경·경계상자 계산(hover·평상시엔 레이아웃 읽기 회피).
  const erasing = active && tool === "eraser" && eraserPath.length > 0;
  let eraseRadius = 0;
  let eBox: ReturnType<typeof eraserBBox> = null;
  if (erasing) {
    // eslint-disable-next-line react-hooks/refs -- measureBoxes와 동일: 렌더 시점 DOM 레이아웃 측정(반응형 상태 아님)
    const scale = currentScale();
    eraseRadius = ERASER_SCREEN_PX / (scale > 0 ? scale : 1);
    eBox = eraserBBox(eraserPath, eraseRadius);
  }

  return (
    <div className="pointer-events-none absolute inset-0">
      {/* 저장된 스트로크 — transform 안이라 줌에 자연 스케일. */}
      <svg
        className="absolute inset-0 h-full w-full"
        style={{ overflow: "visible" }}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* 그림 숨김 시 stroke 렌더를 전부 끈다(realtime 구독은 유지 → 다시 켜면 즉시 최신). */}
        {visible &&
          strokes.map((s) => {
            const b = boxesByOrder.get(s.pageOrder);
            if (!b) return null;
            const sw = s.width * b.width;
            // 지우개 미리보기: 지나간 부분을 빼고 살아남은 조각만 그린다.
            // AABB로 멀리 있는 stroke는 split 계산을 건너뛴다(원본 그대로).
            if (erasing && strokeIntersectsBBox(s.points, b, eBox)) {
              const segs = eraseStrokePoints(s.points, b, eraserPath, eraseRadius);
              if (!(segs.length === 1 && segs[0] === s.points)) {
                return (
                  <g key={s.id}>
                    {segs.map((seg, i) => (
                      <path key={i} d={strokePath(seg, b)} stroke={s.color} strokeWidth={sw} />
                    ))}
                  </g>
                );
              }
            }
            return <path key={s.id} d={strokePath(s.points, b)} stroke={s.color} strokeWidth={sw} />;
          })}
        {/* peer가 지금 그리는 중인 라이브 선(ephemeral). */}
        {visible &&
          [...liveStrokes.entries()].map(([id, ls]) => {
            const b = boxesByOrder.get(ls.pageOrder);
            if (!b || ls.points.length < 2) return null;
            return (
              <path
                key={`live-${id}`}
                d={strokePath(ls.points, b)}
                stroke={ls.color}
                strokeWidth={ls.width * b.width}
              />
            );
          })}
        {/* 그리는 중인 임시 선(로컬). */}
        {visible && drawing && drawing.length > 1 && drawAnchor && boxesByOrder.get(drawAnchor.pageOrder) && (
          <path
            d={strokePath(
              drawing.map((p) => normPoint(p.x, p.y, boxesByOrder.get(drawAnchor.pageOrder)!)),
              boxesByOrder.get(drawAnchor.pageOrder)!,
            )}
            stroke={color}
            strokeWidth={width * boxesByOrder.get(drawAnchor.pageOrder)!.width}
          />
        )}
        {/* 지우개 커서(원형). cx/cy/r/visibility는 ref로만 조작(hover 리렌더 방지) —
            props로 주지 않아야 리렌더 시 React가 imperative 값을 덮어쓰지 않는다.
            non-scaling-stroke로 테두리는 줌과 무관하게 1px. */}
        {active && tool === "eraser" && (
          <circle
            ref={cursorRef}
            fill="rgba(120,120,120,0.12)"
            stroke="#6b7280"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>

      {/* 펜 모드 캡처면 — 시안 밖에서도 그릴 수 있게 크게 확장. */}
      {active && tool === "pen" && (
        <div
          className={cn(
            "pointer-events-auto absolute",
            spaceHeld ? "cursor-grab" : "cursor-crosshair",
          )}
          style={{ inset: "-100000px" }}
          onPointerDown={onPenDown}
          onPointerMove={onPenMove}
          onPointerUp={onPenUp}
          onPointerCancel={onPenUp}
        />
      )}

      {/* 지우개 모드 캡처면 — 드래그로 부분 삭제. 자체 원형 커서를 그리므로 cursor:none. */}
      {active && tool === "eraser" && (
        <div
          className="pointer-events-auto absolute"
          style={{ inset: "-100000px", cursor: spaceHeld ? "grab" : "none" }}
          onPointerDown={onEraserDown}
          onPointerMove={onEraserMove}
          onPointerUp={onEraserUp}
          onPointerCancel={onEraserUp}
          onPointerLeave={() => {
            if (!eraserDownRef.current) hideCursor();
          }}
        />
      )}

      {/* 도구 툴바 — 모드 토글 위에 띄운다(그리기 모드에서만). transform 밖(body)으로 포털. */}
      {active &&
        mounted &&
        createPortal(
          <div className="pointer-events-none fixed inset-x-0 bottom-32 z-40 flex justify-center px-4">
          <div className="bg-foreground/95 pointer-events-auto flex items-center gap-2 rounded-full px-2 py-1.5 shadow-lg backdrop-blur-md">
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="펜"
                onClick={() => setTool("pen")}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full transition-colors",
                  tool === "pen"
                    ? "bg-white text-foreground"
                    : "text-white/60 hover:bg-white/10 hover:text-white",
                )}
              >
                <Pen className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="지우개"
                onClick={() => setTool("eraser")}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full transition-colors",
                  tool === "eraser"
                    ? "bg-white text-foreground"
                    : "text-white/60 hover:bg-white/10 hover:text-white",
                )}
              >
                <Eraser className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>

            <div className="h-5 w-px bg-white/20" />

            {/* 색상 */}
            <div className="flex items-center gap-1">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`색상 ${c}`}
                  onClick={() => {
                    setColor(c);
                    setTool("pen");
                  }}
                  className={cn(
                    "h-5 w-5 rounded-full border-2 transition-transform",
                    color === c ? "scale-110 border-white" : "border-transparent",
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>

            <div className="h-5 w-px bg-white/20" />

            {/* 굵기 */}
            <div className="flex items-center gap-1">
              {WIDTHS.map(({ key, w }) => (
                <button
                  key={key}
                  type="button"
                  aria-label={`굵기 ${key}`}
                  onClick={() => {
                    setWidth(w);
                    setTool("pen");
                  }}
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full transition-colors",
                    width === w
                      ? "bg-white text-foreground"
                      : "text-white/60 hover:bg-white/10 hover:text-white",
                  )}
                >
                  <span className="rounded-full bg-current" style={{ height: 2 + w * 1200, width: 2 + w * 1200 }} />
                </button>
              ))}
            </div>
          </div>
        </div>,
          document.body,
        )}
    </div>
  );
}
