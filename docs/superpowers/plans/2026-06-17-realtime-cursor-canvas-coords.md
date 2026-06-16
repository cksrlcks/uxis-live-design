# 실시간 커서 — 캔버스 콘텐츠 좌표계 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 캔버스 뷰의 실시간 커서를 윈도우 정규화 좌표 → 콘텐츠(world) 좌표로 바꿔, 각 사용자의 독립적인 줌/팬과 무관하게 커서가 디자인 콘텐츠의 같은 지점에 붙도록 한다(피그마식 멀티커서, 코어 범위).

**Architecture:** 송신측은 포인터 위치를 콘텐츠 div의 `getBoundingClientRect()`와 현재 줌 배율로 역변환해 콘텐츠 px(`cx`,`cy`)를 broadcast한다. 수신측은 커서 마커를 `TransformComponent` 콘텐츠 *안*에 `left:cx; top:cy`로 절대배치하여, `react-zoom-pan-pinch`가 각 뷰어의 transform으로 자동 투영하게 한다. 마커 아이콘은 안정적 부모(`contentRef`)에 둔 CSS 변수 `--inv-scale = 1/scale`로 역보정해 화면상 크기를 일정하게 유지한다.

**Tech Stack:** Next.js 16 (React 19), TypeScript, react-zoom-pan-pinch v4, Supabase Realtime broadcast, Vitest.

---

## 배경 / 참조
- 스펙: `docs/superpowers/specs/2026-06-17-realtime-cursor-canvas-coordinates-design.md`
- 현재 커서 송수신: `components/realtime/realtime-provider.tsx` (broadcast 이벤트 `cursor`, payload `{id,name,color,xNorm,yNorm}`)
- 현재 커서 렌더/캡처: `components/realtime/cursor-overlay.tsx` (`fixed inset-0`, `window.innerWidth` 정규화 — **이 파일을 대체**)
- 캔버스: `components/preview/canvas-view.tsx` (`react-zoom-pan-pinch`)
- 좌표 순수 함수: `lib/realtime/coords.ts` (기존 `clamp01/toNorm/fromNorm` — `toNorm/fromNorm`은 앱 코드 미사용, 테스트만 참조; **유지**)

## 스펙 대비 정밀화(planning 중 확정)
1. **scale 추적 메커니즘**: 스펙의 "`onTransformed` → CSS 변수"는, 실제 v4 API에 맞춰 **`onInit` + `onTransform`**(프롭명 `onTransform`, `onTransformed` 아님) 콜백으로 `contentRef`에 `--inv-scale`를 쓰는 방식으로 확정. CSS 변수를 안정적 부모에 두면 **늦게 마운트되는 원격 커서도 현재 배율을 즉시 상속**받아 올바른 크기로 렌더된다(라이브러리 `KeepScale`은 정적 화면에서 뒤늦은 커서가 보정 전까지 작게 보이는 한계가 있어 채택하지 않음).
2. **콘텐츠 밖 판정**: 스펙의 `isInside`는 불필요 — 캡처 리스너를 캔버스 루트 엘리먼트에 붙이고 `pointerleave`로 이탈을 처리하므로 별도 경계 판정 함수를 만들지 않는다. 순수 함수는 `toContent`만 추가.
3. **비실시간 경로 안전성**: `CanvasView`는 공개 뷰어(실시간)뿐 아니라 에디터 `app/(dashboard)/dashboard/proposals/[id]/page.tsx`(비실시간, provider 없음)에서도 렌더된다. 따라서 provider 밖에서 throw하지 않고 `null`을 반환하는 `useRealtimeOptional()`을 추가하고, 커서 컴포넌트는 이것이 `null`이면 no-op한다.

## File Structure
- `lib/realtime/coords.ts` — **수정**: 순수 함수 `toContent(clientX, clientY, rect, scale)` 추가.
- `tests/realtime/coords.test.ts` — **수정**: `toContent` 단위 테스트 추가.
- `components/realtime/realtime-provider.tsx` — **수정**: `RemoteCursor`/`sendCursor`를 `{cx,cy}`로 변경, `useRealtimeOptional` export 추가.
- `components/realtime/cursor-overlay.tsx` — **삭제**.
- `components/realtime/realtime-shell.tsx` — **수정**: `CursorOverlay` import/사용 제거.
- `components/realtime/canvas-cursors.tsx` — **신규**: `CanvasCursorLayer`(렌더, content 안) + `CanvasCursorCapture`(캡처, 루트에서 broadcast).
- `components/preview/canvas-view.tsx` — **수정**: relative content 래퍼 + 커서 레이어/캡처 마운트 + `--inv-scale` 갱신.

---

## Task 1: 좌표 역변환 순수 함수 `toContent`

**Files:**
- Modify: `lib/realtime/coords.ts`
- Test: `tests/realtime/coords.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/realtime/coords.test.ts`의 import 줄을 교체하고(아래) 파일 끝에 describe 블록을 추가한다.

import 줄(1줄째 `import { clamp01, toNorm, fromNorm } ...`)을 다음으로 교체:
```ts
import { clamp01, toNorm, fromNorm, toContent } from "@/lib/realtime/coords";
```

파일 끝에 추가:
```ts
describe("toContent", () => {
  it("subtracts the content origin and divides by scale", () => {
    expect(toContent(150, 80, { left: 50, top: 20 }, 1)).toEqual({ cx: 100, cy: 60 });
    expect(toContent(150, 80, { left: 50, top: 20 }, 2)).toEqual({ cx: 50, cy: 30 });
  });
  it("round-trips with the screen projection cx*scale+left", () => {
    const rect = { left: 12, top: 34 };
    const scale = 0.2;
    const { cx, cy } = toContent(200, 100, rect, scale);
    expect(cx * scale + rect.left).toBeCloseTo(200);
    expect(cy * scale + rect.top).toBeCloseTo(100);
  });
  it("returns origin when scale is non-positive", () => {
    expect(toContent(10, 10, { left: 0, top: 0 }, 0)).toEqual({ cx: 0, cy: 0 });
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/realtime/coords.test.ts`
Expected: FAIL — `toContent is not a function` (또는 export 없음).

- [ ] **Step 3: 최소 구현**

`lib/realtime/coords.ts` 파일 끝에 추가:
```ts
// 화면(client) 좌표 → 배율 1배 기준 콘텐츠 좌표.
// rect는 콘텐츠 엘리먼트의 화면 rect(줌/팬 반영), scale은 현재 줌 배율.
// scale<=0(아직 레이아웃 전)은 원점으로 처리.
export function toContent(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number },
  scale: number,
): { cx: number; cy: number } {
  if (scale <= 0) return { cx: 0, cy: 0 };
  return { cx: (clientX - rect.left) / scale, cy: (clientY - rect.top) / scale };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/realtime/coords.test.ts`
Expected: PASS (toContent 3개 포함 전체 통과).

- [ ] **Step 5: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 6: 커밋**

```bash
git add lib/realtime/coords.ts tests/realtime/coords.test.ts
git commit -m "feat: toContent — screen→content coordinate transform (pure)"
```

---

## Task 2: 데이터 모델을 콘텐츠 좌표로 전환 + 옛 오버레이 제거

이 태스크 후 커서는 일시적으로 렌더되지 않지만(다음 태스크에서 복원) `tsc`는 통과한다.

**Files:**
- Modify: `components/realtime/realtime-provider.tsx`
- Delete: `components/realtime/cursor-overlay.tsx`
- Modify: `components/realtime/realtime-shell.tsx`

- [ ] **Step 1: `RemoteCursor` 타입을 콘텐츠 좌표로 변경**

`components/realtime/realtime-provider.tsx` 9번째 줄:
```ts
export type RemoteCursor = { id: string; name: string; color: string; xNorm: number; yNorm: number };
```
를 다음으로 교체:
```ts
export type RemoteCursor = { id: string; name: string; color: string; cx: number; cy: number };
```

- [ ] **Step 2: `sendCursor` 시그니처(컨텍스트 타입) 변경**

같은 파일 14번째 줄:
```ts
  sendCursor: (xNorm: number, yNorm: number) => void;
```
를 다음으로 교체:
```ts
  sendCursor: (cx: number, cy: number) => void;
```

- [ ] **Step 3: `sendCursor` 구현 + payload 필드명 변경**

같은 파일 91–97번째 줄의 `sendCursor` 콜백:
```ts
  const sendCursor = useCallback((xNorm: number, yNorm: number) => {
    const me = identityRef.current;
    channelRef.current?.send({
      type: "broadcast", event: "cursor",
      payload: { id: me.id, name: me.name, color: me.color, xNorm, yNorm },
    });
  }, []);
```
를 다음으로 교체:
```ts
  const sendCursor = useCallback((cx: number, cy: number) => {
    const me = identityRef.current;
    channelRef.current?.send({
      type: "broadcast", event: "cursor",
      payload: { id: me.id, name: me.name, color: me.color, cx, cy },
    });
  }, []);
```

- [ ] **Step 4: `useRealtimeOptional` 추가**

같은 파일에서 기존 `useRealtime` 함수(20–24번째 줄) 바로 아래에 추가:
```ts
// useRealtime과 같지만 provider 밖에서는 throw 대신 null 반환.
// 비실시간 에디터 프리뷰에서 캔버스 커서 컴포넌트가 no-op하도록.
export function useRealtimeOptional(): RealtimeContextValue | null {
  return useContext(RealtimeContext);
}
```
(`useContext`는 이미 import되어 있음 — 2번째 줄.)

- [ ] **Step 5: 옛 커서 오버레이 파일 삭제**

```bash
git rm components/realtime/cursor-overlay.tsx
```

- [ ] **Step 6: 셸에서 `CursorOverlay` import/사용 제거**

`components/realtime/realtime-shell.tsx` 5번째 줄 삭제:
```ts
import { CursorOverlay } from "./cursor-overlay";
```
그리고 33번째 줄 삭제:
```tsx
      <CursorOverlay />
```
(결과적으로 `RealtimeProvider` 자식은 `{children}` + `<PresenceBar .../>` 만 남는다.)

- [ ] **Step 7: 타입 체크 — 잔여 참조 없음 확인**

Run: `npx tsc --noEmit`
Expected: 에러 없음. (`xNorm`/`yNorm`/`CursorOverlay`를 참조하는 다른 파일이 없으므로 통과.)

- [ ] **Step 8: 테스트(회귀) 실행**

Run: `npx vitest run`
Expected: 전체 PASS.

- [ ] **Step 9: 커밋**

```bash
git add -A
git commit -m "refactor: cursor model uses content coords; remove window-normalized overlay"
```

---

## Task 3: 콘텐츠 좌표 커서 — 캡처 + 렌더 컴포넌트와 캔버스 배선

**Files:**
- Create: `components/realtime/canvas-cursors.tsx`
- Modify: `components/preview/canvas-view.tsx`

- [ ] **Step 1: 커서 캡처+렌더 컴포넌트 생성**

`components/realtime/canvas-cursors.tsx` 신규 작성:
```tsx
"use client";
import { useEffect, useRef } from "react";
import { useRealtimeOptional } from "./realtime-provider";
import { toContent } from "@/lib/realtime/coords";

// 원격 커서를 캔버스 transform 레이어 *안*에 그린다. 라이브러리가 각 뷰어의
// 줌/팬으로 자동 투영하므로 커서가 콘텐츠에 붙는다. 아이콘은 부모(contentRef)에
// 설정된 CSS 변수 --inv-scale 로 역보정해 화면상 크기를 일정하게 유지하며,
// transformOrigin 0 0 으로 커서 끝(hotspot)을 (cx,cy)에 고정한다.
export function CanvasCursorLayer() {
  const rt = useRealtimeOptional();
  if (!rt) return null;
  return (
    <div className="pointer-events-none absolute inset-0">
      {rt.cursors.map((c) => (
        <div
          key={c.id}
          className="absolute transition-[left,top] duration-75 ease-linear"
          style={{
            left: c.cx,
            top: c.cy,
            transform: "scale(var(--inv-scale, 5))",
            transformOrigin: "0 0",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none" style={{ color: c.color, display: "block" }}>
            <path d="M1 1l5 14 2-5 5-2L1 1z" fill="currentColor" stroke="white" strokeWidth="1" />
          </svg>
          <span
            className="ml-3 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
            style={{ backgroundColor: c.color }}
          >
            {c.name}
          </span>
        </div>
      ))}
    </div>
  );
}

// 캔버스 루트 위 포인터를 콘텐츠 좌표로 변환해 broadcast한다. 렌더는 없음.
// provider 밖(에디터 프리뷰)에서는 no-op.
export function CanvasCursorCapture({
  rootRef,
  contentRef,
}: {
  rootRef: React.RefObject<HTMLDivElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
}) {
  const rt = useRealtimeOptional();
  const sendCursor = rt?.sendCursor;
  const clearCursor = rt?.clearCursor;
  const frame = useRef<number | null>(null);
  const pending = useRef<{ cx: number; cy: number } | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !sendCursor || !clearCursor) return;
    const send = sendCursor;
    const clear = clearCursor;

    function onMove(e: PointerEvent) {
      const content = contentRef.current;
      if (!content) return;
      const rect = content.getBoundingClientRect();
      const ow = content.offsetWidth; // 레이아웃 폭(트랜스폼 미반영) → 현재 배율 = rect.width/ow
      if (ow <= 0) return;
      const scale = rect.width / ow;
      pending.current = toContent(e.clientX, e.clientY, rect, scale);
      if (frame.current == null) {
        frame.current = requestAnimationFrame(() => {
          frame.current = null;
          if (pending.current) send(pending.current.cx, pending.current.cy);
        });
      }
    }
    function onLeave() {
      clear();
    }

    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", onLeave);
    return () => {
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
      if (frame.current != null) cancelAnimationFrame(frame.current);
      clear();
    };
  }, [rootRef, contentRef, sendCursor, clearCursor]);

  return null;
}
```

- [ ] **Step 2: `CanvasView` 재구성 — relative 래퍼 + 커서 레이어/캡처 + `--inv-scale`**

`components/preview/canvas-view.tsx` 전체를 다음으로 교체:
```tsx
"use client";
import { useRef } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import type { PreviewPage } from "@/lib/preview/types";
import { CanvasCursorLayer, CanvasCursorCapture } from "@/components/realtime/canvas-cursors";

export function CanvasView({ pages }: { pages: PreviewPage[] }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  if (pages.length === 0) {
    return <div className="p-8 text-sm text-muted-foreground">페이지가 없습니다.</div>;
  }

  // 안정적 부모(contentRef)에 --inv-scale = 1/scale 을 써서, 자손 커서 마커가
  // 줌과 무관하게 화면상 일정 크기를 유지하도록 한다(늦게 마운트된 커서도 즉시 상속).
  function applyInvScale(scale: number) {
    const el = contentRef.current;
    if (el && scale > 0) el.style.setProperty("--inv-scale", String(1 / scale));
  }

  return (
    <div ref={rootRef} className="h-full w-full bg-muted">
      <TransformWrapper
        minScale={0.1}
        maxScale={3}
        initialScale={0.2}
        centerOnInit
        limitToBounds={false}
        wheel={{ step: 0.001 }} // gentler zoom per wheel tick (default ~0.2 is too aggressive)
        onInit={(ref) => applyInvScale(ref.state.scale)}
        onTransform={(_ref, state) => applyInvScale(state.scale)}
      >
        {/* wrapper fills the box; our own inner row controls the layout so we don't
            fight react-zoom-pan-pinch's content div (which defaults to flex-wrap: wrap). */}
        <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }}>
          {/* relative 래퍼 = 콘텐츠 좌표 원점(좌상단). 커서 레이어가 이 박스를 덮는다. */}
          <div ref={contentRef} style={{ position: "relative", width: "max-content" }}>
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                flexWrap: "nowrap",
                alignItems: "flex-start",
                gap: "3rem",
                padding: "2rem",
                width: "max-content", // grow to fit all pages → single horizontal row, no wrap
              }}
            >
              {pages.map((pg) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={pg.id}
                  src={pg.url}
                  alt=""
                  width={pg.width}
                  height={pg.height}
                  draggable={false}
                  className="block max-w-none shrink-0 select-none border border-border bg-background"
                />
              ))}
            </div>
            <CanvasCursorLayer />
          </div>
        </TransformComponent>
        <CanvasCursorCapture rootRef={rootRef} contentRef={contentRef} />
      </TransformWrapper>
    </div>
  );
}
```

- [ ] **Step 3: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 4: 린트**

Run: `npx eslint components/realtime/canvas-cursors.tsx components/preview/canvas-view.tsx`
Expected: 에러 없음.

- [ ] **Step 5: 테스트(회귀)**

Run: `npx vitest run`
Expected: 전체 PASS.

- [ ] **Step 6: 커밋**

```bash
git add components/realtime/canvas-cursors.tsx components/preview/canvas-view.tsx
git commit -m "feat: canvas cursors in content space — stick to design under any zoom/pan"
```

---

## Task 4: 수동 검증 (2탭 E2E)

자동 테스트로는 실시간/transform 거동을 못 잡으므로 브라우저로 확인한다.

**Files:** 없음(검증만).

- [ ] **Step 1: 개발 서버 기동**

Run: `npm run dev`
Expected: `http://localhost:3000` 기동.

- [ ] **Step 2: 두 브라우저(또는 일반 + 시크릿 창)로 같은 공개 뷰어 열기**

같은 `/p/[publicId]`를 두 창에서 열고, 둘 다 상단 **캔버스** 버튼을 눌러 `?view=canvas`로 전환.

- [ ] **Step 3: 서로 다른 줌/팬에서 같은 지점 확인**

창 A를 약 0.2x, 창 B를 2x 정도로 서로 다르게 줌/팬한 뒤, 창 A에서 특정 페이지의 특정 버튼 위에 마우스를 올린다.
Expected: 창 B에서 상대 커서가 **그 버튼과 같은 콘텐츠 지점**에 표시된다(각자 줌/팬이 달라도 일치). 커서 아이콘·이름표 크기는 양쪽 모두 줌 배율과 무관하게 화면상 일정.

- [ ] **Step 4: 화면 밖 커서 / 이탈 확인**

창 A가 콘텐츠의 다른 영역으로 팬해 창 B의 커서 지점이 창 A 화면 밖이 되게 한다.
Expected: 창 A에서 그 커서는 보이지 않는다(뷰포트 가장자리에서 클리핑). 창 A에서 마우스를 캔버스 밖으로 빼면 창 B에서 A의 커서가 사라진다(`pointerleave`).

- [ ] **Step 5: 자기 커서 미표시 / 풀화면 전환 확인**

같은 사람이 다른 탭을 열어도 자기 커서는 안 보인다(기존 self 가드). 창에서 **풀화면** 버튼으로 전환하면(`CanvasView` 언마운트) 상대 화면에서 그 사람 커서가 사라진다.

- [ ] **Step 6: 에디터 비실시간 경로 회귀 확인**

`app/(dashboard)/dashboard/proposals/[id]` 에디터 프리뷰에서 **캔버스** 뷰로 전환.
Expected: 콘솔 에러 없음(`useRealtime must be used within RealtimeProvider` 미발생), 줌/팬 정상, 커서 없음.

---

## Self-Review

**1. Spec coverage**
- 콘텐츠 좌표 송수신 → Task 1(toContent) + Task 2(모델) + Task 3(캡처/렌더). ✓
- 줌 무관 일정 크기 아이콘 → Task 3(`--inv-scale` + `onInit`/`onTransform`). ✓
- 화면 밖 커서 미표시 → Task 3(transform 레이어 안 렌더 → 뷰포트 클리핑) + Task 4 Step 4 검증. ✓
- 구조 변경(캡처/렌더 CanvasView로, `CursorOverlay` 제거) → Task 2/3. ✓
- self 커서 가드 유지 → provider 변경에서 해당 로직 미수정(그대로). ✓
- 알려진 한계(다른 variant 피어) → 코어 범위 밖, 본 plan에서 다루지 않음(스펙 §6과 일치). ✓

**2. Placeholder scan**: TBD/TODO/"적절히 처리" 류 없음. 모든 코드 스텝에 완전한 코드 포함. ✓

**3. Type consistency**:
- `RemoteCursor` = `{id,name,color,cx,cy}` (Task 2) ↔ 렌더에서 `c.cx`,`c.cy`,`c.color`,`c.name` 사용(Task 3). ✓
- `sendCursor(cx, cy)` (Task 2) ↔ 캡처에서 `send(pending.current.cx, pending.current.cy)` (Task 3). ✓
- `useRealtimeOptional(): RealtimeContextValue | null` (Task 2) ↔ `rt?.sendCursor`/`rt?.cursors` 사용(Task 3). ✓
- `toContent(clientX, clientY, rect, scale)` (Task 1) ↔ 캡처 호출 시 인자 순서 일치(Task 3). ✓
- `CanvasCursorCapture` props `rootRef`/`contentRef`: `React.RefObject<HTMLDivElement | null>` ↔ CanvasView의 `useRef<HTMLDivElement>(null)` 전달. ✓
