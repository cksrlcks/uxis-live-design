# 뷰어 커서 안/버전 구분 + 영역(드래그) 코멘트 설계

작성일: 2026-06-25

## 배경

공개 뷰어(`/p/[publicId]`)의 캔버스 모드는 두 가지 실시간 협업 요소를 가진다.

1. **원격 커서** — 같은 제안서를 보는 다른 사람의 커서를 콘텐츠 좌표로 표시한다.
2. **코멘트 핀** — 클릭으로 점(point) 코멘트를 찍는다.

현재 두 기능 모두 한계가 있다.

- **커서**: 실시간 채널은 제안서당 하나(`proposal:${publicId}`)이고, 모든 안(variant)/버전(version)이 같은 채널을 공유한다. 커서 broadcast payload는 `{ id, name, color, cx, cy }`뿐이라 **"발신자가 어떤 안/버전을 보는지" 정보가 없다.** 그래서 다른 안을 보는 사람의 커서가 내 캔버스에 같은 화면처럼 그대로 찍혀 혼란을 준다.
- **코멘트**: 점 코멘트만 가능하다. 피그마처럼 영역을 드래그해 점선 박스를 그리고 귀퉁이에 코멘트를 다는 형식이 없다.

## 목표

1. **기능 1** — 다른 안/버전을 보고 있는 사람의 커서를 **반투명(흐리게)** 으로 표시해 같은 화면을 보는 사람과 시각적으로 구분한다.
2. **기능 2** — 기존 코멘트 모드에서 **클릭=점 코멘트, 드래그=영역 코멘트**(점선 테두리 박스 + 좌상단 귀퉁이 코멘트)를 모두 지원한다.

## 비목표 (YAGNI)

- 영역 코멘트의 리사이즈/이동 편집 (생성 후 위치 고정).
- fullscreen(슬라이드) 모드에서의 영역 코멘트 — 코멘트 기능은 캔버스 모드 전용이므로 동일하게 캔버스 한정.
- 커서 구분을 페이지 단위까지 세분화 — 안/버전 단위까지만 구분한다.
- 커서가 fullscreen 사용자까지 포함하도록 확장 — 커서 캡처는 기존대로 캔버스 모드에서만 동작.

---

## 기능 1 — 다른 안/버전 커서 반투명 처리

### 데이터 흐름

커서 payload에 발신자의 "보기 키(view key)"를 실어 보내고, 수신자가 자기 보기 키와 비교한다.

- **보기 키** = `${variantId}:${versionId}` 형식의 문자열.
- 발신: `CanvasCursorCapture`가 현재 `pin`(PinContext)의 `variantId`/`versionId`로 보기 키를 만들어 `sendCursor`에 함께 전달.
- 수신: `CanvasCursorLayer`가 현재 보기 키를 받아 각 원격 커서의 `view`와 비교 → 다르면 반투명.

### 변경 지점

**`src/shared/realtime/realtime-provider.tsx`**

- `RemoteCursor` 타입에 `view?: string` 추가.
  ```ts
  export type RemoteCursor = {
    id: string;
    name: string;
    color: string;
    cx: number;
    cy: number;
    view?: string; // `${variantId}:${versionId}` — 발신자가 보고 있는 안/버전
  };
  ```
- `sendCursor`를 `(cx: number, cy: number, view?: string)`로 확장. broadcast payload에 `view` 포함.
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
- `RealtimeContextValue`의 `sendCursor` 시그니처도 동일하게 갱신.
- 수신 핸들러는 payload를 그대로 `RemoteCursor`로 캐스팅하므로 `view`가 자동 포함된다(추가 변경 없음).

**`src/widgets/preview-canvas/ui/canvas-cursors.tsx`**

- `CanvasCursorCapture`에 `viewKey?: string` prop 추가. `onMove`에서 `send(cx, cy, viewKey)`로 전달.
  - `viewKey`를 ref로 보관해 최신 값을 effect 재구독 없이 읽는다(커서 effect는 `viewKey`가 바뀔 때마다 재바인딩하지 않는다).
- `CanvasCursorLayer`에 `viewKey?: string` prop 추가. 각 커서 렌더 시 비교:
  ```tsx
  const sameView = !viewKey || !c.view || c.view === viewKey;
  ```
  - `sameView`이면 기존대로 선명(opacity 1, 이름 라벨 표시).
  - 다르면 컨테이너에 `opacity: 0.35` 적용 + 이름 라벨 숨김(흐릿한 커서 아이콘만). `transition: opacity 150ms`로 부드럽게 전환.
  - `viewKey`나 `c.view`가 없으면(에디터 프리뷰 등 컨텍스트 부재) 기존 동작 유지(선명).

**`src/widgets/preview-canvas/ui/canvas-view.tsx`**

- `pin`이 있으면 `const viewKey = pin ? \`${pin.variantId}:${pin.versionId}\` : undefined;` 계산.
- `<CanvasCursorLayer viewKey={viewKey} />`, `<CanvasCursorCapture ... viewKey={viewKey} />`로 전달.

### 부수 효과 / 호환성

- DB 변경 없음. 순수 클라이언트/실시간 레이어 변경.
- 구버전 클라이언트가 보낸 `view` 없는 커서 → 수신 측에서 `sameView` 처리되어 기존처럼 선명(안전한 폴백).

---

## 기능 2 — 영역(드래그) 코멘트

### 데이터 모델

마이그레이션 **`0019`** 로 `pin_comments`에 nullable 컬럼 2개 추가.

```sql
ALTER TABLE "pin_comments" ADD COLUMN "w_norm" real;
ALTER TABLE "pin_comments" ADD COLUMN "h_norm" real;
```

- `w_norm`/`h_norm`이 **둘 다 NULL** → 기존 **점 코멘트**.
- `w_norm`/`h_norm`이 **둘 다 존재** → **영역 코멘트**.
- 좌표 의미:
  - `(x_norm, y_norm)` = 영역의 **좌상단 코너**(점 코멘트는 핀 끝점). 페이지 기준 정규화.
  - `(w_norm, h_norm)` = 페이지 기준 정규화된 **너비/높이**(항상 양수).
- 기존 데이터/코드 완전 하위호환(점 코멘트는 두 컬럼 NULL).

**`drizzle/schema.ts`** — `pinComments`에 추가:
```ts
wNorm: real("w_norm"),   // nullable: 영역 코멘트일 때만
hNorm: real("h_norm"),   // nullable: 영역 코멘트일 때만
```

### 스키마 / 타입 / 서버

**`src/entities/pin/model/pin-schema.ts`**

- `createPinInputSchema`에 영역 필드 추가 + 쌍(pair) 검증.
  ```ts
  export const createPinInputSchema = z
    .object({
      variantId: z.string().min(1),
      versionId: z.string().min(1),
      pageOrder: z.number().int().min(0),
      xNorm: z.number().finite().min(-10).max(10),
      yNorm: z.number().finite().min(-10).max(10),
      // 영역 코멘트: 둘 다 있거나 둘 다 없어야 함. 너비/높이는 양수, 폭주 방지로 상한 제한.
      wNorm: z.number().finite().positive().max(20).optional(),
      hNorm: z.number().finite().positive().max(20).optional(),
      authorColor: z.string().trim().min(1).max(32),
      body: pinBodySchema,
    })
    .refine((d) => (d.wNorm == null) === (d.hNorm == null), {
      message: "wNorm/hNorm must be provided together",
    });
  ```

**`src/entities/pin/model/types.ts`**

- `PinDTO`에 `wNorm?: number | null; hNorm?: number | null;` 추가.

**`src/features/pin-comment/api/create-pin-comment.server.ts`**

- 구조분해에 `wNorm`, `hNorm` 포함. `db.insert(...).values({ ..., wNorm: wNorm ?? null, hNorm: hNorm ?? null })`.
- 반환 `PinDTO`에 `wNorm: wNorm ?? null, hNorm: hNorm ?? null` 포함.
- 핀 조회(목록 select) 쪽도 `wNorm`/`hNorm`를 선택해 DTO에 매핑(점 코멘트는 null로 내려감).

### 좌표 헬퍼

**`src/widgets/preview-canvas/lib/locate.ts`**

- 기존 `locatePin`/`placePin`은 점용으로 유지.
- 영역용 헬퍼 추가:
  - `locateArea(start: {cx,cy}, end: {cx,cy}, boxes)` → 시작점이 속한(또는 가장 가까운) 페이지를 기준으로 좌상단 코너 + w/h를 정규화. 좌상단은 `min(startX,endX)`, 너비는 `abs(dx)/box.width`로 계산(드래그 방향 무관).
  - `placeArea(box, xNorm, yNorm, wNorm, hNorm)` → `{ left, top, width, height }` 콘텐츠 좌표 박스 반환(placePin 좌상단 + 크기 환산).

### 인터랙션 (같은 코멘트 모드, 클릭=점 / 드래그=영역)

**`src/widgets/preview-canvas/ui/pin-layer.tsx`**

- 코멘트 모드 오버레이를 기존 `onClick` → 포인터 핸들러로 전환:
  - `onPointerDown`: 스페이스 패닝/게스트 분기는 기존 그대로. 시작 콘텐츠 좌표 기록(`dragStart`), `setPointerCapture`.
  - `onPointerMove`: 시작점 대비 이동량이 임계값(**화면 ~5px**, 현재 scale 반영해 콘텐츠 좌표로 환산) 미만이면 무시. 이상이면 "드래그 중" 상태로 전환하고 점선 박스 미리보기 좌표를 state로 갱신.
  - `onPointerUp`:
    - 드래그 안 함(임계값 미만) → 기존 `locatePin`으로 **점 draft** 생성(기존 동작 그대로).
    - 드래그 함 → `locateArea`로 **영역 draft** 생성(좌상단 코너 + wNorm/hNorm).
- `Draft` 타입 확장: `{ pageOrder; xNorm; yNorm; wNorm?: number; hNorm?: number }`.
- `submitDraft`: draft에 wNorm/hNorm 있으면 mutate 입력에 포함.
- 드래그 미리보기: 드래그 중에는 점선 박스만 그리고, pointerup 후 작성기 팝오버를 좌상단 코너에 띄운다(기존 draft 폼 재사용).

### 렌더링

**`src/widgets/preview-canvas/ui/pin-layer.tsx`** (핀 목록 + draft 렌더)

- 각 핀이 영역(wNorm/hNorm 존재)이면:
  - `placeArea`로 박스를 구해 **점선 테두리 박스**(`border-2 border-dashed`, 색 = `authorColor`, 반투명 배경 옵션)를 그린다. 박스 자체는 줌에 따라 같이 커지므로 `--inv-scale` 보정 없이 콘텐츠 좌표 그대로.
  - **좌상단 귀퉁이**에 기존 `PinMarker`(말풍선) + 팝오버를 기존과 동일하게 배치(`transform: var(--inv-scale)`로 화면상 크기 고정).
- 점 코멘트(wNorm/hNorm 없음)는 기존 렌더 100% 그대로.
- draft도 동일: 영역 draft면 점선 박스 미리보기 + 좌상단 작성기.

### 실시간 동기화

- 생성 성공 후 `rt?.broadcastPin(saved)` 그대로 사용 — payload에 `wNorm`/`hNorm`가 포함되어 자동 동기화.
- 수신 측(`pin-layer`의 subscribePins 병합)은 DTO를 그대로 캐시에 넣으므로 추가 변경 없음.

---

## 테스트 전략

- **단위 테스트 (`locate.ts`)**: `locateArea`/`placeArea`의 왕복(round-trip) — 드래그 방향(좌상→우하, 우하→좌상) 무관하게 동일 박스 산출, 페이지 밖 케이스, 점 코멘트와의 분리.
- **단위 테스트 (zod 스키마)**: `wNorm`/`hNorm` 쌍 검증 — 둘 다 / 둘 다 없음은 통과, 하나만 있으면 실패. 음수/상한 초과 거부.
- **수동 E2E**:
  - 기능 1: 두 브라우저에서 같은 제안서를 열고 서로 다른 안/버전 → 상대 커서 반투명 확인. 같은 안/버전 → 선명 확인.
  - 기능 2: 클릭 = 점 코멘트, 드래그 = 영역(점선 박스) 코멘트 생성·표시·실시간 동기화·점 코멘트 하위호환 확인.

## 마이그레이션 주의

- 로컬 DB 마이그레이션 적용은 Node ≥22 필요(프로젝트 메모리 참조).
- `0019` 추가 후 drizzle-kit으로 생성하거나 수동 SQL 작성. 컬럼은 nullable이라 기존 row 무영향.

## 변경 파일 요약

| 영역 | 파일 |
| --- | --- |
| 커서 타입/전송 | `src/shared/realtime/realtime-provider.tsx` |
| 커서 캡처/렌더 | `src/widgets/preview-canvas/ui/canvas-cursors.tsx` |
| 보기 키 주입 | `src/widgets/preview-canvas/ui/canvas-view.tsx` |
| 핀 DB 스키마 | `drizzle/schema.ts`, `drizzle/migrations/0019_*.sql` |
| 핀 입력 스키마 | `src/entities/pin/model/pin-schema.ts` |
| 핀 DTO | `src/entities/pin/model/types.ts` |
| 핀 생성/조회 서버 | `src/features/pin-comment/api/create-pin-comment.server.ts` (+ 목록 조회 select) |
| 좌표 헬퍼 | `src/widgets/preview-canvas/lib/locate.ts` |
| 코멘트 인터랙션/렌더 | `src/widgets/preview-canvas/ui/pin-layer.tsx` |
