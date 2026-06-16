# 실시간 커서 — 캔버스 콘텐츠 좌표계 (피그마식 멀티커서) 설계

> 작성일: 2026-06-17
> 상위 설계: `docs/superpowers/specs/2026-06-16-phase5-realtime-meeting-design.md` (Phase 5 Stage 1)
> 선행: Phase 5 Stage 1(참여자·커서 ephemeral) — 완료·머지
> 범위 결정: **코어 커서만** (팔로우 모드/스포트라이트/커서챗은 제외, 후속 가능)

캔버스 뷰(`?view=canvas`)에서 실시간 커서가 **각 사용자의 줌/팬과 무관하게 디자인 콘텐츠의 같은 지점에 붙도록** 좌표계를 화면 기준 → 콘텐츠 기준으로 전환한다. 피그마의 멀티커서 핵심 경험("커서가 콘텐츠에 용접됨")을 재현한다.

## 0. 문제 (현재 상태)

- [components/realtime/cursor-overlay.tsx](../../components/realtime/cursor-overlay.tsx)는 커서를 `e.clientX / window.innerWidth`, `e.clientY / window.innerHeight` — **브라우저 윈도우 기준 정규화 좌표**로 broadcast하고, `fixed inset-0` 오버레이에 같은 화면 비율로 렌더한다.
- 캔버스([components/preview/canvas-view.tsx](../../components/preview/canvas-view.tsx))는 `react-zoom-pan-pinch`로 **사람마다 독립적인** 줌(`minScale 0.1` ~ `maxScale 3`, 초기 0.2)·팬을 한다. 이 transform 상태는 공유되지 않는다.
- 커서 오버레이는 캔버스의 transform과 **분리된 트리**([components/realtime/realtime-shell.tsx](../../components/realtime/realtime-shell.tsx)에서 `fixed`로 부유)에 있어, 콘텐츠 좌표를 알 방법이 없다.

결과: A의 "내 화면 40%·30% 지점"을 B가 자기 화면 40%·30%에 그리므로, 두 사람의 줌/팬(또는 창 크기)이 정확히 같을 때만 우연히 일치하고 그 외엔 항상 어긋난다. 확대는 이 어긋남이 드러나는 대표 상황.

> 참고: Phase 5 스펙은 `lib/realtime/coords.ts`로 **공유 콘텐츠 영역 기준** 정규화를 의도했으나, Stage 1 구현이 윈도우 기준으로 단순화되면서 이 갭이 생겼다. 본 설계가 그 의도를 캔버스 transform에 맞게 완성한다.

## 1. 범위

**포함**
- 캔버스 뷰의 실시간 커서를 **콘텐츠(world) 좌표**로 송수신 → 각자 줌/팬에 무관하게 같은 콘텐츠 지점 표시
- 커서 아이콘+이름표는 줌 배율과 무관하게 **화면상 일정 크기** 유지
- 내 화면 밖의 상대 커서는 **표시 안 함**(클리핑, 피그마와 동일)

**제외 (YAGNI / 후속)**
- 팔로우 모드(아바타 클릭 → 상대 뷰포트 동기화)
- 스포트라이트("모두 나를 따라와"), 커서챗, 선택 영역 하이라이트
- 풀화면 슬라이드 뷰(`?view=fullscreen`)의 커서 — 캔버스 전용 유지(기존과 동일)
- 다른 변형(variant)을 보는 피어 간 좌표 정합 (아래 §6 한계 참조)

## 2. 확정된 결정

| # | 결정 | 선택 | 이유 |
|---|------|------|------|
| 1 | 좌표계 | **콘텐츠 div 좌상단 원점, 배율 1배 기준 px** (`cx`, `cy`) | 전 클라이언트가 같은 페이지 레이아웃 → 공통 좌표계. 원점 좌상단 고정이라 총 콘텐츠 크기/이미지 로드 타이밍과 무관 |
| 2 | 렌더 위치 | **`TransformComponent` 콘텐츠 *안*** (안 1) | 라이브러리가 각자 줌/팬으로 자동 투영 → 투영 수학 직접 구현 불필요, 드리프트 없음 |
| 3 | 아이콘 크기 | **`scale(1/배율)` 역보정**, `transformOrigin` 커서 끝 | 줌에 무관하게 화면상 일정 크기(피그마 동작) |
| 4 | 화면 밖 커서 | **래퍼 `overflow:hidden` 자연 클리핑** | 별도 엣지 인디케이터 없음(피그마 코어와 동일) |
| 5 | 캡처/렌더 소유 | **CanvasView로 이동**, RealtimeShell의 `<CursorOverlay/>` 제거 | 캡처(콘텐츠 rect+scale)와 렌더 모두 transform 컨텍스트가 필요 → 한 곳에서 소유 |
| 6 | scale 추적 | **`onInit`+`onTransform` → CSS 변수 `--inv-scale` DOM 직접 write** | 매 프레임 React 리렌더 없이 모든 커서가 역보정값 공유. 안정적 부모에 두면 늦게 마운트된 커서도 즉시 상속 |

## 3. 아키텍처 / 데이터 흐름

```
CanvasView (?view=canvas 에서만 마운트 → 게이팅 자동)
  └─ TransformWrapper  (onInit/onTransform → contentRef에 --inv-scale = 1/scale write)
       └─ TransformComponent
            └─ contentRef div  (페이지 가로열 + 커서 레이어, 좌상단 = 원점)
                 ├─ <img> 페이지들 …
                 └─ CursorLayer
                      └─ 각 RemoteCursor: position absolute, left=cx, top=cy
                                          아이콘/라벨: transform scale(var(--inv-scale))
  (capture) window pointermove → cx=(clientX−rect.left)/scale, cy=(clientY−rect.top)/scale
            → rAF throttle → sendCursor(cx, cy)
```

**송신** — `pointermove`를 콘텐츠 div `getBoundingClientRect()`(줌·팬 반영된 화면 rect)와 현재 scale로 역변환:
`cx = (clientX − rect.left) / scale`, `cy = (clientY − rect.top) / scale`. 콘텐츠 밖이면 `clearCursor()`. 기존 rAF 스로틀 유지.

**수신/렌더** — 커서를 콘텐츠 div 안에 `left:cx; top:cy`로 절대배치. 라이브러리가 각 뷰어의 transform으로 자동 투영. 아이콘+이름표만 `scale(var(--inv-scale))`로 역보정(`transformOrigin` 좌상단=커서 끝).

**self 커서 가드** — [realtime-provider.tsx](../../components/realtime/realtime-provider.tsx)의 `p.id === identityRef.current.id` 가드 유지(내 커서 렌더 안 함).

## 4. 변경 사항

### 4.1 데이터 모델 ([components/realtime/realtime-provider.tsx](../../components/realtime/realtime-provider.tsx))
- `RemoteCursor`: `{ xNorm, yNorm }` → `{ cx, cy }` (콘텐츠 px)
- `sendCursor(xNorm, yNorm)` → `sendCursor(cx, cy)`
- broadcast `cursor` payload 필드명 교체 (구조 동일, 의미만 변경)
- `cursor_leave`, presence sync, self 가드 로직은 변경 없음

### 4.2 좌표 변환 (기존 `lib/realtime/coords.ts` 확장)
- `toContent(clientX, clientY, rect, scale) => { cx, cy }`
- `isInside(clientX, clientY, rect) => boolean` (콘텐츠 밖 판정 → clearCursor)
- 순수 함수로 추출해 단위 테스트
- 기존 `toNorm`/`fromNorm`/`clamp01`은 현재 **앱 코드에서 미사용**(자체 테스트만 참조). 그대로 두거나, 새 함수가 대체하면 dead code로 제거 가능

### 4.3 캡처+렌더 이동
- **신규** `components/realtime/canvas-cursors.tsx` (또는 CanvasView 내부 컴포넌트): 콘텐츠 ref + 현재 scale을 받아 캡처(pointermove→sendCursor)와 렌더(CursorLayer)를 모두 담당
- [components/preview/canvas-view.tsx](../../components/preview/canvas-view.tsx): contentRef 부여, `onInit`/`onTransform`에서 `--inv-scale` write, 콘텐츠 div 안에 커서 레이어 마운트
- [components/realtime/realtime-shell.tsx](../../components/realtime/realtime-shell.tsx): `<CursorOverlay/>` 제거
- [components/realtime/cursor-overlay.tsx](../../components/realtime/cursor-overlay.tsx): 삭제 또는 canvas-cursors로 대체

## 5. 파일 요약
```
lib/realtime/coords.ts              toContent / isInside 추가 (순수·테스트)        [확장]
components/realtime/realtime-provider.tsx   RemoteCursor·sendCursor 시그니처 변경  [수정]
components/realtime/canvas-cursors.tsx      캡처+CursorLayer (transform 컨텍스트 내) [신규]
components/preview/canvas-view.tsx          contentRef·onInit/onTransform·커서 레이어 마운트 [수정]
components/realtime/realtime-shell.tsx      <CursorOverlay/> 제거                   [수정]
components/realtime/cursor-overlay.tsx      삭제/대체                               [제거]
```

## 6. 알려진 한계 (코어 범위 밖)
- 채널이 변형(variant) 전환에도 유지되므로, 두 사람이 **다른 변형**을 보면 콘텐츠 좌표 의미가 어긋난다. 코어에선 "같은 변형을 본다"고 가정. 후속으로 payload에 variant 식별자를 넣어 **같은 변형 피어의 커서만** 표시하도록 확장 가능.
- 풀화면 슬라이드 뷰는 커서 미표시(기존 유지).

## 7. 테스트
- **단위** (`lib/realtime/coords.ts`): `toContent` 역변환(rect·scale 조합), `isInside` 경계/밖 판정.
- **수동(E2E 2탭)**: 두 브라우저에서 서로 다른 줌(예: 0.2x vs 2x)·팬으로 같은 페이지의 같은 버튼을 가리켜 커서가 일치하는지, 아이콘 크기가 줌과 무관하게 일정한지, 내 화면 밖 커서가 안 보이는지 확인.
- 커밋마다 `npx tsc --noEmit` + Vitest 게이트(기존 패턴).

## 8. Done 기준
두 사람이 같은 `/p/[publicId]`의 캔버스 뷰에서 **서로 다른 줌/팬**으로 보고 있어도, 한 사람이 가리키는 디자인 지점에 상대의 커서가 정확히 표시된다. 커서 아이콘은 줌 배율과 무관하게 화면상 일정 크기이며, 내 화면 밖의 커서는 보이지 않는다. self 커서는 여전히 렌더되지 않는다.

**작업 형태**: 작은 커밋(좌표 순수함수 → 데이터 모델 → 캡처/렌더 이동 → cleanup), 커밋마다 tsc+Vitest, 끝에 2탭 수동 검증.
