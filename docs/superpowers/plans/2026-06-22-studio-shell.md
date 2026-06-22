# 스튜디오 셸 리디자인 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모든 `/studio/*` 화면이 공유하는 셸을 GitGuardian 풍 대시보드(확장 사이드바 + 그레이 2계층 캔버스 + 브레드크럼 상단바 + 재사용 PageHeader)로 교체한다.

**Architecture:** 신규 FSD 위젯 `src/widgets/studio-shell` 에 셸 프레임·사이드바·상단바·PageHeader·네비 단일출처(nav-config)를 만들고, `app/studio/layout.tsx`(서버, 인증 가드)가 이 셸로 children 을 감싼다. 활성 상태·브레드크럼은 클라이언트 컴포넌트가 `usePathname`으로 도출하되, 매칭 로직은 순수 함수로 분리해 단위 테스트한다. 그레이 캔버스는 셸 컨테이너 className 에만 적용 — 전역 `--background`는 불변(뷰어/인증 회귀 0).

**Tech Stack:** Next.js 16 (App Router) · React 19 · Tailwind v4 · lucide-react · vitest(node env) · FSD 레이어링.

## Global Constraints

- **패키지 매니저 npm** (`package-lock.json`). 명령은 `npm run …` / `npx …`.
- **"이건 당신이 아는 Next.js가 아니다"(AGENTS.md):** Next API(`Link`, `redirect`, `usePathname` 등)를 쓰기 전 `node_modules/next/dist/docs/` 의 해당 가이드를 확인. (본 플랜은 `usePathname`이 `next/navigation`에서 표준 동작 — pathname 문자열 반환, 클라이언트 전용 — 임을 이미 확인했다.)
- **경로 alias** `@/*` → `src/*`, `@drizzle/*` → `drizzle/*`.
- **폰트 weight 상한 600.** `font-bold`/700+ 금지(`font-medium`/`font-semibold`까지).
- **전역 `--background`(흰색) 불변.** 그레이 앱 캔버스는 셸 컨테이너에만(`bg-muted`). 공개 뷰어·인증·`/pending`은 시각 변화 0.
- **라운드:** 버튼/입력 4px, 카드/패널 8px(`rounded-lg`).
- **색 토큰 사용**(하드코딩 hex 지양): 블루 주색 `bg-primary`/`text-primary`, 액티브 틴트 `bg-primary/10`, 캔버스 `bg-muted`, 카드 `bg-card`.
- **테스트 관례:** vitest `environment: "node"` — DOM 없음. **순수 로직만 단위 테스트**(기존 `tests/**` 전부 그러함). 비주얼 컴포넌트는 `npx tsc --noEmit` + `npm run lint` + `npm run build` + 런타임 육안 확인으로 검증한다. **testing-library/jsdom 도입은 범위 밖**(스펙에 없음).
- **자주 커밋.** 작업당 1커밋. 커밋 푸시는 사용자 요청 시에만.

---

## File Structure

| 파일 | 책임 |
|------|------|
| `src/widgets/studio-shell/model/nav-config.ts` (신규) | 네비 항목 단일 출처 + `matchNav`/`visibleNavItems` 순수 함수 |
| `src/widgets/studio-shell/ui/page-header.tsx` (신규) | 재사용 페이지 헤더(아이브로우/제목/설명/액션) |
| `src/widgets/studio-shell/ui/studio-sidebar.tsx` (신규, client) | 워크스페이스 마크 · 네비(액티브) · 유저 푸터 |
| `src/widgets/studio-shell/ui/studio-topbar.tsx` (신규, client) | 브레드크럼 + 우측 슬롯 |
| `src/widgets/studio-shell/ui/studio-shell.tsx` (신규, server) | 셸 프레임(그리드 + 그레이 캔버스) |
| `src/widgets/studio-shell/index.ts` (신규) | 배럴(`StudioShell`, `PageHeader`) |
| `app/studio/layout.tsx` (수정) | 베어 사이드바 제거 → `StudioShell`로 교체 |
| `src/pages/proposals-list/ui/proposals-list-page.tsx` (수정) | `PageHeader` + 흰 카드 surface |
| `src/pages/admin-users/ui/admin-users-page.tsx` (수정) | `PageHeader` + 흰 카드 surface + 역할 `neutral` 뱃지 |
| `tests/widgets/studio-shell/nav-config.test.ts` (신규) | nav-config 순수 로직 테스트 |
| `docs/design-system.md` (수정) | v2 셸 확정 값 기입 |

---

## Task 1: 네비 단일출처 + 매칭 로직 (TDD)

**Files:**
- Create: `src/widgets/studio-shell/model/nav-config.ts`
- Test: `tests/widgets/studio-shell/nav-config.test.ts`

**Interfaces:**
- Consumes: `isAdmin`, `Role` from `@/shared/auth/roles`.
- Produces:
  - `type NavItem = { href: string; label: string; icon: LucideIcon; adminOnly?: boolean }`
  - `NAV_ITEMS: NavItem[]`
  - `matchNav(pathname: string): NavItem | undefined`
  - `visibleNavItems(role: Role): NavItem[]`

- [ ] **Step 1: Write the failing test**

Create `tests/widgets/studio-shell/nav-config.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { matchNav, visibleNavItems, NAV_ITEMS } from "@/widgets/studio-shell/model/nav-config";

describe("nav-config", () => {
  it("matchNav: 섹션 루트 정확 일치", () => {
    expect(matchNav("/studio/proposals")?.label).toBe("시안");
    expect(matchNav("/studio/users")?.label).toBe("사용자 관리");
  });

  it("matchNav: 하위 경로도 같은 섹션 활성", () => {
    expect(matchNav("/studio/proposals/abc123")?.label).toBe("시안");
    expect(matchNav("/studio/proposals/new")?.label).toBe("시안");
  });

  it("matchNav: 알 수 없는 경로 → undefined", () => {
    expect(matchNav("/studio/unknown")).toBeUndefined();
  });

  it("matchNav: 접두만 같고 세그먼트가 다르면 매칭 안 함", () => {
    // '/studio/proposalsX'는 '/studio/proposals' 섹션이 아니다
    expect(matchNav("/studio/proposalsX")).toBeUndefined();
  });

  it("visibleNavItems: editor는 admin 전용 항목을 숨김", () => {
    const labels = visibleNavItems("editor").map((i) => i.label);
    expect(labels).toContain("시안");
    expect(labels).not.toContain("사용자 관리");
  });

  it("visibleNavItems: admin은 모든 항목을 봄", () => {
    expect(visibleNavItems("admin")).toHaveLength(NAV_ITEMS.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- nav-config`
Expected: FAIL — `Failed to resolve import "@/widgets/studio-shell/model/nav-config"` (파일 없음).

- [ ] **Step 3: Write minimal implementation**

Create `src/widgets/studio-shell/model/nav-config.ts`:

```ts
import { Layers, Users, type LucideIcon } from "lucide-react";
import { isAdmin, type Role } from "@/shared/auth/roles";

export type NavItem = {
  href: string; // 섹션 루트
  label: string; // 사이드바 라벨 + 브레드크럼 섹션명
  icon: LucideIcon;
  adminOnly?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/studio/proposals", label: "시안", icon: Layers },
  { href: "/studio/users", label: "사용자 관리", icon: Users, adminOnly: true },
];

/** 현재 경로의 네비 항목. 정확히 일치하거나 하위 경로(`href + "/"`)면 활성. */
export function matchNav(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/"),
  );
}

/** 역할에 따라 노출할 항목(adminOnly 항목은 admin에게만). */
export function visibleNavItems(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin(role));
}
```

> 만약 이 lucide-react 버전이 `LucideIcon` 타입을 export 하지 않아 타입 에러가 나면, 그 import 를 지우고
> `import type { ComponentType, SVGProps } from "react"` 후 `icon: ComponentType<SVGProps<SVGSVGElement>>` 로 교체한다.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- nav-config`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/widgets/studio-shell/model/nav-config.ts tests/widgets/studio-shell/nav-config.test.ts
git commit -m "feat(studio-shell): nav config single-source + matchNav/visibleNavItems"
```

---

## Task 2: PageHeader 컴포넌트

**Files:**
- Create: `src/widgets/studio-shell/ui/page-header.tsx`

**Interfaces:**
- Produces: `PageHeader(props: { eyebrow?: string; title: string; description?: ReactNode; actions?: ReactNode })`. 훅 없음 → 서버/클라이언트 양쪽에서 사용 가능.

- [ ] **Step 1: Write the component**

Create `src/widgets/studio-shell/ui/page-header.tsx`:

```tsx
import type { ReactNode } from "react";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
};

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        {eyebrow && (
          <p className="text-muted-foreground mb-1 text-xs font-medium tracking-[0.08em] uppercase">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-medium tracking-tight">{title}</h1>
        {description && <p className="text-muted-foreground mt-1 text-sm">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (에러 없음).

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: PASS (새 파일 경고/에러 없음).

- [ ] **Step 4: Commit**

```bash
git add src/widgets/studio-shell/ui/page-header.tsx
git commit -m "feat(studio-shell): reusable PageHeader (eyebrow/title/description/actions)"
```

---

## Task 3: StudioSidebar (client)

**Files:**
- Create: `src/widgets/studio-shell/ui/studio-sidebar.tsx`

**Interfaces:**
- Consumes: `matchNav`, `visibleNavItems` from `../model/nav-config`; `usePathname` from `next/navigation`; `LogoutButton` from `@/features/auth`; `cn` from `@/shared/lib/utils`; `Role` from `@/shared/auth/roles`.
- Produces: `StudioSidebar(props: { displayName: string | null; email: string; role: Role })`.

- [ ] **Step 1: Write the component**

Create `src/widgets/studio-shell/ui/studio-sidebar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/features/auth";
import { type Role } from "@/shared/auth/roles";
import { cn } from "@/shared/lib/utils";
import { matchNav, visibleNavItems } from "../model/nav-config";

type StudioSidebarProps = {
  displayName: string | null;
  email: string;
  role: Role;
};

export function StudioSidebar({ displayName, email, role }: StudioSidebarProps) {
  const pathname = usePathname();
  const active = matchNav(pathname);
  const items = visibleNavItems(role);
  const name = displayName ?? "사용자";
  const initial = (displayName ?? email).charAt(0).toUpperCase();

  return (
    <aside className="bg-background flex w-56 shrink-0 flex-col border-r p-3">
      {/* 워크스페이스 마크 — 단일 워크스페이스라 비기능(스위처는 후속). /studio 로 이동. */}
      <Link
        href="/studio"
        className="hover:bg-muted flex items-center gap-2.5 rounded-lg border p-2 transition-colors"
      >
        <span className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md text-sm font-medium">
          U
        </span>
        <span className="leading-tight">
          <span className="block text-sm font-medium">uxis</span>
          <span className="text-muted-foreground block text-xs">live design</span>
        </span>
        <span className="text-muted-foreground ml-auto text-xs">▾</span>
      </Link>

      {/* 그룹 라벨 */}
      <p className="text-muted-foreground mt-4 mb-1.5 px-2 text-xs font-medium tracking-[0.07em] uppercase">
        워크스페이스
      </p>

      {/* 네비 */}
      <nav className="flex flex-col gap-0.5">
        {items.map((item) => {
          const isActive = active?.href === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                isActive
                  ? "bg-primary/10 text-primary font-medium before:absolute before:top-1.5 before:bottom-1.5 before:-left-3 before:w-[3px] before:rounded-r before:bg-primary before:content-['']"
                  : "text-foreground/80 hover:bg-muted",
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex-1" />

      {/* 유저 푸터 — 정보 + 로그아웃(기존 컴포넌트 재사용). 계정 드롭다운은 후속. */}
      <div className="mt-3 border-t pt-3">
        <div className="mb-2 flex items-center gap-2.5 px-1">
          <span className="bg-accent-purple flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-medium text-white">
            {initial}
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-sm font-medium">{name}</span>
            <span className="text-muted-foreground block truncate text-xs">{email}</span>
          </span>
        </div>
        <LogoutButton className="w-full" />
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/widgets/studio-shell/ui/studio-sidebar.tsx
git commit -m "feat(studio-shell): sidebar with workspace mark, active nav, user footer"
```

---

## Task 4: StudioTopbar (client)

**Files:**
- Create: `src/widgets/studio-shell/ui/studio-topbar.tsx`

**Interfaces:**
- Consumes: `matchNav` from `../model/nav-config`; `usePathname` from `next/navigation`; `Link` from `next/link`.
- Produces: `StudioTopbar()` — props 없음.

- [ ] **Step 1: Write the component**

Create `src/widgets/studio-shell/ui/studio-topbar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { matchNav } from "../model/nav-config";

export function StudioTopbar() {
  const pathname = usePathname();
  const section = matchNav(pathname);

  return (
    <header className="bg-background/80 sticky top-0 z-10 flex h-12 items-center justify-between border-b px-6 backdrop-blur">
      <nav className="flex items-center gap-2 text-sm">
        <Link
          href="/studio"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          uxis
        </Link>
        {section && (
          <>
            <span className="text-muted-foreground">›</span>
            <span className="text-foreground font-medium">{section.label}</span>
          </>
        )}
      </nav>
      {/* 우측 슬롯(예약): 검색/도움말 실기능은 후속 하위작업 */}
      <div />
    </header>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/widgets/studio-shell/ui/studio-topbar.tsx
git commit -m "feat(studio-shell): breadcrumb topbar (sticky, blurred)"
```

---

## Task 5: 셸 프레임 + 배럴 + layout 배선 (통합)

**Files:**
- Create: `src/widgets/studio-shell/ui/studio-shell.tsx`
- Create: `src/widgets/studio-shell/index.ts`
- Modify: `app/studio/layout.tsx`

**Interfaces:**
- Consumes: `StudioSidebar`, `StudioTopbar` (Task 3·4); `getProfile` from `@/shared/auth/guards.server`; `isEditor`, `Role` from `@/shared/auth/roles`.
- Produces:
  - `StudioShell(props: { displayName: string | null; email: string; role: Role; children: ReactNode })`
  - 배럴 export: `StudioShell`, `PageHeader`.

- [ ] **Step 1: Write the shell frame**

Create `src/widgets/studio-shell/ui/studio-shell.tsx`:

```tsx
import type { ReactNode } from "react";
import { type Role } from "@/shared/auth/roles";
import { StudioSidebar } from "./studio-sidebar";
import { StudioTopbar } from "./studio-topbar";

type StudioShellProps = {
  displayName: string | null;
  email: string;
  role: Role;
  children: ReactNode;
};

export function StudioShell({ displayName, email, role, children }: StudioShellProps) {
  return (
    <div className="bg-muted text-foreground flex min-h-screen">
      <StudioSidebar displayName={displayName} email={email} role={role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <StudioTopbar />
        <main className="flex-1 px-8 py-7">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write the barrel**

Create `src/widgets/studio-shell/index.ts`:

```ts
export { StudioShell } from "./ui/studio-shell";
export { PageHeader } from "./ui/page-header";
```

- [ ] **Step 3: Rewire the studio layout**

Replace the entire contents of `app/studio/layout.tsx` with:

```tsx
import { redirect } from "next/navigation";
import { getProfile } from "@/shared/auth/guards.server";
import { isEditor, type Role } from "@/shared/auth/roles";
import { StudioShell } from "@/widgets/studio-shell";

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (!isEditor(profile.role as Role)) redirect("/pending");

  return (
    <StudioShell
      displayName={profile.displayName}
      email={profile.email}
      role={profile.role as Role}
    >
      {children}
    </StudioShell>
  );
}
```

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS. (`Link`/`isAdmin`/`LogoutButton`의 미사용 import 가 layout 에 남아있지 않은지 확인 — 위 전체 교체로 제거됨.)

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: 빌드 성공. `/studio/proposals`, `/studio/users` 라우트가 에러 없이 컴파일.

- [ ] **Step 6: Runtime 육안 확인**

Run: `npm run dev` → 로그인 후 `http://localhost:3000/studio/proposals` 열기.
Expected:
- 흰 사이드바(좌) + 그레이 캔버스(우), 상단 sticky 브레드크럼 `uxis › 시안`.
- 사이드바 "시안" 항목이 블루 틴트 + 좌측 블루 인디케이터로 활성.
- `/studio/users` 로 이동 시 활성 항목과 브레드크럼이 "사용자 관리"로 전환.
- 하단 유저 푸터(이니셜 아바타 + 이메일 + 로그아웃). 로그아웃 클릭 시 `/login`.
- (admin 계정이 아니면 "사용자 관리" 항목 미노출 — Task 1 로직대로.)

> 메모리: 라이브 DB 데이터가 0일 수 있음. 목록이 비어도 셸 자체 렌더만 확인하면 됨.

- [ ] **Step 7: Commit**

```bash
git add src/widgets/studio-shell/ui/studio-shell.tsx src/widgets/studio-shell/index.ts app/studio/layout.tsx
git commit -m "feat(studio-shell): assemble shell frame and wire studio layout"
```

---

## Task 6: 시안 목록 화면을 셸에 맞춤

**Files:**
- Modify: `src/pages/proposals-list/ui/proposals-list-page.tsx`

**Interfaces:**
- Consumes: `PageHeader` from `@/widgets/studio-shell`.
- 표 구조·컬럼·쿼리·뱃지 변형은 **그대로**(본격 재구성은 ③). 헤더를 PageHeader 로, 표를 흰 카드 surface 로만 교체.

- [ ] **Step 1: Replace the page**

Replace the entire contents of `src/pages/proposals-list/ui/proposals-list-page.tsx` with:

```tsx
"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { proposalQueries } from "@/entities/proposal";
import { buttonVariants } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { PageHeader } from "@/widgets/studio-shell";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";

export function ProposalsListPage() {
  const { data: rows, isPending, isError } = useQuery(proposalQueries.list());

  return (
    <div>
      <PageHeader
        eyebrow="워크스페이스"
        title="시안"
        actions={
          <Link href="/studio/proposals/new" className={buttonVariants()}>
            새 시안
          </Link>
        }
      />

      <div className="bg-card overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>제목</TableHead>
              <TableHead>공개 ID</TableHead>
              <TableHead>공개 상태</TableHead>
              <TableHead className="text-right">링크</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending && (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground">
                  불러오는 중…
                </TableCell>
              </TableRow>
            )}

            {isError && (
              <TableRow>
                <TableCell colSpan={4} className="text-destructive">
                  목록을 불러오지 못했습니다.
                </TableCell>
              </TableRow>
            )}

            {rows?.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground">
                  아직 시안이 없습니다.
                </TableCell>
              </TableRow>
            )}

            {rows?.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <Link href={`/studio/proposals/${p.id}`} className="underline">
                    {p.title}
                  </Link>
                </TableCell>
                <TableCell className="font-mono text-xs">{p.publicId}</TableCell>
                <TableCell>
                  <Badge variant={p.visibility === "public" ? "default" : "outline"}>
                    {p.visibility === "public"
                      ? p.accessPasswordHash
                        ? "공개+비번"
                        : "공개"
                      : "비공개"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Link href={`/p/${p.publicId}`} className="text-sm underline" target="_blank">
                    뷰어 열기
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 3: Runtime 육안 확인**

`npm run dev` 실행 중이면 `/studio/proposals` 새로고침.
Expected: 페이지 헤더(아이브로우 "워크스페이스" + 제목 "시안" + 우측 "새 시안" 블루 버튼) 아래 흰 카드 안에 표. 그레이 캔버스 위에 카드가 떠 보임.

- [ ] **Step 4: Commit**

```bash
git add src/pages/proposals-list/ui/proposals-list-page.tsx
git commit -m "feat(studio-shell): proposals list adopts PageHeader + card surface"
```

---

## Task 7: 사용자 관리 화면 + 디자인 시스템 문서 갱신

**Files:**
- Modify: `src/pages/admin-users/ui/admin-users-page.tsx`
- Modify: `docs/design-system.md`

**Interfaces:**
- Consumes: `PageHeader` from `@/widgets/studio-shell`.

- [ ] **Step 1: Replace the admin page**

Replace the entire contents of `src/pages/admin-users/ui/admin-users-page.tsx` with:

```tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { userQueries } from "@/entities/user";
import { UserRowActions } from "@/features/manage-users";
import { PageHeader } from "@/widgets/studio-shell";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Badge } from "@/shared/ui/badge";

export function AdminUsersPage() {
  const { data: rows, isPending, isError } = useQuery(userQueries.list());

  return (
    <div>
      <PageHeader eyebrow="워크스페이스" title="사용자 관리" />

      <div className="bg-card overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>이메일</TableHead>
              <TableHead>역할</TableHead>
              <TableHead className="text-right">작업</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending && (
              <TableRow>
                <TableCell colSpan={3} className="text-muted-foreground">
                  불러오는 중…
                </TableCell>
              </TableRow>
            )}
            {isError && (
              <TableRow>
                <TableCell colSpan={3} className="text-destructive">
                  사용자 목록을 불러오지 못했습니다.
                </TableCell>
              </TableRow>
            )}
            {rows?.map((u) => (
              <TableRow key={u.id}>
                <TableCell>{u.email}</TableCell>
                <TableCell>
                  <Badge variant="neutral">{u.role}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <UserRowActions id={u.id} role={u.role} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update design-system.md**

`docs/design-system.md` 의 v2 절 안 "**추가 컴포넌트 (대시보드 셸)**" 블록 바로 아래에 다음 하위절을 추가한다(확정 값 기록):

```markdown
**셸 확정 값 (하위작업 1, 2026-06-22)**

- **앱 캔버스:** 스튜디오 셸 컨테이너에 `bg-muted`(#f7f7f7). 전역 `--background`는 흰색 불변(뷰어/인증 회귀 방지). 카드는 `bg-card`(흰색) + hairline 보더로 떠 보임.
- **사이드바:** 폭 `w-56`(224px), 흰 배경 `border-r`. 워크스페이스 마크(블루 8px 라운드 머리글자) + 그룹 라벨(eyebrow-sm) + 네비. 액티브 = `bg-primary/10 text-primary` + 좌측 3px 블루 인디케이터(`before:`). 하단 유저 푸터(아바타 + 이메일 + 로그아웃).
- **상단바:** `h-12` sticky, `bg-background/80 backdrop-blur`, `border-b`. 좌측 브레드크럼 `uxis › 섹션`. 우측 슬롯 예약.
- **PageHeader:** 아이브로우(eyebrow-sm) + 제목(display-sm, `font-medium`) + 설명(body-sm muted) + 우측 액션 슬롯. 캔버스 상단에 `mb-6`.
- **네비 단일출처:** `src/widgets/studio-shell/model/nav-config.ts` 의 `NAV_ITEMS` 가 사이드바·브레드크럼 공용.
```

- [ ] **Step 3: Typecheck + lint + build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: 모두 PASS / 빌드 성공.

- [ ] **Step 4: Runtime 육안 확인 (admin 계정)**

admin 계정으로 `/studio/users` 열기.
Expected: PageHeader("사용자 관리") 아래 흰 카드 표. 역할 뱃지가 중립(neutral) 필. 사이드바 "사용자 관리" 활성, 브레드크럼 `uxis › 사용자 관리`.

- [ ] **Step 5: Commit**

```bash
git add src/pages/admin-users/ui/admin-users-page.tsx docs/design-system.md
git commit -m "feat(studio-shell): admin users adopts PageHeader + card surface; document shell tokens"
```

---

## 최종 회귀 확인 (셸 미적용 영역)

마지막 커밋 후 한 번 더:

- [ ] `npm run test` — 전체 테스트 PASS(특히 nav-config + 기존 스위트 무회귀).
- [ ] 런타임으로 공개 뷰어 `http://localhost:3000/p/<publicId>`, `/login`, `/pending` 을 열어 **시각 변화 없음**(흰 배경 유지) 확인. (셸은 `/studio/*` 에만 적용되므로 변화가 없어야 정상.)

---

## Self-Review (작성자 점검 결과)

- **스펙 커버리지:** 사이드바(A)=Task 3 · 페이지 헤더(패턴 1)=Task 2/6/7 · 그레이 2계층=Task 5 · 브레드크럼=Task 4 · 흰 카드 surface=Task 6/7 · layout 배선=Task 5 · admin 전용 메뉴/neutral 뱃지=Task 1/7 · 디자인 시스템 갱신=Task 7 · 회귀 비목표(뷰어/인증 불변)=최종 확인. 누락 없음.
- **비목표 확인:** 대시보드 통계(②)·목록 본격 재구성(③)·DetailPanel(④)·워크스페이스 스위처·상단 검색 실기능은 의도적으로 제외 — 플랜에 포함하지 않음.
- **타입 일관성:** `matchNav`/`visibleNavItems`/`NavItem`/`NAV_ITEMS` 시그니처가 Task 1 정의와 Task 3·4 소비처에서 일치. `StudioShell` props(`displayName`/`email`/`role`/`children`)가 Task 5 정의와 layout 호출부에서 일치.
- **플레이스홀더 스캔:** TBD/임의 "에러 처리 추가" 류 없음. 모든 코드 스텝에 실제 전체 코드 포함.
