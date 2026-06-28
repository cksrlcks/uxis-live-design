# 스튜디오 디자인 시스템 — Linear-라이트 토대 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 스튜디오를 다크→라이트로 전환하고, Linear-라이트 톤의 토큰·primitive·레시피 시스템을 세운 뒤 대표 화면(시안 목록)에 적용해 검증한다.

**Architecture:** Tailwind v4 `@theme` 토큰 + `.studio-shell` 스코프 오버라이드로 스튜디오만 라이트-Linear 값을 적용(홈/뷰어/인증 무영향). shadcn primitive는 API 불변·내부 클래스만 토큰화. 페이지가 직접 조립하던 패턴은 공유 레시피(Toolbar/DataTable/StatusPill/EmptyState/SegmentedControl)로 추출. 순수 로직(테마 라우팅·tone 매핑)은 TDD, 시각 스타일은 build/lint/grep + 수동 검증.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS v4, `@base-ui/react`, class-variance-authority, vitest(node 환경, 순수 로직 테스트).

## Global Constraints

- 톤: **Linear 스타일(밀도·차분함·작은 라운드·절제 타이포) + 블루 포인트 `#146ef5` 유지**. Linear 보라 도입 금지.
- 라이트 전환은 **`/studio`만**. `/me`·`/pending`·`/plugin-auth`는 다크 유지, 로그인은 자체 다크 유지.
- 라운드 3단: **control 6px / card 8px / pill full**. 스튜디오 면에 `rounded-xl/2xl/3xl/4xl` 임의 사용 금지(status pill·아바타·원형 아이콘만 full).
- 타이포 7단: display 21/600 · section 16/600 · subtitle 14/600 · body 13/400 · body-strong 13/600 · caption 12 · eyebrow 11/uppercase. **weight 상한 600**(700+ 금지). 임의 `text-[..px]` 금지.
- 회귀 금지: 홈(`/`)·공개 뷰어(`/p`,`/chat`)·인증은 이번 작업으로 시각 변화가 없어야 한다(체감 큰 토큰은 `.studio-shell`에 스코프).
- primitive 컴포넌트 **API(prop) 불변** — 소비처 코드 변경 없이 스타일만 교체.
- 테스트: `import { describe, it, expect } from "vitest"` + `@/` 경로 import. node 환경. 순수 함수만 단위 테스트. RTL/jsdom 도입 금지.

---

## File Structure

**생성:**
- `src/shared/ui/status-pill/tone.ts` — 도메인 tone → Badge variant 순수 매핑.
- `src/shared/ui/status-pill/status-pill.tsx` — Badge 래퍼.
- `src/shared/ui/status-pill/index.ts` — 배럴.
- `src/shared/ui/segmented-control.tsx` — Tabs 기반 뷰 토글.
- `src/shared/ui/empty-state.tsx` — 빈/제로결과 블록.
- `src/shared/ui/data-table.tsx` — 테이블 카드 셸 + 표준 셀 클래스 + 상태 행.
- `src/widgets/studio-shell/ui/toolbar.tsx` — 목록 툴바 레이아웃.
- `tests/shared/theme-routes.test.ts` — 라이트 전환 가드.
- `tests/ui/status-pill.test.ts` — tone 매핑.

**수정:**
- `src/app/styles/globals.css` — `@theme` 라운드/타이포 토큰 + `.studio-shell` 스코프 토큰.
- `src/shared/lib/theme-routes.ts` — `/studio` 다크 제거.
- `src/shared/ui/{button,card,input,select,badge,dialog,dropdown-menu,pagination}.tsx` — 토큰 정렬.
- `src/widgets/studio-shell/ui/{page-header,studio-shell,studio-sidebar}.tsx` — 타이포 토큰·거터 정렬.
- `src/widgets/studio-shell/index.ts` — 신규 export.
- `src/pages/proposals-list/ui/proposals-list-page.tsx` — 레시피로 재구성.
- `docs/design-system.md` — v3 절.

---

## Task 1: 토큰 레이어 + 라이트 전환

**Files:**
- Modify: `src/app/styles/globals.css`
- Modify: `src/shared/lib/theme-routes.ts`
- Test: `tests/shared/theme-routes.test.ts`

**Interfaces:**
- Produces: Tailwind 유틸 `rounded-control`(6px)·`rounded-card`(8px)·`text-display`·`text-section`·`text-subtitle`·`text-body`·`text-caption`·`text-eyebrow`. `.studio-shell` 하위 요소의 `--background/--card/--muted/--muted-foreground/--accent/--border/--input/--ring` 라이트-Linear 값.
- Produces: `isDarkRoute(path)` — `/studio*`에 대해 `false`.

- [ ] **Step 1: 라이트 전환 가드 테스트 작성 (실패 확인용)**

Create `tests/shared/theme-routes.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isDarkRoute } from "@/shared/lib/theme-routes";

describe("isDarkRoute — 스튜디오는 라이트", () => {
  it("스튜디오 경로는 다크가 아니다", () => {
    expect(isDarkRoute("/studio")).toBe(false);
    expect(isDarkRoute("/studio/proposals")).toBe(false);
    expect(isDarkRoute("/studio/proposals/abc123")).toBe(false);
  });
  it("스튜디오 외 다크 면은 유지", () => {
    expect(isDarkRoute("/me")).toBe(true);
    expect(isDarkRoute("/pending")).toBe(true);
    expect(isDarkRoute("/plugin-auth")).toBe(true);
  });
  it("공개/라이트 면은 라이트", () => {
    expect(isDarkRoute("/")).toBe(false);
    expect(isDarkRoute("/p/abc")).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- theme-routes`
Expected: FAIL — `isDarkRoute("/studio")` 가 현재 `true` 를 반환.

- [ ] **Step 3: theme-routes 에서 `/studio` 제거**

In `src/shared/lib/theme-routes.ts`, 주석과 배열을 갱신:

```ts
// Single source of truth for which routes render in dark mode.
//
// The account/pending/plugin surfaces stay dark for now. The studio
// (/studio/*) renders LIGHT (Linear-light redesign, 2026-06-28). The public
// home (/) and viewer/chat (/p, /chat) stay light. Auth pages self-manage
// their own scoped `.dark` form treatment.
//
// NOTE: if an anti-flash inline script duplicates this list anywhere
// (app/layout.tsx 등), keep the two in sync.
export const DARK_ROUTE_PREFIXES = ["/me", "/pending", "/plugin-auth"];
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- theme-routes`
Expected: PASS (3 passed).

- [ ] **Step 5: anti-flash 복제 목록 점검**

Run: `grep -rn "DARK_ROUTE\|/studio.*dark\|classList.*dark" app/ src/app/ | grep -iv "test"`
Expected: theme-routes.ts 외에 `/studio` 를 다크로 하드코딩한 인라인 스크립트가 없음을 확인. 있으면 동일하게 `/studio` 제거.

- [ ] **Step 6: `@theme` 에 라운드·타이포 토큰 추가**

In `src/app/styles/globals.css`, `@theme inline { … }` 블록 안에서 `--radius-4xl: …;` 줄 바로 뒤(닫는 `}` 직전)에 추가:

```css
  /* Studio Linear-light — 라운드 3단 + 타이포 7단 (2026-06-28) */
  --radius-control: 6px;
  --radius-card: 8px;
  --text-display: 1.3125rem; /* 21px */
  --text-display--line-height: 1.3;
  --text-display--letter-spacing: -0.01em;
  --text-section: 1rem; /* 16px */
  --text-section--line-height: 1.4;
  --text-subtitle: 0.875rem; /* 14px */
  --text-subtitle--line-height: 1.4;
  --text-body: 0.8125rem; /* 13px */
  --text-body--line-height: 1.5;
  --text-caption: 0.75rem; /* 12px */
  --text-caption--line-height: 1.4;
  --text-eyebrow: 0.6875rem; /* 11px */
  --text-eyebrow--line-height: 1.3;
  --text-eyebrow--letter-spacing: 0.06em;
```

- [ ] **Step 7: `.studio-shell` 스코프 토큰 추가**

In `src/app/styles/globals.css`, `:root { … }` 블록이 닫힌 직후(`.dark { … }` 앞)에 추가:

```css
/* Studio surface — Linear-light. 스튜디오 셸에만 스코프해 홈/뷰어/인증(이번 비목표)은
   :root 값을 유지한다. 스튜디오는 라이트로 렌더(theme-routes.ts)되므로 라이트 :root 를
   덮어쓴다. 커스텀 프로퍼티는 상속되어 셸 하위 요소가 이 값을 따른다. */
.studio-shell {
  --background: #ffffff;
  --foreground: #08090a;
  --card: #ffffff;
  --card-foreground: #08090a;
  --popover: #ffffff;
  --popover-foreground: #08090a;
  --muted: #f7f8f9; /* 앱 캔버스 */
  --muted-foreground: #6b7280;
  --accent: #f1f3f5; /* hover 표면 — 캔버스보다 한 톤 진해 흰 카드 위에서도 보임 */
  --accent-foreground: #08090a;
  --secondary: #ffffff;
  --secondary-foreground: #08090a;
  --border: #e7e8ea; /* 헤어라인 */
  --input: #e7e8ea;
  --primary: #146ef5;
  --primary-foreground: #ffffff;
  --ring: #146ef5;
}
```

- [ ] **Step 8: 빌드 확인**

Run: `npm run build`
Expected: 성공. (Tailwind 가 `rounded-control`·`text-body` 등 유틸을 생성.)

- [ ] **Step 9: 커밋**

```bash
git add src/app/styles/globals.css src/shared/lib/theme-routes.ts tests/shared/theme-routes.test.ts
git commit -m "feat(studio): Linear-라이트 토큰 + /studio 라이트 전환"
```

---

## Task 2: 폼·면 primitive 토큰화 (button/card/input/select)

**Files:**
- Modify: `src/shared/ui/button.tsx`
- Modify: `src/shared/ui/card.tsx`
- Modify: `src/shared/ui/input.tsx`
- Modify: `src/shared/ui/select.tsx`

**Interfaces:**
- Consumes: `rounded-control`·`rounded-card` (Task 1).
- Produces: 컨트롤 라운드 6px·카드 라운드 8px로 통일된 primitive(API 불변).

- [ ] **Step 1: button 라운드 통일**

In `src/shared/ui/button.tsx`:
- base 문자열의 `rounded-lg` → `rounded-control`.
- size `xs`: `rounded-[min(var(--radius-md),10px)]` → `rounded-control`.
- size `sm`: `rounded-[min(var(--radius-md),12px)]` → `rounded-control`.
- size `icon-xs`: `rounded-[min(var(--radius-md),10px)]` → `rounded-control`.
- size `icon-sm`: `rounded-[min(var(--radius-md),12px)]` → `rounded-control`.
- `in-data-[slot=button-group]:rounded-lg` 조각은 그대로 둔다.

- [ ] **Step 2: card 라운드·보더 통일**

In `src/shared/ui/card.tsx`:
- `Card` base: `rounded-xl` → `rounded-card`; `ring-1 ring-foreground/10` → `border border-border`; `[--card-spacing:--spacing(6)]` → `[--card-spacing:--spacing(5)]`; `*:[img:first-child]:rounded-t-xl` → `rounded-t-card`, `*:[img:last-child]:rounded-b-xl` → `rounded-b-card`.
- `CardHeader`: `rounded-t-xl` → `rounded-t-card`.
- `CardFooter`: `rounded-b-xl` → `rounded-b-card`.

- [ ] **Step 3: input 라운드 통일**

In `src/shared/ui/input.tsx`: `rounded-lg` → `rounded-control`.

- [ ] **Step 4: select 높이·라운드 통일**

In `src/shared/ui/select.tsx`:
- `SelectTrigger`: `rounded-md` → `rounded-control`; `data-[size=default]:h-9` → `data-[size=default]:h-8`(32px 기준). sm/lg 는 유지.
- `SelectContent` popup: `rounded-lg` → `rounded-card`.
- `SelectItem`: `rounded-md` → `rounded-control`.

- [ ] **Step 5: 빌드·린트 확인**

Run: `npm run build && npm run lint`
Expected: 성공, 신규 경고 없음.

- [ ] **Step 6: 커밋**

```bash
git add src/shared/ui/button.tsx src/shared/ui/card.tsx src/shared/ui/input.tsx src/shared/ui/select.tsx
git commit -m "feat(ui): button/card/input/select 라운드 토큰 통일(6/8px)"
```

---

## Task 3: Badge 팔레트 정렬 + StatusPill 레시피

**Files:**
- Modify: `src/shared/ui/badge.tsx`
- Create: `src/shared/ui/status-pill/tone.ts`
- Create: `src/shared/ui/status-pill/status-pill.tsx`
- Create: `src/shared/ui/status-pill/index.ts`
- Test: `tests/ui/status-pill.test.ts`

**Interfaces:**
- Produces: `StatusTone = "info"|"success"|"warning"|"danger"|"neutral"|"role"`.
- Produces: `statusPillVariant(tone): "info"|"success"|"warning"|"error"|"neutral"|"purple"`.
- Produces: `<StatusPill tone={StatusTone}>{children}</StatusPill>`.

- [ ] **Step 1: Badge 팔레트·라운드·크기 정렬**

In `src/shared/ui/badge.tsx`:
- base 문자열: `rounded-4xl` → `rounded-full`; `px-2.5 py-1.5 text-xs` → `px-2 py-0.5 text-[11.5px] font-semibold`.
- 시맨틱 색 교체:
  - `info`: `bg-[#dbeafe] text-[#1d4ed8]` → `bg-[#eaf1ff] text-[#0b54c4]`
  - `success`: `bg-[#dcfce7] text-[#15803d]` → `bg-[#e7f6ec] text-[#1a7f43]`
  - `warning`: `bg-[#ffedd5] text-[#c2410c]` → `bg-[#fdf0d9] text-[#9a6a12]`
  - `error`: `bg-[#fee2e2] text-[#b91c1c]` → `bg-[#fdeaec] text-[#c0334a]`
  - `purple`: `bg-[#ede9fe] text-[#6d28d9]` → `bg-[#efe9fd] text-[#6d3fcf]`
  - `neutral`: `bg-[#e2e8f0] text-[#334155]` → `bg-[#eef0f2] text-[#4a525e]`

- [ ] **Step 2: tone 매핑 테스트 작성**

Create `tests/ui/status-pill.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { statusPillVariant } from "@/shared/ui/status-pill/tone";

describe("statusPillVariant — 도메인 tone → Badge variant", () => {
  it("통과 매핑", () => {
    expect(statusPillVariant("info")).toBe("info");
    expect(statusPillVariant("success")).toBe("success");
    expect(statusPillVariant("warning")).toBe("warning");
    expect(statusPillVariant("neutral")).toBe("neutral");
  });
  it("이름이 다른 매핑", () => {
    expect(statusPillVariant("danger")).toBe("error");
    expect(statusPillVariant("role")).toBe("purple");
  });
});
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `npm test -- status-pill`
Expected: FAIL — 모듈 없음.

- [ ] **Step 4: tone.ts 구현**

Create `src/shared/ui/status-pill/tone.ts`:

```ts
export type StatusTone = "info" | "success" | "warning" | "danger" | "neutral" | "role";
export type StatusBadgeVariant = "info" | "success" | "warning" | "error" | "neutral" | "purple";

/** 도메인 의미(tone)를 Badge 의 내부 variant 이름으로 매핑한다. */
export function statusPillVariant(tone: StatusTone): StatusBadgeVariant {
  switch (tone) {
    case "danger":
      return "error";
    case "role":
      return "purple";
    default:
      return tone;
  }
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm test -- status-pill`
Expected: PASS.

- [ ] **Step 6: StatusPill 컴포넌트 + 배럴**

Create `src/shared/ui/status-pill/status-pill.tsx`:

```tsx
import type { ReactNode } from "react";
import { Badge } from "@/shared/ui/badge";
import { statusPillVariant, type StatusTone } from "./tone";

export function StatusPill({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  return <Badge variant={statusPillVariant(tone)}>{children}</Badge>;
}
```

Create `src/shared/ui/status-pill/index.ts`:

```ts
export { StatusPill } from "./status-pill";
export { statusPillVariant, type StatusTone } from "./tone";
```

- [ ] **Step 7: 빌드 확인**

Run: `npm run build`
Expected: 성공.

- [ ] **Step 8: 커밋**

```bash
git add src/shared/ui/badge.tsx src/shared/ui/status-pill/ tests/ui/status-pill.test.ts
git commit -m "feat(ui): Badge 팔레트 정렬 + StatusPill 레시피"
```

---

## Task 4: 레이아웃 레시피 (Toolbar · SegmentedControl · EmptyState · DataTable)

**Files:**
- Create: `src/widgets/studio-shell/ui/toolbar.tsx`
- Create: `src/shared/ui/segmented-control.tsx`
- Create: `src/shared/ui/empty-state.tsx`
- Create: `src/shared/ui/data-table.tsx`
- Modify: `src/widgets/studio-shell/index.ts`

**Interfaces:**
- Produces: `<Toolbar trailing={ReactNode}>{children}</Toolbar>`.
- Produces: `<SegmentedControl value options={{value,label,icon?}[]} onValueChange />`.
- Produces: `<EmptyState icon? title description? action? />`.
- Produces: `<DataTableShell>{children}</DataTableShell>`, `dataHeadCell`/`dataBodyCell`(string), `<DataTableState colSpan>{children}</DataTableState>`.

- [ ] **Step 1: Toolbar**

Create `src/widgets/studio-shell/ui/toolbar.tsx`:

```tsx
import type { ReactNode } from "react";

/** 목록 페이지 상단 컨트롤 줄: 좌측 슬롯(children) + 우측 정렬(trailing). */
export function Toolbar({ children, trailing }: { children: ReactNode; trailing?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      {children}
      {trailing && <div className="ml-auto flex items-center gap-2">{trailing}</div>}
    </div>
  );
}
```

- [ ] **Step 2: SegmentedControl**

Create `src/shared/ui/segmented-control.tsx`:

```tsx
"use client";

import type { LucideIcon } from "lucide-react";
import { Tabs, TabsList, TabsTab } from "@/shared/ui/tabs";

type Option<T extends string> = { value: T; label: string; icon?: LucideIcon };

/** 뷰 토글용 세그먼트 컨트롤. Tabs 위에 표준 스타일을 입힌다. */
export function SegmentedControl<T extends string>({
  value,
  options,
  onValueChange,
}: {
  value: T;
  options: Option<T>[];
  onValueChange: (value: T) => void;
}) {
  return (
    <Tabs value={value} onValueChange={(v) => onValueChange(v as T)}>
      <TabsList>
        {options.map((opt) => {
          const Icon = opt.icon;
          return (
            <TabsTab key={opt.value} value={opt.value}>
              {Icon && <Icon aria-hidden />}
              {opt.label}
            </TabsTab>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
```

- [ ] **Step 3: EmptyState**

Create `src/shared/ui/empty-state.tsx`:

```tsx
import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

/** 빈/제로결과 표준 블록. 테이블 상태 행, 카드 그리드 빈 상태 공용. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 px-6 py-16 text-center", className)}>
      {icon && <div className="text-muted-foreground/50 [&_svg]:size-8">{icon}</div>}
      <div className="space-y-1">
        <p className="text-subtitle text-foreground">{title}</p>
        {description && <p className="text-body text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
```

- [ ] **Step 4: DataTable 셸 + 표준 셀**

Create `src/shared/ui/data-table.tsx`:

```tsx
import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";
import { TableCell, TableRow } from "@/shared/ui/table";

/** 테이블을 감싸는 카드 표면(흰 면 + 헤어라인 + 8px). */
export function DataTableShell({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("bg-card overflow-hidden rounded-card border", className)}>{children}</div>
  );
}

/** 표준 헤더/본문 셀 클래스 — 페이지별 headCell/bodyCell 중복을 대체. */
export const dataHeadCell = "text-muted-foreground h-9 px-4 text-caption font-medium";
export const dataBodyCell = "px-4 py-2.5 align-middle text-body";

/** 로딩/빈/에러용 전열 상태 행. */
export function DataTableState({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="px-4 py-16 text-center">
        {children}
      </TableCell>
    </TableRow>
  );
}
```

- [ ] **Step 5: 배럴 export 추가**

In `src/widgets/studio-shell/index.ts`, 기존 export에 더해 `Toolbar` 를 내보낸다:

```ts
export { Toolbar } from "./ui/toolbar";
```

(SegmentedControl·EmptyState·DataTable* 은 `@/shared/ui/...` 에서 직접 import.)

- [ ] **Step 6: 빌드 확인**

Run: `npm run build`
Expected: 성공.

- [ ] **Step 7: 커밋**

```bash
git add src/widgets/studio-shell/ui/toolbar.tsx src/widgets/studio-shell/index.ts src/shared/ui/segmented-control.tsx src/shared/ui/empty-state.tsx src/shared/ui/data-table.tsx
git commit -m "feat(studio): 레이아웃 레시피 Toolbar/SegmentedControl/EmptyState/DataTable"
```

---

## Task 5: 셸·헤더 chrome 정렬 (page-header / studio-shell / sidebar)

**Files:**
- Modify: `src/widgets/studio-shell/ui/page-header.tsx`
- Modify: `src/widgets/studio-shell/ui/studio-shell.tsx`
- Modify: `src/widgets/studio-shell/ui/studio-sidebar.tsx`

**Interfaces:**
- Consumes: `text-display`/`text-eyebrow`/`text-body` (Task 1).

- [ ] **Step 1: PageHeader 타이포 토큰화**

In `src/widgets/studio-shell/ui/page-header.tsx`:
- eyebrow `<p>`: `text-xs font-medium tracking-[0.08em] uppercase` → `text-eyebrow font-semibold uppercase`.
- 제목 `<h1>`: `text-2xl font-semibold tracking-tight` → `text-display font-semibold`.
- description `<p>`: `text-sm` → `text-body`.
- 목록으로 링크·뒤로가기: `text-sm` → `text-body` 유지(라운드 영향 없음).

- [ ] **Step 2: 셸 거터 통일**

In `src/widgets/studio-shell/ui/studio-shell.tsx`: `<main>` 의 `px-8 py-7` → `px-6 py-6`. `studio-shell` 클래스와 `bg-muted` 는 유지(Task 1 스코프 토큰이 적용됨).

- [ ] **Step 3: 사이드바 라운드·타이포 정렬**

In `src/widgets/studio-shell/ui/studio-sidebar.tsx`:
- 네비 링크: `rounded-lg` → `rounded-control`, `text-sm` 유지.
- 액티브: `bg-primary/10 text-primary` 유지(블루 틴트). 좌측 인디케이터(`before:`)도 유지.
- 워크스페이스 마크 링크·홈으로 링크: `rounded-lg` → `rounded-control`.
- 유저 푸터 카드: `rounded-xl` → `rounded-card`; 내부 링크 `rounded-lg` → `rounded-control`.

- [ ] **Step 4: 빌드·린트 확인**

Run: `npm run build && npm run lint`
Expected: 성공.

- [ ] **Step 5: 커밋**

```bash
git add src/widgets/studio-shell/ui/page-header.tsx src/widgets/studio-shell/ui/studio-shell.tsx src/widgets/studio-shell/ui/studio-sidebar.tsx
git commit -m "feat(studio): 셸·헤더 타이포/라운드 토큰 정렬"
```

---

## Task 6: 팝오버·오버플로 primitive 라운드 정렬 (dialog/dropdown/pagination)

**Files:**
- Modify: `src/shared/ui/dialog.tsx`
- Modify: `src/shared/ui/dropdown-menu.tsx`
- Modify: `src/shared/ui/pagination.tsx`

**규칙(매핑):** 팝업/모달/메뉴 **표면** = `rounded-card`(8px); 메뉴 **항목**·페이지 버튼 등 **컨트롤** = `rounded-control`(6px). 임의 `rounded-xl/2xl/3xl/4xl` 제거.

- [ ] **Step 1: 현재 라운드 위치 확인**

Run: `grep -nE "rounded-(sm|md|lg|xl|2xl|3xl|4xl)" src/shared/ui/dialog.tsx src/shared/ui/dropdown-menu.tsx src/shared/ui/pagination.tsx`
Expected: 교체 대상 목록 확보.

- [ ] **Step 2: dialog 정렬**

In `src/shared/ui/dialog.tsx`: 다이얼로그 **콘텐츠 표면**의 라운드(`rounded-lg`/`rounded-xl` 등) → `rounded-card`. 닫기 버튼 등 작은 컨트롤이 `rounded-sm/md` 면 → `rounded-control`.

- [ ] **Step 3: dropdown-menu 정렬**

In `src/shared/ui/dropdown-menu.tsx`: **콘텐츠/서브콘텐츠 표면** → `rounded-card`; **아이템**(`rounded-sm`/`rounded-md`) → `rounded-control`.

- [ ] **Step 4: pagination 정렬**

In `src/shared/ui/pagination.tsx`: 페이지 링크/버튼 라운드 → `rounded-control`(아이콘 원형이면 `rounded-full` 유지).

- [ ] **Step 5: 빌드 확인 + 잔여 임의 라운드 0**

Run: `npm run build && grep -nE "rounded-(xl|2xl|3xl|4xl)" src/shared/ui/dialog.tsx src/shared/ui/dropdown-menu.tsx src/shared/ui/pagination.tsx`
Expected: 빌드 성공, grep 결과 0줄.

- [ ] **Step 6: 커밋**

```bash
git add src/shared/ui/dialog.tsx src/shared/ui/dropdown-menu.tsx src/shared/ui/pagination.tsx
git commit -m "feat(ui): 팝오버/오버플로 primitive 라운드 정렬"
```

---

## Task 7: 대표 화면 재구성 — 시안 목록

**Files:**
- Modify: `src/pages/proposals-list/ui/proposals-list-page.tsx`

**Interfaces:**
- Consumes: `Toolbar`(@/widgets/studio-shell), `SegmentedControl`·`EmptyState`·`StatusPill`·`DataTableShell`·`dataHeadCell`·`dataBodyCell`·`DataTableState`(@/shared/ui).

- [ ] **Step 1: import 정리 + 로컬 클래스 제거**

상단 import에 추가:

```ts
import { LayoutGrid, List } from "lucide-react"; // 기존 import에 이미 있으면 중복 추가 금지
import { Toolbar, PageHeader } from "@/widgets/studio-shell";
import { SegmentedControl } from "@/shared/ui/segmented-control";
import { EmptyState } from "@/shared/ui/empty-state";
import { StatusPill } from "@/shared/ui/status-pill";
import { DataTableShell, DataTableState, dataHeadCell, dataBodyCell } from "@/shared/ui/data-table";
```

로컬 상수 삭제:

```ts
// 삭제: const headCell = "...";  const bodyCell = "...";
// menuItem 는 드롭다운 항목 패딩용 — 유지 가능(라운드/타이포 무관).
```

기존 코드의 `headCell` → `dataHeadCell`, `bodyCell` → `dataBodyCell` 로 전부 치환.

- [ ] **Step 2: ViewToggle → SegmentedControl 교체**

`ViewToggle` 로컬 컴포넌트와 `viewTabClass` 를 삭제하고, 사용처를 표준 컨트롤로:

```tsx
<SegmentedControl
  value={view}
  onValueChange={(v) => setView(v)}
  options={[
    { value: "list", label: "리스트", icon: List },
    { value: "thumb", label: "썸네일", icon: LayoutGrid },
  ]}
/>
```

- [ ] **Step 3: 툴바를 Toolbar 레시피로**

기존 `<div className="mb-3 flex items-center gap-3"> … </div>` 전체를 교체:

```tsx
<Toolbar
  trailing={total > 0 ? <span className="text-caption text-muted-foreground">전체 {total}개</span> : undefined}
>
  <SegmentedControl
    value={view}
    onValueChange={(v) => setView(v)}
    options={[
      { value: "list", label: "리스트", icon: List },
      { value: "thumb", label: "썸네일", icon: LayoutGrid },
    ]}
  />
  <div className="bg-border h-5 w-px shrink-0" aria-hidden />
  <SearchInput value={q} onChange={onSearch} placeholder="제목·참여자·도메인 검색" className="w-full max-w-xs" />
  <Select<number | null> value={yearFilter} onValueChange={(v) => onYearChange(v)}>
    <SelectTrigger size="default" className="w-32 shadow-none">
      <SelectValue>{(v) => (v == null ? "전체 연도" : `${v}년`)}</SelectValue>
    </SelectTrigger>
    <SelectContent>
      <SelectItem value={null}>전체 연도</SelectItem>
      {YEAR_OPTIONS.map((y) => (
        <SelectItem key={y} value={y}>{y}년</SelectItem>
      ))}
    </SelectContent>
  </Select>
  <Select<string | null> value={visFilter} onValueChange={(v) => onVisChange(v)}>
    <SelectTrigger size="default" className="w-32 shadow-none">
      <SelectValue>{(v) => (v === "public" ? "공개" : v === "private" ? "비공개" : "공개+비공개")}</SelectValue>
    </SelectTrigger>
    <SelectContent>
      <SelectItem value={null}>공개+비공개</SelectItem>
      <SelectItem value="public">공개</SelectItem>
      <SelectItem value="private">비공개</SelectItem>
    </SelectContent>
  </Select>
</Toolbar>
```

> 참고: `NewProposalDialog` 는 PageHeader 의 `actions` 슬롯에 이미 있다(중복 배치 금지).

- [ ] **Step 4: 테이블 표면·상태 행 표준화**

`view === "list"` 블록의 컨테이너 `<div className="bg-card overflow-hidden rounded-xl border">` → `<DataTableShell>` 로 교체(닫는 `</div>` → `</DataTableShell>`).

로딩/에러/빈 상태의 `<TableRow><TableCell colSpan={COL_COUNT} …>` 래퍼를 `<DataTableState colSpan={COL_COUNT}>…</DataTableState>` 로 교체. 빈 상태 본문은 EmptyState 사용:

```tsx
<DataTableState colSpan={COL_COUNT}>
  {q || yearFilter || visFilter ? (
    <p className="text-body text-muted-foreground">검색 결과가 없습니다.</p>
  ) : (
    <EmptyState title="아직 시안이 없습니다" action={<NewProposalDialog />} />
  )}
</DataTableState>
```

- [ ] **Step 5: 상태 셀을 StatusPill 로**

상태 칸의 `<Badge variant={isPublic ? "info" : "neutral"}>` 등을 도메인 tone 으로:

```tsx
<div className="flex flex-wrap items-center gap-1.5">
  <StatusPill tone={isPublic ? "info" : "neutral"}>{isPublic ? "공개" : "비공개"}</StatusPill>
  {hasPassword && <StatusPill tone="warning">비번</StatusPill>}
  {p.exposedToUxisworks && <StatusPill tone="success">노출</StatusPill>}
</div>
```

썸네일 뷰의 상태 배지도 동일하게 `StatusPill` 로 교체. (기존 `Badge variant="purple"` 비번 → `tone="warning"` 로 통일: 비번=warning/amber.)

- [ ] **Step 6: 잔여 임의 라운드/타이포 제거**

썸네일 카드·공유 다이얼로그 등에서 `rounded-xl` → `rounded-card`, `rounded-lg`(카드 표면) → `rounded-card`(컨트롤/버튼은 `rounded-control`), `text-[..px]`·산발 `text-xs`(메타) → `text-caption`, 제목 `font-semibold` 유지. 아바타/원형 아이콘 버튼의 `rounded-full` 은 유지.

Run: `grep -nE "text-\[[0-9]|rounded-(xl|2xl|3xl|4xl)" src/pages/proposals-list/ui/proposals-list-page.tsx`
Expected: **0줄**.

- [ ] **Step 7: 빌드·린트·테스트**

Run: `npm run build && npm run lint && npm test`
Expected: 모두 성공.

- [ ] **Step 8: 커밋**

```bash
git add src/pages/proposals-list/ui/proposals-list-page.tsx
git commit -m "feat(studio): 시안 목록을 레시피 기반 Refined Table 로 재구성"
```

---

## Task 8: 문서화 — design-system.md v3

**Files:**
- Modify: `docs/design-system.md`

- [ ] **Step 1: v3 절 추가**

`docs/design-system.md` 상단(v2 절 위 또는 아래, v2 처럼 "상위 규칙으로 갱신" 표기)에 추가:

```markdown
## v3 — Studio Linear-라이트 (2026-06-28, 스튜디오 한정으로 v2 표면 규칙 갱신)

> 스튜디오(`/studio`) 전용. 홈/뷰어/인증은 v1/v2 유지. 스튜디오는 **다크→라이트** 전환.

- **테마:** `/studio` 라이트. `--*` 토큰은 `.studio-shell` 에 스코프(globals.css)해 비스튜디오 면 무영향. `/me`·`/pending`·`/plugin-auth` 는 다크 유지.
- **포인트색:** 블루 `#146ef5` 유지(Linear 보라 아님).
- **표면 2계층:** 캔버스 `#f7f8f9` + 흰 카드(`#ffffff`) + 헤어라인 `#e7e8ea`. 그림자는 팝오버/모달만(플랫).
- **라운드 3단:** control 6px(`rounded-control`) · card 8px(`rounded-card`) · pill full(상태칩/아바타/원형아이콘). 임의 `rounded-xl~4xl` 금지.
- **타이포 7단(상한 600):** display 21/600 · section 16/600 · subtitle 14/600 · body 13/400 · body-strong 13/600 · caption 12 · eyebrow 11/UP. Tailwind 유틸 `text-display/section/subtitle/body/caption/eyebrow`.
- **status pill:** info=블루 · success=그린 · warning=앰버 · danger=레드 · neutral=그레이 · role=퍼플. `StatusPill tone=…`.
- **레시피:** `PageHeader`·`Toolbar`·`SegmentedControl`·`DataTableShell`(+`dataHeadCell`/`dataBodyCell`/`DataTableState`)·`EmptyState`·`StatusPill`. 페이지는 이들을 조립한다.
- **검증 화면:** 시안 목록(`/studio/proposals`).
```

`globals.css` 의 `design-system §N` 참조 주석이 있으면 v3에 맞춰 한 줄 갱신.

- [ ] **Step 2: 커밋**

```bash
git add docs/design-system.md
git commit -m "docs: design-system v3 — Studio Linear-라이트"
```

---

## Task 9: 최종 검증

**Files:** 없음(검증만).

- [ ] **Step 1: 전체 빌드·린트·테스트·포맷**

Run: `npm run build && npm run lint && npm test && npm run format:check`
Expected: 모두 성공. (format:check 실패 시 `npm run format` 후 재확인·커밋.)

- [ ] **Step 2: 대표 화면 임의값 0 확인**

Run: `grep -nE "text-\[[0-9]|rounded-(xl|2xl|3xl|4xl)" src/pages/proposals-list/ui/proposals-list-page.tsx`
Expected: 0줄.

- [ ] **Step 3: 라이트 렌더 수동 확인**

`npm run dev` 후 `/studio/proposals` 진입 — `.dark` 미적용(라이트), 옅은 그레이 캔버스 + 흰 카드 + 블루 포인트, 툴바/테이블/상태칩이 시안대로인지 확인. 시안 파일: `.superpowers/brainstorm/12060-1782626604/content/{shell,flagship,kit}.html`.

- [ ] **Step 4: 회귀 스폿 체크**

`/`(홈), `/p/<공개시안>`(뷰어), `/login` 진입 — 시각 변화 없음 확인(스코프 덕분). `/me`·`/pending` 다크 유지 확인.

- [ ] **Step 5: 최종 커밋(있으면)**

```bash
git add -A && git commit -m "chore(studio): 디자인 토대 최종 검증·포맷" || echo "변경 없음"
```

---

## Self-Review 결과

- **Spec coverage:** §3 토큰→Task1·2·3·6, §4 라이트전환→Task1, §5 스코핑→Task1(.studio-shell), §6 primitive→Task2·3·5·6, §7 레시피→Task3·4·5, §8 대표화면→Task7, §9 문서→Task8, §11 검증→Task9. 누락 없음.
- **FilterControl(spec §7):** 별도 컴포넌트 대신 `Select size="default"` 표준 사용으로 실현(YAGNI). 문서 v3 레시피 목록에서 제외 — 의도된 트림.
- **알려진 사소 항목:** body로 portal 되는 팝오버는 `:root` 토큰(헤어라인 `#d8d8d8`)을 쓰므로 스튜디오 헤어라인(`#e7e8ea`)과 미세 차이. 체감 무시 수준이라 전역 변경하지 않음(회귀 방지 우선).
- **Type consistency:** `StatusTone`/`statusPillVariant`/`DataTableShell`/`dataHeadCell`/`dataBodyCell`/`DataTableState`/`Toolbar`/`SegmentedControl`/`EmptyState` 명칭이 정의(Task3·4)와 사용(Task7)에서 일치.
