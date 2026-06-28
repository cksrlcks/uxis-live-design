# 스튜디오 디자인 시스템 — Linear-라이트 토대 (Sub-project 1)

> 작성일: 2026-06-28
> 분류: 디자인 시스템 토대 + 대표 화면(시안 목록) 검증
> 후속: 나머지 7개 스튜디오 화면 재구상은 각각 별도 spec (§12)

---

## 1. 개요

스튜디오(관리) 화면들이 시각적으로 **투박하고 제각각**이다. 라운드는
`rounded-full/lg/xl/md/2xl`가 컨테이너마다 혼용되고(스튜디오 전반 158곳), 타이포는
`text-[13px]`·`[15px]`·`[11px]`·`[10px]`·`[9px]` 같은 임의값이 21곳, `text-xs`~`text-3xl`이
난립한다. 토큰·shadcn primitive·`design-system.md`는 이미 존재하지만 **실제 페이지가
시스템을 제각각 적용**해 드리프트가 누적됐다.

이 작업은 새 화면을 만드는 게 아니라, **재사용 가능한 시스템(토큰 + primitive +
레시피)을 다시 조이고 한 대표 화면에 적용해 검증**하는 것이다. 톤은 **Linear의 구조적
특성(밀도·차분함·작은 라운드·절제된 타이포)을 라이트 + 블루 포인트로** 가져온다.

이것은 전체 작업(8개 화면 전면 재구상)의 **1번째 sub-project = 토대**다. 토대가
primitive/레시피로 공유되므로 토대만 깔려도 모든 화면이 즉시 일관돼지고, 이후 각 화면
재구상이 작고 안전해진다.

### 목표

- 스튜디오를 **다크 → 라이트**로 전환(`/studio` 본체만).
- **하나의 토큰 contract** 확정: 컬러·라운드·타이포·스페이싱·엘리베이션.
- 공유 **primitive 리팩터**(button/card/badge/input/select/table/tabs/dialog/dropdown)를
  토큰 기반으로 일관화.
- 재사용 **레시피** 신설(PageHeader·Toolbar·DataTable·StatusPill·EmptyState·
  SegmentedControl·FilterControl).
- `design-system.md`에 **v3 — Studio Linear-라이트** 절 추가(레퍼런스 문서화).
- 대표 화면 **시안 목록(`/studio/proposals`)을 Refined Table로 재구상**해 시스템 검증.

### 비목표 (이번 spec 밖)

- 스튜디오 첫 진입 홈(`/studio`)·랜딩(`/`)·공개 뷰어(`/p`,`/chat`)·인증(로그인 등) **레이아웃 재디자인**.
  단, 라이트 전환은 경로 프리픽스 기반이라 `/studio` 홈도 **다크→라이트 영향은 받는다**.
  홈 콘텐츠는 재구상하지 않되, 라이트에서 깨지지 않도록 **최소 보정만** 허용(§4).
- `/me`·`/pending`·`/plugin-auth`의 라이트 전환(다크 유지, 후속).
- 시안 목록 외 나머지 화면의 IA 재구상(§12 후속 spec).
- 신규 기능/데이터 모델 변경. 순수 프레젠테이션 레이어 작업.

---

## 2. 브레인스토밍에서 확정된 결정

| 항목 | 결정 |
|---|---|
| 작업 깊이 | 전면 재구상(IA/레이아웃 포함). 단, **토대 먼저 → 화면은 순차** 분해 |
| 비주얼 톤 | **Linear 스타일**(구조적 특성) + **블루 포인트 유지**(`#146ef5`, Linear 보라 아님) |
| 산출물 | primitive + 레시피 + 문서 (별도 갤러리 페이지 없음) |
| 테마 | **라이트**. `/studio`만 전환, 로그인은 다크 유지 |
| 캘리브레이션 | **B — Balanced**: 카드 8px / 컨트롤 6px / 한 단계 여유 밀도 |
| 셸 | **A — Defined**: 흰 사이드바 + 우측 hairline, 옅은 그레이 캔버스 |
| 대표 화면 IA | **Refined Table**(표 중심) + 썸네일 토글 보조 뷰 |

비주얼 시안 파일(참고): `.superpowers/brainstorm/12060-1782626604/content/`의
`calibration.html`·`shell.html`·`flagship.html`·`kit.html`.

---

## 3. 토큰 contract

### 3.1 컬러 (라이트)

| 역할 | 토큰(의미) | HEX |
|---|---|---|
| 잉크(제목/foreground) | ink | `#08090a` |
| 본문 | body | `#3c4149` |
| 흐림(보조 텍스트) | muted-foreground | `#6b7280` |
| 약흐림(placeholder/메타) | faint | `#9aa0aa` |
| 캔버스(앱 배경) | canvas | `#f7f8f9` |
| 카드/면 | card | `#ffffff` |
| 헤어라인(보더) | hairline | `#e7e8ea` |
| 헤어라인 약(내부 디바이더) | hairline-soft | `#eef0f2` |
| 포인트(primary) | blue | `#146ef5` |

상태/시맨틱 pill (연한 틴트 + 동색 진한 글씨):

| 의미 | 틴트 / 잉크 | 용도 |
|---|---|---|
| info(blue) | `#eaf1ff` / `#0b54c4` | 공개 |
| success(green) | `#e7f6ec` / `#1a7f43` | 노출·완료·resolved |
| warning(amber) | `#fdf0d9` / `#9a6a12` | 비번·대기·pending |
| danger(red) | `#fdeaec` / `#c0334a` | 실패·파괴 |
| neutral(gray) | `#eef0f2` / `#4a525e` | 비공개·중립 |
| role(purple) | `#efe9fd` / `#6d3fcf` | 관리자 등 역할 |

> 파괴적 **버튼**의 강한 솔리드 레드(`--destructive #ee1d36`)는 유지. 위 danger 틴트는
> pill/소프트 버튼용.

### 3.2 라운드

| 토큰 | 값 | 적용 |
|---|---|---|
| control | **6px** | 버튼·입력·select·필터 칩·작은 컨트롤 |
| card | **8px** | 카드·패널·테이블 surface·팝오버·드롭다운·다이얼로그 |
| pill | **full** | status pill·아바타·원형 아이콘 버튼 |

원칙: 스튜디오 면에서 `rounded-xl/2xl/3xl/4xl` 임의 사용 금지 → 위 3단으로 흡수.
status pill은 full 허용(기존 "Pill CTA 금지"는 **CTA 버튼**에만 해당, 상태 칩은 예외).

### 3.3 타이포 (7단, weight 상한 600 유지)

| 토큰 | size / weight | 용도 |
|---|---|---|
| display | 21 / 600 / tracking -1% | 페이지 제목 |
| section | 16 / 600 | 섹션 제목 |
| subtitle | 14 / 600 | 카드·항목 제목 |
| body | 13 / 400 | 기본 본문·테이블 셀·설명 |
| body-strong | 13 / 600 | 강조 본문 |
| caption | 12 / 400~500 | 보조·메타·테이블 헤더 |
| eyebrow | 11 / 600 / uppercase / +6% | 아이브로 라벨 |
| mono | 11.5 / mono | ID·도메인 |

임의값(`text-[13px]` 등 21곳)·산발적 `text-*`를 이 7단으로 전부 흡수한다.

### 3.4 스페이싱·밀도

- 4px 베이스. 콘텐츠 거터 **24px**(현재 `px-8 py-7` → `px-6 py-6`로 통일).
- 컨트롤 높이 **32px**(버튼/입력/select 기본). 작은 변형 28px.
- 테이블 셀 **11px(상하) / 16px(좌우)**, 헤더 동일 좌우.
- 카드 패딩 16~20px. 툴바 gap 8px.

### 3.5 엘리베이션

- 기본 = **플랫 hairline**(보더만). 카드·테이블·패널에 그림자 없음(Linear 차분함).
- 그림자는 **팝오버·드롭다운·select·다이얼로그·토스트**에만(`shadow-sm`~`shadow-md`).
- 행/항목 hover = `bg-muted/60` 틴트(보더 변화 없음).

---

## 4. 테마 전환 메커니즘 (다크 → 라이트, `/studio`만)

1. `src/shared/lib/theme-routes.ts` — `DARK_ROUTE_PREFIXES`에서 `"/studio"` 제거.
   `/me`·`/pending`·`/plugin-auth`는 유지(다크). 로그인은 자체 스코프 다크라 영향 없음.
2. theme-routes.ts 주석이 언급하는 **anti-flash 인라인 스크립트 복제 목록**을 `grep`으로
   확인하고(현 `app/layout.tsx`엔 부재), 존재하면 동일하게 동기화. — **구현 시 검증 항목**.
3. 결과: `/studio/*`는 `.dark` 없이 라이트 토큰으로 렌더. 셸 컨테이너의 `bg-muted`가
   라이트 캔버스(`#f7f8f9`)가 된다.
4. **`/studio` 홈:** 프리픽스 매칭상 홈도 라이트가 된다. 레이아웃은 재구상하지 않되,
   다크 전용 스타일이 남아 라이트에서 깨지면 **최소 보정만** 한다(텍스트/배경 대비 등).

---

## 5. 토큰 스코핑 전략 (회귀 방지)

shadcn 토큰은 전역(`:root`)이라 그대로 바꾸면 홈/뷰어/인증까지 영향을 준다. 홈·뷰어는
이번 비목표이므로 **스튜디오 한정 변경은 `.studio-shell`에 스코프**한다.

- **전역 유지/소폭만:** `--primary #146ef5`(이미 블루, 불변), `--foreground` 잉크.
- **`.studio-shell` 스코프 오버라이드:** `--background`/`--card`/`--muted`/`--border`/
  `--input`/`--muted-foreground` 등 라이트-Linear 값 + 라운드/타이포 토큰. 셸 밖
  (뷰어/인증/홈)은 기존 값 유지.
- **primitive**는 토큰을 읽으므로 셸 안에서 자동으로 새 값을 따른다. 단, 현재
  하드코딩된 `rounded-xl` 등은 토큰 기반(`rounded-[var(--radius-card)]` 류)으로 교체해야
  스코프가 먹는다(§6).

> 트레이드오프: 일부 primitive(버튼 라운드 8→6 등)는 전역으로 바뀌어 뷰어/인증 버튼도
> 미세하게 영향받을 수 있다. 6px↔8px 차이는 무시 가능 수준으로 보고 **전역 허용**,
> 캔버스/헤어라인/밀도 등 체감 큰 항목만 스코프한다.

---

## 6. Primitive 리팩터 (`src/shared/ui/`)

API(컴포넌트 prop)는 **유지**한다. 내부 클래스만 토큰에 맞춘다(소비처 무변경).

| 파일 | 현재 문제 | 변경 |
|---|---|---|
| `button.tsx` | 기본 `rounded-lg`(8), size별 라운드 제각각 | control 라운드 **6px**로 통일, 사이즈 라운드 분기 제거, 높이 32 기준 정리 |
| `card.tsx` | `rounded-xl`(~11), `ring-foreground/10` | **8px** + hairline 보더, 패딩 스케일(16~20) |
| `badge.tsx` | `rounded-4xl`(~21, 거의 pill), 시맨틱 색 산발 | status는 **full**, 시맨틱 색을 §3.1 키트 팔레트로 정렬 |
| `input.tsx` | `rounded-lg`(8) | **6px**, 높이 32, 포커스 블루 링 |
| `select.tsx` | size별 높이(8/9/10) 제각각 | 기본 **32px**, 라운드 6, 트리거/팝업 토큰 정렬 |
| `table.tsx` | 헤더/셀 패딩이 페이지마다 `headCell`/`bodyCell`로 덧칠 | 헤더 caption·셀 body·hairline 행·hover 틴트를 기본값으로(§7 DataTable이 감쌈) |
| `tabs.tsx` | 세그먼트 토글이 페이지마다 커스텀 | SegmentedControl 변형(§7)로 표준화 |
| `dialog.tsx`·`dropdown-menu.tsx` | 라운드/그림자 산발 | card 라운드 8 + shadow-md(§3.5) 정렬 |
| `pagination.tsx` | — | 토큰 정렬(라운드/높이) |

타이포 토큰: Tailwind v4 `@theme`에 스튜디오 type 토큰(예 `--text-body: 13px` 등) 또는
소수의 시맨틱 유틸을 정의해 7단(§3.3)을 표준 클래스로 제공. 임의값 교체의 단일 출처.

---

## 7. 컴포지션 레시피 (신규/정형 공유 컴포넌트)

페이지가 직접 조립하던 패턴을 재사용 레시피로 끌어올린다. 위치:
`src/widgets/studio-shell/` 또는 `src/shared/ui/`(범용성에 따라).

| 레시피 | 역할 | 흡수 대상 |
|---|---|---|
| `PageHeader`(정형) | eyebrow + display 제목 + 설명 + 액션 슬롯 | 이미 존재 → 새 토큰으로 |
| `Toolbar` | 좌(세그먼트/뷰토글) · 검색 · 필터 · 우(카운트 + primary action) 한 줄 | 목록 페이지마다 흩어진 toolbar |
| `DataTable`(셸) | card surface + 헤더/행 스타일 + 로딩(skeleton)/빈/에러 상태 표준 | 페이지별 `headCell`/`bodyCell`/skeleton 반복 |
| `StatusPill` | 시맨틱 매핑(§3.1)을 prop로 받는 상태 칩 | 산발적 `Badge variant=...` 호출 정리 |
| `EmptyState` | 아이콘 + 메시지 + 액션의 빈/제로결과 블록 | 페이지마다 인라인 빈 상태 |
| `SegmentedControl` | 리스트/썸네일 등 뷰 토글 | proposals-list의 커스텀 Tabs 해킹 |
| `FilterControl` | 필터용 select/칩 표준 트리거 | 연도·공개여부 등 필터 |

각 레시피는 **하나의 역할 / 명확한 props / 독립 이해 가능**해야 한다(예: `Toolbar`는
children 슬롯만 받고 레이아웃·간격만 책임, 데이터는 모름).

---

## 8. 대표 화면 적용 — 시안 목록(`/studio/proposals`)

`src/pages/proposals-list/ui/proposals-list-page.tsx`(현 638줄)를 위 토대로 재구성:

- **레이아웃:** Refined Table(표 중심). 제목 셀에 공개ID(mono)를 서브텍스트로 묶고,
  참여자·연도·도메인·상태(StatusPill)·태깅(블루 도넛 ProgressRing)·수정일·⋯ 한 행.
- **툴바:** `SegmentedControl`(리스트/썸네일) · `SearchInput` · `FilterControl`(연도/공개여부)
  · 전체 N개 · `Button`(새 시안)을 `Toolbar` 레시피로.
- **테이블:** `DataTable` 셸로 교체. 로컬 `headCell`/`bodyCell`/`menuItem`·인라인 skeleton·
  빈/에러 상태를 레시피로 흡수.
- **썸네일 뷰:** 보조 뷰로 유지하되 카드 라운드 8·hairline·타이포 7단으로 정리.
- **공유 다이얼로그(시안 공유):** `Dialog` + `Input` 토큰 정렬.

검증 기준: 이 페이지에서 임의 `text-[..]`·혼용 `rounded-*`가 **0**이 되고, 모든 시각
요소가 토큰/primitive/레시피로만 구성된다.

---

## 9. 문서화 — `design-system.md` v3

`docs/design-system.md`에 **"v3 — Studio Linear-라이트 (2026-06-28)"** 절 추가(v2처럼 상위
규칙으로 갱신 표기). 포함: §3 토큰 contract, §6 primitive 규칙, §7 레시피 목록과 사용법,
라이트 전환 범위. `globals.css`의 `design-system §N` 주석 참조도 v3에 맞춰 갱신.

---

## 10. 마이그레이션(일관화) 방식

1. 토큰 레이어(globals.css `.studio-shell` 스코프 + type 토큰) 먼저.
2. primitive 리팩터(§6) — API 불변이라 소비처 컴파일 영향 없음.
3. 레시피 신설(§7).
4. 대표 화면(§8)을 레시피로 재구성하며 임의 클래스 제거.
5. 그 외 스튜디오 페이지는 **이번 spec에서 건드리지 않음** — 토대/레시피만 깔리고,
   실제 적용·재구상은 후속 spec에서. (단, primitive 변경으로 자동으로 일부 개선됨)

---

## 11. 검증 (verification)

- `pnpm/npm run build` + `lint` 통과.
- `/studio/proposals`가 라이트로 렌더(다크 클래스 미적용) — 수동 확인.
- 대표 화면에서 `grep -E "text-\[|rounded-(xl|2xl|3xl|4xl)"` 결과 0.
- 홈(`/`)·공개 뷰어(`/p`)·로그인 회귀 없음(스코프 덕분) — 수동 스폿 체크.
- 기존 vitest 통과(프레젠테이션 변경이므로 로직 테스트 영향 최소).

---

## 12. 범위 밖 / 후속 spec

각각 토대 위에서 IA/레이아웃 재구상(별도 spec → plan):

1. 시안 상세 `/studio/proposals/[id]`(+ `variant-tabs`, `section-nav`)
2. 시안 등록 `/studio/proposals/new`
3. AI 시안 생성 `/studio/ai-designs`(+ 생성 모달)
4. AI 시안 상세 `/studio/ai-designs/[id]`
5. AI 시안 설정 `/studio/ai-designs/settings`
6. 사용자 관리 `/studio/users`
7. 태그 설정 `/studio/tags`

추가 후속: `/me`·`/pending`·`/plugin-auth` 라이트 전환.

---

## 13. 변경 파일 맵 (예상)

- `src/app/styles/globals.css` — `.studio-shell` 스코프 토큰, type 토큰, 라운드 토큰.
- `src/shared/lib/theme-routes.ts` — `/studio` 다크 제거.
- `src/shared/ui/{button,card,badge,input,select,table,tabs,dialog,dropdown-menu,pagination}.tsx`
- `src/shared/ui/{status-pill,empty-state,segmented-control,filter-control}.tsx` — 신규(또는 적정 위치).
- `src/widgets/studio-shell/ui/{page-header,studio-shell,studio-sidebar}.tsx` — 토큰 정렬 + `Toolbar`/`DataTable` 신설 위치.
- `src/pages/proposals-list/ui/proposals-list-page.tsx` — 재구성.
- `docs/design-system.md` — v3 절.
