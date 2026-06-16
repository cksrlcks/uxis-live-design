# Phase 2 — 프리뷰 UX 설계

> 작성일: 2026-06-16
> 상위 설계: `docs/superpowers/specs/2026-06-15-uxis-live-design-design.md` §6
> 선행 단계: Phase 1a(인증) · Phase 1b(시안·뷰어) — 완료

이 문서는 Phase 2(프리뷰 UX — 1920 풀스크린 슬라이드 + 캔버스 뷰 + 상단 토글)의 구현 결정을 확정한다.
Phase 1b의 "최소 세로 렌더" 뷰어를 토글식 프리뷰로 대체한다.

## 1. 범위

**포함**
- 상단 토글: **[풀화면] / [캔버스]**
- 풀스크린 슬라이드: 한 페이지씩, 클릭/←→ 넘김, 인디케이터, **native 1920px 고정(축소 금지)**, 세로 스크롤 + 스크롤바 숨김
- 캔버스 뷰: 전체 페이지를 가로 한 줄로 배치, 드래그 pan + 휠 zoom
- 공개 뷰어 + 편집자 상세 양쪽에서 쓰는 **공용 프리뷰 컴포넌트**

**제외 (YAGNI)**
- 실시간 커서·핀 코멘트·채팅 — **Phase 3**
- 미니맵, 썸네일 스트립, 실제 Fullscreen API, URL 뷰 상태 영속화

## 2. 확정된 결정

| # | 결정 | 선택 | 이유 |
|---|------|------|------|
| 1 | 적용 범위 | **공용 `<ProposalPreview>`** | 공개 뷰어 + 편집자 상세 모두 재사용(DRY). 편집자도 동일 풀화면/캔버스 경험 |
| 2 | 캔버스 pan/zoom | **react-zoom-pan-pinch** | 성숙한 라이브러리(드래그 pan·휠 zoom·핀치). transform 상태 접근 가능 → Phase 3 핀 좌표 정규화 재사용 |
| 3 | 기본 뷰 | **풀스크린 슬라이드** | 시안 검토 기본 경험이 1:1 풀화면이라 자연스러움 |
| 4 | 뷰 상태 | 컴포넌트 로컬 state | URL 영속화는 YAGNI |
| 5 | 풀화면 넘김 | 클릭=다음, ←/→=이전/다음, 휠=페이지 내 세로 스크롤 | 스펙 §6.1 |

## 3. 컴포넌트 구조

```
components/preview/
├─ proposal-preview.tsx   (client) 컨테이너를 꽉 채움. 토글 + 두 뷰 전환. 기본 풀화면
├─ fullscreen-slides.tsx  (client) 한 페이지씩, 클릭/키보드 넘김, 인디케이터, 스크롤바 숨김
└─ canvas-view.tsx        (client) react-zoom-pan-pinch로 가로 배치 pan/zoom
lib/preview/
└─ slide-nav.ts           (pure) 인덱스 clamp / next / prev — 단위 테스트
```

**Props (공용 인터페이스)**
```ts
type PreviewPage = { id: string; url: string; width: number; height: number };
function ProposalPreview(props: { pages: PreviewPage[] }): JSX.Element
```
- `pages`는 서버에서 만든 **signed read URL** + DB의 width/height. 클라이언트는 데이터를 직접 안 가져옴(BFF 유지).
- 컨테이너 채움(`h-full w-full`):
  - **공개 뷰어**(`/p/[publicId]` allow 분기): 부모 = 뷰포트(`h-screen`).
  - **편집자 상세**(`/dashboard/proposals/[id]`): "현재 버전 미리보기" 섹션을 큰 박스(`h-[80vh]`) 안 동일 컴포넌트로 교체.

## 4. 풀스크린 슬라이드 (핵심)

스펙 §6.1을 그대로 구현:

- **한 번에 한 페이지.** 현재 인덱스의 페이지만 렌더(또는 표시), 인디케이터 `현재/전체`(예: `3/12`).
- **넘김:** 슬라이드 영역 클릭 = 다음 장(마지막에서 멈춤), 키보드 **←/→** = 이전/다음. 휠은 페이지 내부 세로 스크롤.
- **절대 축소 금지:** `<img>`를 native 폭(보통 1920px)으로 렌더. max-width 미적용. 1920보다 좁은 뷰포트에서는 **가로 넘침(오른쪽 잘림)** — 축소하지 않음(우선순위 1).
- **세로 스크롤 + 스크롤바 숨김:** 슬라이드 컨테이너 `overflow-y: auto`이되 스크롤바 폭 0
  (`scrollbar-width: none` + `&::-webkit-scrollbar { display: none }`) → 스크롤바가 가로 공간을 먹어
  1920 이미지가 찌그러지거나 가로스크롤이 생기는 것 방지(이 동작이 핵심 요구사항).
- 페이지 전환 시 스크롤 위치는 맨 위로 초기화.

## 5. 캔버스 뷰

- **react-zoom-pan-pinch**(설치 시 React 19 / Next 16 호환 확인 — 비호환 시 `@use-gesture/react` 기반 직접 구현으로 대체).
- 모든 페이지를 **가로 한 줄**로 순서대로 native 크기 배치(페이지 사이 일정 간격). 진입 시 전체가 적당히 보이도록 초기 scale/center.
- 드래그 = pan, 휠 = zoom(+핀치). 줌 범위 제한(예: 0.1~4).
- 라이브러리의 transform 상태(scale, positionX/Y)에 접근 가능하게 구성 → Phase 3에서 화면 좌표 ↔ 페이지 정규화 좌표(0~1) 매핑에 재사용. (Phase 2는 pan/zoom까지만)

## 6. 통합 지점

- `app/p/[publicId]/page.tsx` — allow 분기의 `<img>` 세로 나열을 `<ProposalPreview pages={previews}/>`로 교체. `previews`에 width/height 포함(현재는 url만 전달하므로 page 행의 width/height도 함께 매핑).
- `app/(dashboard)/dashboard/proposals/[id]/page.tsx` — "현재 버전 미리보기" 섹션을 `<ProposalPreview/>`(박스 내)로 교체. 동일하게 width/height 포함.

## 7. 테스트 전략

- `lib/preview/slide-nav.ts` — `clampIndex` / `next` / `prev`(경계에서 멈춤) 단위 테스트.
- 인터랙션(클릭 넘김·키보드·스크롤바 숨김·pan/zoom)은 수동/E2E 검증(plan의 검증 단계). 라이브 앱은 Node ≥22 필요.

## 8. Done 기준 (Phase 2)

- 뷰어/상세에서 상단 토글로 풀화면 ↔ 캔버스 전환.
- 풀화면: 한 페이지씩, 클릭/←→ 넘김, 인디케이터 표시, 이미지 native 1920 고정(축소 안 함), 세로 긴 페이지는 스크롤바 없이 세로 스크롤.
- 캔버스: 전체 페이지 가로 배치, 드래그 pan + 휠 zoom 동작.
- 공개 뷰어와 편집자 상세가 동일한 `<ProposalPreview>`를 공유.
- `slide-nav` 단위 테스트 통과, 빌드/타입체크 통과.

**다음 단계:** Phase 3 — 실시간 회의(커서 presence · 채팅 broadcast+기록 · 핀 코멘트, 캔버스 뷰 위에서).
