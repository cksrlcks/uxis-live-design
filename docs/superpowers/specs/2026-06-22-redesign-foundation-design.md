# 전면 리디자인 — 0. 파운데이션(토큰 + 코어 컴포넌트) 스펙

> 작성일: 2026-06-22
> 상위 방향: GitGuardian 풍 대시보드 전면 개편 (블루 주색 · 보더 주도 플랫 · 우측 상세 패널)
> 이 문서는 전면 개편의 **하위작업 0(파운데이션)** 범위만 다룬다. 셸/화면은 후속 스펙.

## 1. 목표

모든 토큰의 기준이 되는 **주색을 near-black → 블루(#146ef5)** 로 전환하고, 상태
표시용 **소프트 필 뱃지(StatusPill) 변형**을 도입한다. 이 두 가지가 앱 전체 룩을
즉시 GitGuardian 톤으로 끌어올리는 최소·최대레버리지 변경이다. 동시에
`design-system.md` 를 새 방향(v2)으로 개정한다.

## 2. 범위

**손대는 파일**

- `src/app/styles/globals.css` — `--primary` 를 블루로. (`--foreground` 잉크는 near-black 유지)
- `src/shared/ui/button.tsx` — default 버튼 hover 를 블루 darken 으로.
- `src/shared/ui/badge.tsx` — 시맨틱 소프트 필 변형 추가(info/success/warning/error/neutral).
- `docs/design-system.md` — 상단에 "v2 — GitGuardian 대시보드 방향" 절을 추가해 충돌 규칙을 명시적으로 갱신.

**비목표 (후속 하위작업)**

- 그레이 2계층 캔버스(`--background` 변경)는 **스튜디오 셸(하위작업 1)** 에서 도입 — 뷰어/인증 회귀 방지를 위해 지금은 안 건드림.
- 사이드바·브레드크럼·우측 상세 패널 등 합성 컴포넌트는 셸/화면 단계에서.
- 화면별 뱃지 시맨틱 적용(공개상태/역할 등)은 하위작업 2.

## 3. 블래스트 반경 (검증됨)

`bg-primary`/`text-primary` 사용처는 `button.tsx`, `badge.tsx` **두 곳뿐**.
→ `--primary` 를 블루로 바꾸면 정확히 버튼·기본뱃지만 블루가 되고, 잉크/제목은
`--foreground`(near-black) 그대로다. 공개 뷰어는 `bg-background` 직접 참조가 없어
영향 없음.

## 4. 상세

### 4.1 토큰 (globals.css)

```css
:root {
  /* near-black 은 잉크(--foreground)로만 남기고, 전환색(primary)을 블루로 */
  --primary: #146ef5;          /* was #080808 — GitGuardian blue */
  --primary-foreground: #ffffff;
  /* --ring 은 이미 #146ef5 → 포커스링이 주색과 일치(추가 작업 없음) */
}
```

### 4.2 Button (button.tsx)

- default 변형: `hover:bg-primary/80`(밝아짐) → `hover:bg-[color-mix(in_oklab,var(--primary),#000_12%)]`(어두워짐, GitGuardian hover 거동).
- 나머지 변형/4px 라운드/사이즈는 그대로.

### 4.3 Badge — 시맨틱 소프트 필 (badge.tsx)

기존 변형(default/secondary/destructive/outline/ghost/link) 유지하고 아래를 **추가**.
연한 틴트 배경 + 가독 가능한 진한 동색 텍스트(밝은 hue 는 black 으로 darken).

| 변형 | 배경 | 텍스트 | 용도 |
|------|------|--------|------|
| `info` | `bg-info/10` | info blue | 진행/일반 정보 |
| `success` | `bg-success/15` | green darken 30% | 공개(비번X)/resolved |
| `warning` | `bg-warning/15` | orange darken 32% | 공개+비번/role pending/High |
| `error` | `bg-destructive/10` | destructive red | Triggered/오류/파괴 |
| `neutral` | `bg-muted` + `border-border` | `text-muted-foreground` | 비공개/중립 |

> 모양은 현 badge 의 pill(`rounded-4xl`)·`h-5`·`text-xs`·아이콘 슬롯 그대로.

### 4.4 design-system.md (v2 절 추가)

문서 최상단에 절 추가, 충돌 규칙을 명시적으로 갱신:

- 주색: near-black → **블루 #146ef5**. near-black 은 제목·본문·잉크 전용.
- 엘리베이션: 레이어드 섀도우 시그니처 → **보더 주도 플랫**. 레이어드 섀도우는 팝오버/모달에만.
- 표면: 흰 단일 → **앱 캔버스(옅은 그레이) + 흰 카드** 2계층(셸 단계 적용).
- 컴포넌트 추가: StatusPill(소프트 필), Breadcrumb, 우측 DetailPanel, 워크스페이스 스위처형 Sidebar.
- §8 Don't 의 "액센트색 버튼 배경 금지"는 **주색 블루에 한해 해제**(나머지 4색 액센트는 여전히 면/상태용).

## 5. 검증 기준

- 로그인 등 모든 1차 버튼이 **블루**로 렌더. 텍스트/제목은 여전히 near-black.
- 새 뱃지 변형 5종이 컴파일된 CSS 에 생성됨.
- 기존 기능·레이아웃 회귀 없음(뷰어/인증 배경 변화 없음).
- lint · `tsc --noEmit` · 런타임 `/login` 200 통과.
