# 뷰어 커서 안/버전 구분 + 영역(드래그) 코멘트 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 공개 뷰어 캔버스 모드에서 (1) 다른 안/버전을 보는 사람의 커서를 반투명으로 구분하고, (2) 기존 코멘트 모드에서 클릭=점·드래그=영역(점선 박스 + 귀퉁이 코멘트)을 모두 지원한다.

**Architecture:** 기능1은 커서 broadcast payload에 보기 키(`variantId:versionId`)를 실어 수신 측이 자기 화면과 비교해 `opacity`를 낮추는 순수 클라이언트 변경. 기능2는 `pin_comments`에 nullable `w_norm`/`h_norm`을 추가(점/영역 하위호환)하고, 코멘트 오버레이를 click→pointer 이벤트로 바꿔 드래그 시 점선 박스를 그리고 좌상단 코너에 기존 작성기/마커를 재사용한다.

**Tech Stack:** Next.js 16, React 19, TypeScript, Drizzle ORM(postgres), Supabase Realtime, TanStack Query, react-zoom-pan-pinch, Vitest, zod v4.

## Global Constraints

- Node ≥ 22 (package.json engines). 마이그레이션 도구 실행 시 필수.
- 테스트는 `tests/**/*.test.ts`에 위치(콜로케이트 아님). vitest globals on.
- 경로 alias: `@/` → `src/`, `@drizzle/` → `drizzle/` (vite-tsconfig-paths로 테스트에서도 해석됨).
- DB 변경은 반드시 `npm run db:generate`로 마이그레이션+meta 스냅샷을 함께 생성(수기 .sql만 추가하면 drizzle meta가 desync됨).
- 하위호환 절대 준수: `w_norm`/`h_norm`이 NULL이면 기존 점 코멘트로 100% 동일 동작.
- **알려진 사전 실패(내 변경 아님, 혼동 금지):** `npm run lint` 기존 2건 경고/에러, `npm run format:check` 전역 실패, `tests/pins/locate.test.ts` 2건 실패(현행 `locatePin`이 페이지 밖에서 null 대신 최근접 페이지 좌표를 반환하는데 테스트가 옛 null 계약을 기대). 이 중 locate 2건은 **Task 6에서 정리**된다. 검증은 `npm run test`와 `npx tsc --noEmit` 중심으로 본다.

---

## File Structure

| 파일 | 책임 | 변경 |
| --- | --- | --- |
| `src/widgets/preview-canvas/lib/cursor-view.ts` | 보기 키 생성 + 동일 화면 판정(순수) | Create |
| `tests/preview/cursor-view.test.ts` | 위 단위 테스트 | Create |
| `src/shared/realtime/realtime-provider.tsx` | `RemoteCursor.view` + `sendCursor(cx,cy,view)` | Modify |
| `src/widgets/preview-canvas/ui/canvas-cursors.tsx` | 커서 전송에 viewKey 포함, 렌더 시 외부 화면 커서 반투명 | Modify |
| `src/widgets/preview-canvas/ui/canvas-view.tsx` | pin→viewKey 계산해 커서 레이어/캡처에 주입 | Modify |
| `drizzle/schema.ts` | `pinComments`에 `wNorm`/`hNorm` nullable | Modify |
| `drizzle/migrations/0019_*.sql` (+ meta) | ADD COLUMN 마이그레이션 | Generate |
| `src/entities/pin/model/pin-schema.ts` | `createPinInputSchema`에 영역 필드 + 쌍 검증 | Modify |
| `src/entities/pin/model/types.ts` | `PinDTO`에 `wNorm?`/`hNorm?` | Modify |
| `tests/entities/pin/pin-schema.test.ts` | 영역 스키마 테스트 | Modify |
| `src/features/pin-comment/api/create-pin-comment.server.ts` | 영역 저장/반환 | Modify |
| `src/entities/pin/api/get-pins.server.ts` | 영역 컬럼 매핑 | Modify |
| `src/widgets/preview-canvas/lib/locate.ts` | `locateArea`/`placeArea` + 타입 | Modify |
| `tests/pins/locate.test.ts` | 영역 테스트 + 사전 실패 2건 현행화 | Modify |
| `src/widgets/preview-canvas/ui/pin-layer.tsx` | pointer 인터랙션, 드래그 미리보기, 영역 렌더, draft 패스스루 | Modify |

---

## Task 1: 커서 보기 키 헬퍼 (순수 함수, TDD)

**Files:**
- Create: `src/widgets/preview-canvas/lib/cursor-view.ts`
- Test: `tests/preview/cursor-view.test.ts`

**Interfaces:**
- Produces:
  - `viewKey(variantId: string, versionId: string): string` → `"<variantId>:<versionId>"`
  - `isSameView(mine: string | undefined, theirs: string | undefined): boolean` — 한쪽이라도 없으면 `true`(선명 폴백).

- [ ] **Step 1: Write the failing test**

```ts
// tests/preview/cursor-view.test.ts
import { describe, it, expect } from "vitest";
import { viewKey, isSameView } from "@/widgets/preview-canvas/lib/cursor-view";

describe("viewKey", () => {
  it("joins variant and version with a colon", () => {
    expect(viewKey("var-1", "ver-9")).toBe("var-1:ver-9");
  });
});

describe("isSameView", () => {
  it("true when both keys match", () => {
    expect(isSameView("a:1", "a:1")).toBe(true);
  });
  it("false when keys differ", () => {
    expect(isSameView("a:1", "a:2")).toBe(false);
    expect(isSameView("a:1", "b:1")).toBe(false);
  });
  it("treats missing info as same view (sharp fallback)", () => {
    expect(isSameView(undefined, "a:1")).toBe(true);
    expect(isSameView("a:1", undefined)).toBe(true);
    expect(isSameView(undefined, undefined)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/preview/cursor-view.test.ts`
Expected: FAIL — `Failed to resolve import "@/widgets/preview-canvas/lib/cursor-view"`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/widgets/preview-canvas/lib/cursor-view.ts
// 커서 발신자가 보고 있는 화면(안+버전)을 식별하는 보기 키와, 수신자가 같은 화면을
// 보는지 판정하는 순수 헬퍼. 어느 한쪽 정보가 없으면(구버전 payload·컨텍스트 부재)
// 같은 화면으로 간주해 기존처럼 선명하게 표시한다(안전한 폴백).
export function viewKey(variantId: string, versionId: string): string {
  return `${variantId}:${versionId}`;
}

export function isSameView(mine: string | undefined, theirs: string | undefined): boolean {
  if (!mine || !theirs) return true;
  return mine === theirs;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/preview/cursor-view.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/widgets/preview-canvas/lib/cursor-view.ts tests/preview/cursor-view.test.ts
git commit -m "feat(viewer): add cursor view-key helper for same-view detection"
```

---

## Task 2: 커서 전송/렌더에 보기 키 연결 (기능 1 완성)

**Files:**
- Modify: `src/shared/realtime/realtime-provider.tsx`
- Modify: `src/widgets/preview-canvas/ui/canvas-cursors.tsx`
- Modify: `src/widgets/preview-canvas/ui/canvas-view.tsx`

**Interfaces:**
- Consumes: `isSameView`(Task 1).
- Produces:
  - `RemoteCursor` 타입에 `view?: string`.
  - `sendCursor(cx: number, cy: number, view?: string): void`.
  - `CanvasCursorLayer({ viewKey?: string })`, `CanvasCursorCapture({ rootRef, contentRef, viewKey? })`.

> 이 작업은 Supabase 채널·DOM 이벤트에 묶인 통합 코드라 새 단위 테스트 대신 타입검사 + 기존 스위트 + 수동 E2E로 검증한다(순수 로직은 Task 1에서 이미 커버).

- [ ] **Step 1: `RemoteCursor`에 `view` 필드 추가**

`src/shared/realtime/realtime-provider.tsx` 26–32행을 다음으로 교체:

```ts
export type RemoteCursor = {
  id: string;
  name: string;
  color: string;
  cx: number;
  cy: number;
  // 발신자가 보고 있는 안/버전(`${variantId}:${versionId}`). 구버전 클라이언트는 누락될 수 있음.
  view?: string;
};
```

- [ ] **Step 2: 컨텍스트 타입의 `sendCursor` 시그니처 확장**

`src/shared/realtime/realtime-provider.tsx` 37행을 교체:

```ts
  sendCursor: (cx: number, cy: number, view?: string) => void;
```

- [ ] **Step 3: `sendCursor` 구현에 `view` 전달**

`src/shared/realtime/realtime-provider.tsx` 193–202행(`const sendCursor = ...`)을 교체:

```ts
  const sendCursor = useCallback((cx: number, cy: number, view?: string) => {
    const ch = channelRef.current;
    if (ch?.state !== "joined") return;
    const me = identityRef.current;
    ch.send({
      type: "broadcast",
      event: "cursor",
      payload: { id: me.id, name: me.name, color: me.color, cx, cy, view },
    });
  }, []);
```

> 수신 핸들러(113–117행)는 payload를 그대로 `RemoteCursor`로 캐스팅하므로 `view`가 자동 포함된다 — 변경 불필요.

- [ ] **Step 4: 커서 캡처가 viewKey를 전송하도록 수정**

`src/widgets/preview-canvas/ui/canvas-cursors.tsx`의 `CanvasCursorCapture`(49–102행)를 교체:

```tsx
// 캔버스 루트 위 포인터를 콘텐츠 좌표로 변환해 broadcast한다. 렌더는 없음.
// provider 밖(에디터 프리뷰)에서는 no-op. viewKey는 ref로 보관해 최신 값을
// effect 재바인딩 없이 읽는다(고빈도 pointermove마다 재구독 방지).
export function CanvasCursorCapture({
  rootRef,
  contentRef,
  viewKey,
}: {
  rootRef: React.RefObject<HTMLDivElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
  viewKey?: string;
}) {
  const rt = useRealtimeOptional();
  const sendCursor = rt?.sendCursor;
  const clearCursor = rt?.clearCursor;
  const frame = useRef<number | null>(null);
  const pending = useRef<{ cx: number; cy: number } | null>(null);
  const viewRef = useRef<string | undefined>(viewKey);
  // eslint-disable-next-line react-hooks/refs -- keep latest viewKey without re-binding listeners
  viewRef.current = viewKey;

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
          if (pending.current) send(pending.current.cx, pending.current.cy, viewRef.current);
        });
      }
    }
    function onLeave() {
      pending.current = null; // drop any queued frame so it can't re-send after clear
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
      pending.current = null;
      clear();
    };
  }, [rootRef, contentRef, sendCursor, clearCursor]);

  return null;
}
```

- [ ] **Step 5: 커서 렌더에서 외부 화면 커서 반투명 처리**

`src/widgets/preview-canvas/ui/canvas-cursors.tsx` 상단 import에 헬퍼 추가(3–4행 아래에):

```tsx
import { isSameView } from "@/widgets/preview-canvas/lib/cursor-view";
```

그리고 `CanvasCursorLayer`(10–45행)를 교체:

```tsx
export function CanvasCursorLayer({ viewKey }: { viewKey?: string }) {
  const rt = useRealtimeOptional();
  if (!rt) return null;
  return (
    <div className="pointer-events-none absolute inset-0">
      {rt.cursors.map((c) => {
        // 다른 안/버전을 보는 사람의 커서는 흐리게(반투명) + 이름 라벨 숨김.
        const sameView = isSameView(viewKey, c.view);
        return (
          <div
            key={c.id}
            className="absolute flex items-start transition-[left,top,opacity] duration-75 ease-linear"
            style={{
              left: c.cx,
              top: c.cy,
              transform: "scale(var(--inv-scale, 5))",
              transformOrigin: "0 0",
              opacity: sameView ? 1 : 0.35,
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 16 16"
              fill="none"
              style={{ color: c.color, display: "block" }}
            >
              <path d="M1 1l5 14 2-5 5-2L1 1z" fill="currentColor" stroke="white" strokeWidth="1" />
            </svg>
            {sameView && (
              <span
                className="ml-3 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
                style={{ backgroundColor: c.color }}
              >
                {c.name}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 6: canvas-view에서 viewKey 계산해 주입**

`src/widgets/preview-canvas/ui/canvas-view.tsx` import에 추가(11행 부근):

```tsx
import { viewKey as makeViewKey } from "../lib/cursor-view";
```

`commenting`/`drawing` 계산부(106–108행) 바로 아래에 추가:

```tsx
  // 커서 구분용 보기 키 — pin이 없으면(에디터 프리뷰) undefined → 기존처럼 선명.
  const cursorViewKey = pin ? makeViewKey(pin.variantId, pin.versionId) : undefined;
```

254행 `<CanvasCursorLayer />`를 교체:

```tsx
            <CanvasCursorLayer viewKey={cursorViewKey} />
```

283행 `<CanvasCursorCapture rootRef={rootRef} contentRef={contentRef} />`를 교체:

```tsx
        <CanvasCursorCapture rootRef={rootRef} contentRef={contentRef} viewKey={cursorViewKey} />
```

- [ ] **Step 7: 타입검사 + 기존 테스트**

Run: `npx tsc --noEmit`
Expected: 에러 없음(관련 파일 기준).
Run: `npx vitest run tests/realtime tests/preview`
Expected: PASS(기존 + cursor-view).

- [ ] **Step 8: Commit**

```bash
git add src/shared/realtime/realtime-provider.tsx src/widgets/preview-canvas/ui/canvas-cursors.tsx src/widgets/preview-canvas/ui/canvas-view.tsx
git commit -m "feat(viewer): dim cursors of peers viewing a different variant/version"
```

---

## Task 3: 영역 컬럼 DB 마이그레이션 + 스키마

**Files:**
- Modify: `drizzle/schema.ts:99-100`
- Generate: `drizzle/migrations/0019_*.sql` (+ `drizzle/migrations/meta/*`)

**Interfaces:**
- Produces: `pinComments.wNorm` / `pinComments.hNorm` (nullable `real`).

- [ ] **Step 1: 스키마에 nullable 컬럼 추가**

`drizzle/schema.ts`의 `pinComments` 정의에서 `yNorm` 줄(100행) 바로 아래에 추가:

```ts
  xNorm: real("x_norm").notNull(),
  yNorm: real("y_norm").notNull(),
  // 영역(드래그) 코멘트일 때만 채워짐(둘 다 NULL = 점 코멘트). 페이지 기준 정규화 너비/높이.
  wNorm: real("w_norm"),
  hNorm: real("h_norm"),
```

> `real`은 이미 같은 파일 상단에서 import됨 — 추가 import 불필요.

- [ ] **Step 2: 마이그레이션 생성**

Run: `npm run db:generate`
Expected: `drizzle/migrations/0019_<자동이름>.sql`이 생성되고 `meta/_journal.json` + 새 스냅샷이 갱신된다. 인터랙티브 프롬프트 없음(신규 nullable 컬럼은 rename 감지 대상 아님).

- [ ] **Step 3: 생성된 SQL 확인**

생성된 `drizzle/migrations/0019_*.sql`을 열어 다음 두 줄이 포함됐는지 확인:

```sql
ALTER TABLE "pin_comments" ADD COLUMN "w_norm" real;
ALTER TABLE "pin_comments" ADD COLUMN "h_norm" real;
```

다르면(예: NOT NULL 등) 스키마 Step 1을 바로잡고 생성된 0019 파일/meta 변경을 되돌린 뒤 재생성.

> 로컬/원격 DB 적용(`npm run db:migrate`)은 배포 절차에서 수행 — 이 계획의 코드 검증에는 불필요(컬럼 nullable이라 기존 row 무영향).

- [ ] **Step 4: Commit**

```bash
git add drizzle/schema.ts drizzle/migrations
git commit -m "feat(pin): add nullable w_norm/h_norm columns for area comments"
```

---

## Task 4: 핀 입력 스키마 + DTO에 영역 필드 (TDD)

**Files:**
- Modify: `src/entities/pin/model/pin-schema.ts:6-17`
- Modify: `src/entities/pin/model/types.ts:2-15`
- Test: `tests/entities/pin/pin-schema.test.ts`

**Interfaces:**
- Produces:
  - `createPinInputSchema` 입력에 `wNorm?: number`, `hNorm?: number`(양수, ≤20, 쌍으로만).
  - `CreatePinInput`에 동일 필드.
  - `PinDTO`에 `wNorm?: number | null`, `hNorm?: number | null`.

- [ ] **Step 1: 영역 스키마 실패 테스트 추가**

`tests/entities/pin/pin-schema.test.ts`의 `describe("createPinInputSchema", ...)` 블록 안, 마지막 `it(...)`(49행) 다음에 추가:

```ts
  it("accepts a valid area payload (w/h together)", () => {
    const area = { ...valid, wNorm: 0.4, hNorm: 0.25 };
    expect(createPinInputSchema.parse(area)).toEqual(area);
  });
  it("rejects only one of w/h present", () => {
    expect(createPinInputSchema.safeParse({ ...valid, wNorm: 0.4 }).success).toBe(false);
    expect(createPinInputSchema.safeParse({ ...valid, hNorm: 0.25 }).success).toBe(false);
  });
  it("rejects non-positive or oversized w/h", () => {
    expect(createPinInputSchema.safeParse({ ...valid, wNorm: 0, hNorm: 0.2 }).success).toBe(false);
    expect(createPinInputSchema.safeParse({ ...valid, wNorm: -0.1, hNorm: 0.2 }).success).toBe(false);
    expect(createPinInputSchema.safeParse({ ...valid, wNorm: 0.2, hNorm: 99 }).success).toBe(false);
  });
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/entities/pin/pin-schema.test.ts`
Expected: FAIL — 새 area 케이스에서 현재 스키마가 `wNorm`/`hNorm`을 무시(통과시켜야 할 게 실패하거나, 한쪽만 있을 때 거부하지 못함).

- [ ] **Step 3: 스키마에 영역 필드 + 쌍 검증 구현**

`src/entities/pin/model/pin-schema.ts` 6–16행(`createPinInputSchema` 정의)을 교체:

```ts
export const createPinInputSchema = z
  .object({
    variantId: z.string().min(1),
    versionId: z.string().min(1),
    pageOrder: z.number().int().min(0),
    // 시안(페이지 박스) 밖에도 핀을 찍을 수 있어 0..1 범위를 벗어날 수 있다.
    // 저장 폭주 방지를 위해 페이지 기준 ±10배(=±1000%)로만 제한한다.
    xNorm: z.number().finite().min(-10).max(10),
    yNorm: z.number().finite().min(-10).max(10),
    // 영역(드래그) 코멘트: 좌상단=(xNorm,yNorm), 크기=(wNorm,hNorm). 양수 + 상한 제한.
    // 점 코멘트는 둘 다 생략. 둘 다 있거나 둘 다 없어야 한다(아래 refine).
    wNorm: z.number().finite().positive().max(20).optional(),
    hNorm: z.number().finite().positive().max(20).optional(),
    authorColor: z.string().trim().min(1).max(32),
    body: pinBodySchema,
  })
  .refine((d) => (d.wNorm == null) === (d.hNorm == null), {
    message: "wNorm and hNorm must be provided together",
    path: ["wNorm"],
  });
```

- [ ] **Step 4: `PinDTO`에 영역 필드 추가**

`src/entities/pin/model/types.ts` 7–8행(`xNorm`/`yNorm`) 아래에 추가:

```ts
  xNorm: number;
  yNorm: number;
  // 영역 코멘트면 채워짐(점 코멘트는 null/undefined).
  wNorm?: number | null;
  hNorm?: number | null;
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run tests/entities/pin/pin-schema.test.ts`
Expected: PASS(기존 + 신규 area 케이스).

- [ ] **Step 6: Commit**

```bash
git add src/entities/pin/model/pin-schema.ts src/entities/pin/model/types.ts tests/entities/pin/pin-schema.test.ts
git commit -m "feat(pin): accept area (w/h) fields in pin schema and DTO"
```

---

## Task 5: 서버 생성/조회에 영역 반영

**Files:**
- Modify: `src/features/pin-comment/api/create-pin-comment.server.ts:18-71`
- Modify: `src/entities/pin/api/get-pins.server.ts:38-51`

**Interfaces:**
- Consumes: `createPinInputSchema`·`PinDTO`(Task 4), `pinComments.wNorm/hNorm`(Task 3).
- Produces: 생성/조회 응답 `PinDTO`에 `wNorm`/`hNorm` 포함(점 코멘트는 `null`).

> DB 왕복 통합 코드라 단위 테스트 없음 — 타입검사 + 스키마 테스트(Task 4) + 수동 E2E로 검증.

- [ ] **Step 1: 생성 서버에서 영역 저장/반환**

`src/features/pin-comment/api/create-pin-comment.server.ts` 18–19행(구조분해)을 교체:

```ts
  const { variantId, versionId, pageOrder, xNorm, yNorm, wNorm, hNorm, authorColor, body } =
    createPinInputSchema.parse(raw);
```

44–57행(`db.insert(...).values({...})`)에서 `yNorm,` 다음 줄에 두 컬럼 추가:

```ts
  await db.insert(pinComments).values({
    id,
    proposalId: proposal.id,
    variantId,
    versionId,
    pageOrder,
    xNorm,
    yNorm,
    wNorm: wNorm ?? null,
    hNorm: hNorm ?? null,
    authorId: profile.id,
    authorName,
    authorColor,
    body,
    createdAt,
  });
```

58–71행(반환 객체)에서 `yNorm,` 다음 줄에 추가:

```ts
  return {
    id,
    variantId,
    versionId,
    pageOrder,
    xNorm,
    yNorm,
    wNorm: wNorm ?? null,
    hNorm: hNorm ?? null,
    authorId: profile.id,
    authorName,
    authorColor,
    body,
    resolved: false,
    createdAt: createdAt.toISOString(),
  };
```

- [ ] **Step 2: 조회 서버에서 영역 매핑**

`src/entities/pin/api/get-pins.server.ts` 38–51행(`rows.map(...)`)에서 `yNorm: r.yNorm,` 다음 줄에 추가:

```ts
  return rows.map((r) => ({
    id: r.id,
    variantId: r.variantId,
    versionId: r.versionId,
    pageOrder: r.pageOrder,
    xNorm: r.xNorm,
    yNorm: r.yNorm,
    wNorm: r.wNorm,
    hNorm: r.hNorm,
    authorId: r.authorId,
    authorName: r.authorName,
    authorColor: r.authorColor,
    body: r.body,
    resolved: r.resolved,
    createdAt: r.createdAt.toISOString(),
  }));
```

> `db.select()`는 전체 컬럼을 가져오므로 `r.wNorm`/`r.hNorm`은 Task 3 이후 자동으로 존재한다.

- [ ] **Step 3: 타입검사**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 4: Commit**

```bash
git add src/features/pin-comment/api/create-pin-comment.server.ts src/entities/pin/api/get-pins.server.ts
git commit -m "feat(pin): persist and return area w/h on create and list"
```

---

## Task 6: 영역 좌표 헬퍼 + locate 사전 실패 정리 (TDD)

**Files:**
- Modify: `src/widgets/preview-canvas/lib/locate.ts`
- Test: `tests/pins/locate.test.ts`

**Interfaces:**
- Consumes: 기존 `locatePin`/`placePin`·`PageBox`.
- Produces:
  - `type AreaLocation = { pageOrder: number; xNorm: number; yNorm: number; wNorm: number; hNorm: number }`
  - `locateArea(ax, ay, bx, by, boxes): AreaLocation | null` — 시작점 기준 페이지에 좌상단/크기를 정규화(드래그 방향 무관).
  - `placeArea(box, xNorm, yNorm, wNorm, hNorm): { left, top, width, height }`

- [ ] **Step 1: 영역 + 현행화 테스트 작성**

`tests/pins/locate.test.ts`를 다음으로 교체:

```ts
import { describe, it, expect } from "vitest";
import { locatePin, placePin, locateArea, placeArea } from "@/widgets/preview-canvas/lib/locate";

const boxes = [
  { left: 0, top: 0, width: 100, height: 200, pageOrder: 0 },
  { left: 150, top: 0, width: 100, height: 200, pageOrder: 1 },
];

describe("locatePin", () => {
  it("locates a point inside a page and normalizes within it", () => {
    expect(locatePin(50, 100, boxes)).toEqual({ pageOrder: 0, xNorm: 0.5, yNorm: 0.5 });
    expect(locatePin(200, 50, boxes)).toEqual({ pageOrder: 1, xNorm: 0.5, yNorm: 0.25 });
  });
  it("falls back to the nearest page outside all boxes (norms may exceed 0..1)", () => {
    // x=125 사이 간격: page0 오른쪽 끝(100)·page1 왼쪽 끝(150)까지 동률 → 먼저 발견된 page0.
    expect(locatePin(125, 100, boxes)).toEqual({ pageOrder: 0, xNorm: 1.25, yNorm: 0.5 });
    expect(locatePin(-10, 100, boxes)).toEqual({ pageOrder: 0, xNorm: -0.1, yNorm: 0.5 });
  });
  it("clamps norms on the exact edge", () => {
    expect(locatePin(100, 200, boxes)).toEqual({ pageOrder: 0, xNorm: 1, yNorm: 1 });
  });
  it("returns null only when there are no valid boxes", () => {
    expect(locatePin(0, 0, [{ left: 0, top: 0, width: 0, height: 0, pageOrder: 9 }])).toBeNull();
  });
});

describe("placePin", () => {
  it("maps a normalized point back to content coords within the box", () => {
    expect(placePin(boxes[0], 0.5, 0.5)).toEqual({ x: 50, y: 100 });
    expect(placePin(boxes[1], 0, 1)).toEqual({ x: 150, y: 200 });
  });
});

describe("locateArea", () => {
  it("normalizes a drag rectangle to the start page (top-left + size)", () => {
    // (20,40)→(60,140) inside page0: left=20,top=40,w=40,h=100
    expect(locateArea(20, 40, 60, 140, boxes)).toEqual({
      pageOrder: 0,
      xNorm: 0.2,
      yNorm: 0.2,
      wNorm: 0.4,
      hNorm: 0.5,
    });
  });
  it("is direction-agnostic (bottom-right → top-left yields same box)", () => {
    expect(locateArea(60, 140, 20, 40, boxes)).toEqual({
      pageOrder: 0,
      xNorm: 0.2,
      yNorm: 0.2,
      wNorm: 0.4,
      hNorm: 0.5,
    });
  });
  it("anchors to the start point's page even if the end is elsewhere", () => {
    // 시작 (200,50) → page1, 끝 (240,150): left=200,top=50,w=40,h=100 (page1 기준)
    expect(locateArea(200, 50, 240, 150, boxes)).toEqual({
      pageOrder: 1,
      xNorm: 0.5,
      yNorm: 0.25,
      wNorm: 0.4,
      hNorm: 0.5,
    });
  });
  it("returns null with no valid boxes", () => {
    expect(locateArea(0, 0, 10, 10, [])).toBeNull();
  });
});

describe("placeArea", () => {
  it("maps a normalized area back to a content-coord rect", () => {
    expect(placeArea(boxes[0], 0.2, 0.2, 0.4, 0.5)).toEqual({
      left: 20,
      top: 40,
      width: 40,
      height: 100,
    });
  });
});
```

> 참고: 위 `locatePin` 두 케이스는 사전 실패 2건을 현행 동작(최근접 페이지 폴백)으로 바로잡은 것이며, 이 작업이 끝나면 `locate.test.ts`는 전부 통과한다.

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/pins/locate.test.ts`
Expected: FAIL — `locateArea`/`placeArea` 미정의로 import 실패.

- [ ] **Step 3: 영역 헬퍼 구현**

`src/widgets/preview-canvas/lib/locate.ts` 끝(50행 `}` 다음)에 추가:

```ts
export type AreaLocation = {
  pageOrder: number;
  xNorm: number;
  yNorm: number;
  wNorm: number;
  hNorm: number;
};

// 드래그 두 점(콘텐츠 좌표)을 영역으로 변환. 시작점이 속한(또는 가장 가까운) 페이지를
// 기준으로 좌상단(min)·크기(abs)를 정규화한다. 드래그 방향과 무관하게 같은 박스를 만든다.
export function locateArea(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  boxes: PageBox[],
): AreaLocation | null {
  const start = locatePin(ax, ay, boxes);
  if (!start) return null;
  const box = boxes.find(
    (b) => b.pageOrder === start.pageOrder && b.width > 0 && b.height > 0,
  );
  if (!box) return null;
  const left = Math.min(ax, bx);
  const top = Math.min(ay, by);
  const w = Math.abs(bx - ax);
  const h = Math.abs(by - ay);
  return {
    pageOrder: box.pageOrder,
    xNorm: (left - box.left) / box.width,
    yNorm: (top - box.top) / box.height,
    wNorm: w / box.width,
    hNorm: h / box.height,
  };
}

// 정규화 영역 → 박스 기준 콘텐츠 좌표 사각형(placeArea는 locateArea의 역). 0..1 밖도 그대로.
export function placeArea(
  box: PageBox,
  xNorm: number,
  yNorm: number,
  wNorm: number,
  hNorm: number,
): { left: number; top: number; width: number; height: number } {
  const { x, y } = placePin(box, xNorm, yNorm);
  return { left: x, top: y, width: wNorm * box.width, height: hNorm * box.height };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/pins/locate.test.ts`
Expected: PASS(전부). 사전 실패 2건도 해소됨.

- [ ] **Step 5: Commit**

```bash
git add src/widgets/preview-canvas/lib/locate.ts tests/pins/locate.test.ts
git commit -m "feat(viewer): add locateArea/placeArea helpers; align stale locate tests"
```

---

## Task 7: 코멘트 모드 pointer 인터랙션 + 영역 렌더

**Files:**
- Modify: `src/widgets/preview-canvas/ui/pin-layer.tsx`

**Interfaces:**
- Consumes: `locateArea`/`placeArea`/`AreaLocation`(Task 6), `CreatePinInput`·`PinDTO`(Task 4), `rt.broadcastPin`.
- Produces: 클릭=점 / 드래그(≥5px 화면)=영역 코멘트 생성·렌더.

> UI 인터랙션 중심이라 새 단위 테스트 없음(순수 좌표 로직은 Task 6에서 커버). 타입검사 + 수동 E2E로 검증.

- [ ] **Step 1: import 보강**

`src/widgets/preview-canvas/ui/pin-layer.tsx` 7행 import를 교체:

```tsx
import { locatePin, locateArea, placePin, placeArea, type PageBox } from "../lib/locate";
```

2행 React import에 `useRef` 추가:

```tsx
import { useEffect, useRef, useState } from "react";
```

- [ ] **Step 2: Draft 타입 확장 + 상수 + 드래그 상태**

31행 `type Draft = ...`를 교체:

```tsx
type Draft = {
  pageOrder: number;
  xNorm: number;
  yNorm: number;
  wNorm?: number;
  hNorm?: number;
} | null;
const INV = "scale(var(--inv-scale,5))";
// 점선 박스 테두리를 화면상 ~1.5px로 유지(콘텐츠 좌표라 줌에 반비례 보정).
const AREA_BORDER = "calc(1.5px * var(--inv-scale, 5))";
const DRAG_THRESHOLD = 5; // 화면 px — 이 미만 이동은 클릭(점)으로 간주
```

`pin-layer.tsx`의 상태 선언부(105–109행)에서 `const [draft, setDraft] = useState<Draft>(null);` 다음에 추가:

```tsx
  // 드래그 추적: 시작 client/content 좌표(ref) + 진행 중 미리보기 박스(state, 콘텐츠 좌표).
  const dragRef = useRef<{ sx: number; sy: number; cx0: number; cy0: number } | null>(null);
  const [dragBox, setDragBox] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
```

- [ ] **Step 3: click 핸들러를 pointer 핸들러로 교체**

170–190행 `function onCaptureClick(...) { ... }` 전체를 다음으로 교체:

```tsx
  // 현재 배율 기준 포인터→콘텐츠 좌표. 측정 실패 시 null.
  function toContentNow(clientX: number, clientY: number): { cx: number; cy: number } | null {
    const content = contentRef.current;
    if (!content) return null;
    const rect = content.getBoundingClientRect();
    const ow = content.offsetWidth;
    if (ow <= 0) return null;
    return toContent(clientX, clientY, rect, rect.width / ow);
  }

  function onPointerDownCapture(e: React.PointerEvent) {
    if (e.button !== 0) return; // 좌클릭만
    // 스페이스 패닝 중에는 드래그를 시작하지 않는다(라이브러리 패닝에 양보).
    if (spaceHeld) return;
    if (isGuest) {
      setLoginOpen(true);
      return;
    }
    const p = toContentNow(e.clientX, e.clientY);
    if (!p) return;
    dragRef.current = { sx: e.clientX, sy: e.clientY, cx0: p.cx, cy0: p.cy };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }

  function onPointerMoveCapture(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    const moved = Math.hypot(e.clientX - d.sx, e.clientY - d.sy);
    if (moved < DRAG_THRESHOLD) {
      if (dragBox) setDragBox(null);
      return;
    }
    const p = toContentNow(e.clientX, e.clientY);
    if (!p) return;
    setDragBox({
      left: Math.min(d.cx0, p.cx),
      top: Math.min(d.cy0, p.cy),
      width: Math.abs(p.cx - d.cx0),
      height: Math.abs(p.cy - d.cy0),
    });
  }

  function onPointerUpCapture(e: React.PointerEvent) {
    const d = dragRef.current;
    dragRef.current = null;
    setDragBox(null);
    if (!d) return;
    try {
      (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    } catch {
      // capture가 이미 해제된 경우 무시
    }
    const p = toContentNow(e.clientX, e.clientY);
    if (!p) return;
    const boxes = measureBoxes();
    const moved = Math.hypot(e.clientX - d.sx, e.clientY - d.sy);
    onSelectId(null);
    setEditingId(null);
    setDraftBody("");
    if (moved < DRAG_THRESHOLD) {
      // 클릭 = 점 코멘트(시작점 사용 — 기존 동작과 동일).
      const loc = locatePin(d.cx0, d.cy0, boxes);
      if (!loc) return;
      setDraft(loc);
    } else {
      // 드래그 = 영역 코멘트.
      const area = locateArea(d.cx0, d.cy0, p.cx, p.cy, boxes);
      if (!area) return;
      setDraft(area);
    }
  }
```

- [ ] **Step 4: 오버레이를 pointer 이벤트로 전환 + 드래그 미리보기 박스**

218–229행(코멘트 모드 오버레이 블록)을 교체:

```tsx
      {mode === "comment" && (
        // 시안 밖에도 핀을 찍을 수 있도록 콘텐츠 박스보다 크게 확장. 클릭=점, 드래그=영역.
        <div
          className={cn(
            "pointer-events-auto absolute",
            spaceHeld ? "cursor-grab" : "cursor-crosshair",
          )}
          style={{ inset: "-100000px" }}
          onPointerDown={onPointerDownCapture}
          onPointerMove={onPointerMoveCapture}
          onPointerUp={onPointerUpCapture}
        />
      )}

      {/* 드래그 중 점선 박스 미리보기(콘텐츠 좌표). 테두리는 줌 보정으로 화면상 일정 두께. */}
      {dragBox && (
        <div
          className="pointer-events-none absolute border-dashed"
          style={{
            left: dragBox.left,
            top: dragBox.top,
            width: dragBox.width,
            height: dragBox.height,
            borderStyle: "dashed",
            borderWidth: AREA_BORDER,
            borderColor: rt?.myColor ?? "#3b82f6",
            backgroundColor: `${rt?.myColor ?? "#3b82f6"}1a`,
          }}
        />
      )}
```

- [ ] **Step 5: 기존 핀 렌더에 영역(점선 박스) 분기 추가**

241–266행(핀 `map`의 시작부터 `<button>` 직전까지)을 교체. 핀 컨테이너 안에 영역이면 점선 박스를 먼저 그리고, 마커 `transformOrigin`을 분기한다:

```tsx
      {pins.map((p) => {
        const b = boxesByOrder.get(p.pageOrder);
        if (!b) return null;
        const isArea = p.wNorm != null && p.hNorm != null;
        // 점: (xNorm,yNorm)=뾰족한 끝점 / 영역: (xNorm,yNorm)=좌상단 코너.
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
            {isArea && (
              <div
                className="pointer-events-none absolute"
                style={{
                  left: 0,
                  top: 0,
                  width: p.wNorm! * b.width,
                  height: p.hNorm! * b.height,
                  borderStyle: "dashed",
                  borderWidth: AREA_BORDER,
                  borderColor: p.authorColor,
                  backgroundColor: `${p.authorColor}14`,
                  opacity: p.resolved ? 0.4 : 1,
                }}
              />
            )}
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
```

> 마커는 점/영역 모두 `transformOrigin: "0 100%"`로, 영역에서는 좌상단 코너 위에 깃발처럼 얹힌다(귀퉁이 코멘트). 박스 좌표·크기는 콘텐츠 좌표라 줌에 따라 함께 스케일되고, 테두리만 `AREA_BORDER`로 화면상 두께를 유지한다. 이 블록 아래의 `{open && (...)}` 팝오버와 닫는 태그들은 기존 그대로 둔다.

- [ ] **Step 6: draft submit에 영역 필드 패스스루**

192–208행 `submitDraft`의 `createMut.mutate(...)` 첫 인자는 이미 `{ ...draft, ... }`로 스프레드하므로 영역 draft의 `wNorm`/`hNorm`이 자동 포함된다 — **변경 없음**. (확인만: `{ ...draft, body, variantId, versionId, authorColor: rt?.myColor ?? "#3b82f6" }`)

- [ ] **Step 7: draft 미리보기 렌더에 영역 분기 추가**

400–457행(draft 렌더 IIFE)에서 박스 계산 직후에 점선 박스를 추가하고, 마커 위치를 분기한다. 해당 블록을 교체:

```tsx
      {draft &&
        (() => {
          const b = boxesByOrder.get(draft.pageOrder);
          if (!b) return null;
          const isArea = draft.wNorm != null && draft.hNorm != null;
          const { x, y } = placePin(b, draft.xNorm, draft.yNorm);
          return (
            <div className="absolute" style={{ left: x, top: y }}>
              {isArea && (
                <div
                  className="pointer-events-none absolute"
                  style={{
                    left: 0,
                    top: 0,
                    width: draft.wNorm! * b.width,
                    height: draft.hNorm! * b.height,
                    borderStyle: "dashed",
                    borderWidth: AREA_BORDER,
                    borderColor: rt?.myColor ?? "#3b82f6",
                    backgroundColor: `${rt?.myColor ?? "#3b82f6"}1a`,
                  }}
                />
              )}
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
```

- [ ] **Step 8: 타입검사 + 전체 단위 테스트**

Run: `npx tsc --noEmit`
Expected: 에러 없음.
Run: `npm run test`
Expected: 신규/수정 테스트 통과. (사전 실패 중 locate 2건은 Task 6에서 해소; lint/format 전역 이슈는 무관.)

- [ ] **Step 9: Commit**

```bash
git add src/widgets/preview-canvas/ui/pin-layer.tsx
git commit -m "feat(viewer): drag to create area comments (dashed box + corner pin)"
```

---

## 수동 E2E 체크리스트 (구현 후)

`npm run dev`로 공개 뷰어 캔버스 모드 진입 후:

- **기능 1 — 커서 구분**
  - 두 브라우저(또는 시크릿 창)로 같은 제안서 캔버스를 연다.
  - 둘이 **같은 안+버전** → 서로 커서가 선명(이름 라벨 보임).
  - 한쪽이 **다른 안 또는 다른 버전**으로 전환 → 상대에게 그 커서가 반투명(opacity≈0.35)·이름 라벨 숨김. 다시 같은 화면으로 돌아오면 선명 복구.
- **기능 2 — 영역 코멘트**
  - 코멘트 모드에서 **짧게 클릭** → 기존처럼 점 코멘트 작성기 표시·저장.
  - **드래그** → 점선 박스 미리보기가 따라오고, 놓으면 좌상단 코너에 작성기. 저장 시 점선 박스 + 코너 마커 표시.
  - 다른 브라우저에서 실시간으로 점/영역 코멘트가 동기화되는지.
  - 줌 인/아웃 시 점선 박스 위치·크기는 콘텐츠에 붙고 테두리 두께·마커 크기는 화면상 일정한지.
  - 시안 밖으로 드래그한 영역, 해결 처리 시 박스 흐려짐, 새로고침 후 영역 유지(하위호환) 확인.

> DB 적용: 운영/원격 반영 시 `npm run db:migrate` 실행(0019). 로컬 테스트도 영역 저장을 보려면 적용 필요.

---

## Self-Review (계획 작성자 점검 완료)

- **스펙 커버리지:** 기능1(Task 1–2), 기능2 데이터(Task 3–4)·서버(Task 5)·좌표(Task 6)·UI(Task 7) 모두 매핑됨. 테스트 전략(locate·schema 단위 + 수동 E2E)·마이그레이션 주의·하위호환 반영됨.
- **Placeholder 스캔:** TBD/TODO 없음. 모든 코드 스텝에 실제 코드 포함.
- **타입 일관성:** `viewKey`/`isSameView`(Task1↔2), `wNorm`/`hNorm` 명칭이 schema/DTO/server/locate/pin-layer 전반에서 일치. `locateArea`/`placeArea`/`AreaLocation` 시그니처가 Task6 정의와 Task7 사용처에서 일치. `sendCursor(cx,cy,view)` 시그니처가 provider 타입·구현·호출부에서 일치.
