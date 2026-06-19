# 뷰어 로그인/핀 플로우 + `/studio` 라우트 이동 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 공유 링크 뷰어가 로그인/가입 후 보던 시안으로 복귀해 바로 핀을 남기고 어디서나 실명으로 표시되게 하며, 가입만 한 사용자에게 `/`에서 최근 본 시안 리스트를 제공하고, 관리 라우트를 `/studio`로 통합한다.

**Architecture:** 두 신원 체계(실시간 localStorage / 인증 세션)를 `viewerName` 하나로 잇고, `returnTo`를 로그인↔가입↔시안 전 구간에 전달한다. 최근 본 시안은 localStorage 순수 헬퍼 + 클라 effect로 기록·표시한다. 관리 화면은 `app/studio/`로 물리 이동하고 모든 참조를 갱신한다.

**Tech Stack:** Next.js 16.2.9(수정판), React 19, TypeScript, Supabase(@supabase/ssr), Drizzle, TanStack Query, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-19-viewer-auth-and-studio-routing-design.md`

## Global Constraints

- Node ≥ 22 (`package.json` engines).
- 단위 테스트 = **순수 로직만**(코드베이스 관례). I/O·실시간·UI 흐름은 `npx tsc --noEmit` + 수동 검증.
- 테스트: `npm test`(=`vitest run`), 단일 파일: `npx vitest run <path>`. 타입: `npx tsc --noEmit`.
- 경로 별칭: `@/` → `src/`, `@drizzle` → `drizzle/`. 테스트는 `@/`로 import, `tests/`에 미러링.
- 오픈 리다이렉트 방지: 외부에서 온 `returnTo`는 반드시 `isSafeInternalPath`로 검증 후 사용.
- 작업 브랜치: `feat/viewer-auth-studio`(이미 생성·스펙 커밋됨). 태스크별 작은 커밋.
- 커밋 메시지 말미: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## Task 0: 전제 확인 — 이메일 확인(컨펌) 비활성 (코드 없음 / 게이트)

**왜:** Task 5·8(가입→복귀, 최근 리스트)은 "가입 직후 세션 생성"에 의존한다. Supabase에서 이메일 확인이 **켜져 있으면** 가입 후 세션이 없어 복귀해도 게스트로 남는다.

- [ ] **Step 1: Supabase Auth 설정 확인**

Supabase 대시보드 → Authentication → Sign In / Providers → Email → **"Confirm email"** 옵션이 **OFF**인지 확인. (또는 로컬에서 신규 이메일로 가입 후 즉시 `/p/<id>`에서 핀 작성이 되는지 1회 수동 확인.)

- ON이면: 이 플랜의 A/D는 "이메일 확인 안내" 흐름이 추가로 필요 → **여기서 멈추고 사용자에게 보고**(범위 확대).
- OFF이면: 다음 태스크로 진행.

---

## Task 1: `deriveViewerName` 순수 헬퍼 (Part B 코어)

로그인 사용자(role 무관)의 표시명을 계산하는 순수 함수. 핀 `authorName` 폴백 규칙과 동일.

**Files:**
- Create: `src/shared/access/viewer-name.ts`
- Test: `tests/shared/access/viewer-name.test.ts`

**Interfaces:**
- Produces: `deriveViewerName(profile: { displayName: string | null; email: string } | null): string | null`

- [ ] **Step 1: 실패 테스트 작성**

`tests/shared/access/viewer-name.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { deriveViewerName } from "@/shared/access/viewer-name";

describe("deriveViewerName", () => {
  it("returns null for guests (no profile)", () => {
    expect(deriveViewerName(null)).toBe(null);
  });
  it("prefers displayName when present", () => {
    expect(deriveViewerName({ displayName: "홍길동", email: "a@b.com" })).toBe("홍길동");
  });
  it("falls back to the email local-part when displayName is null", () => {
    expect(deriveViewerName({ displayName: null, email: "alice@example.com" })).toBe("alice");
  });
  it("returns null when nothing usable (defensive)", () => {
    expect(deriveViewerName({ displayName: null, email: "" })).toBe(null);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/shared/access/viewer-name.test.ts`
Expected: FAIL ("Cannot find module '@/shared/access/viewer-name'").

- [ ] **Step 3: 구현**

`src/shared/access/viewer-name.ts`:

```ts
// 로그인 사용자(role 무관)의 표시명. 비로그인=null. 핀 authorName 폴백과 동일 규칙.
export function deriveViewerName(
  profile: { displayName: string | null; email: string } | null,
): string | null {
  if (!profile) return null;
  const name = profile.displayName ?? profile.email.split("@")[0];
  return name && name.length > 0 ? name : null;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/shared/access/viewer-name.test.ts`
Expected: PASS (4 passed).

- [ ] **Step 5: 커밋**

```bash
git add src/shared/access/viewer-name.ts tests/shared/access/viewer-name.test.ts
git commit -m "feat: deriveViewerName helper for logged-in display name"
```

---

## Task 2: `editorName` → `viewerName` 전 구간 교체 (Part B 배선)

`resolveViewerGate`가 모든 로그인 사용자분 이름을 반환하고, 실시간 신원 덮어쓰기가 전 사용자에 적용되게 한다. (tsc 게이트가 일관성을 보장하므로 한 커밋으로 묶는다.)

**Files:**
- Modify: `src/shared/access/resolve-viewer-gate.server.ts` (타입 16행, forbidden 25행, return 44행)
- Modify: `app/p/[publicId]/layout.tsx` (15, 20행)
- Modify: `src/widgets/realtime-shell/ui/realtime-shell.tsx` (prop 10/14행, 21행)
- Modify: `src/shared/realtime/identity.ts` (37–48행 파라미터/주석)

**Interfaces:**
- Consumes: `deriveViewerName` (Task 1)
- Produces: `ViewerGate.viewerName: string | null`; `RealtimeShell` prop `viewerName: string | null`; `loadOrCreateIdentity(authedName: string | null)`

- [ ] **Step 1: `resolve-viewer-gate.server.ts` 수정**

import 추가(파일 상단 import 블록 끝, 9행 근처):

```ts
import { deriveViewerName } from "@/shared/access/viewer-name";
```

타입(16행) `editorName: string | null;` → `viewerName: string | null;`

forbidden 조기반환(25행)에서 `editorName: null` → `viewerName: null`:

```ts
  if (!proposal) return { proposal: null, decision: "forbidden", viewerName: null, viewer: null };
```

마지막 return(44행)을 교체:

```ts
  const viewer = profile ? { id: profile.id, displayName: profile.displayName } : null;
  return { proposal, decision, viewerName: deriveViewerName(profile), viewer };
```

(28행의 `const editor = isEditor(...)`는 더 이상 쓰이지 않으면 제거. `isEditor`/`Role` import도 다른 사용 없으면 제거하여 lint 통과.)

- [ ] **Step 2: `app/p/[publicId]/layout.tsx` 수정**

15행: `const { decision, editorName } = ...` → `const { decision, viewerName } = ...`
20행: `<RealtimeShell publicId={publicId} editorName={editorName}>` → `<RealtimeShell publicId={publicId} viewerName={viewerName}>`

- [ ] **Step 3: `src/widgets/realtime-shell/ui/realtime-shell.tsx` 수정**

prop 이름 교체(9–15행 블록):

```tsx
export function RealtimeShell({
  publicId,
  viewerName,
  children,
}: {
  publicId: string;
  viewerName: string | null;
  children: React.ReactNode;
}) {
```

effect(19–22행) 교체:

```tsx
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: localStorage is browser-only; deferring to effect prevents SSR hydration mismatch
    setIdentity(loadOrCreateIdentity(viewerName));
  }, [viewerName]);
```

- [ ] **Step 4: `src/shared/realtime/identity.ts` 수정**

37–48행의 주석/파라미터명을 정리(로직 동일, 의미만 "로그인 사용자 전체"):

```ts
// Browser-only: load the saved identity or create a fresh anonymous one.
// `authedName`, when present (any logged-in user, role 무관), overrides the display name.
export function loadOrCreateIdentity(authedName: string | null): Identity {
  let identity = typeof localStorage !== "undefined" ? parseIdentity(localStorage.getItem(STORAGE_KEY)) : null;
  if (!identity) {
    const seed = Math.floor(Math.random() * 1_000_000);
    const id = (typeof crypto !== "undefined" && "randomUUID" in crypto) ? crypto.randomUUID() : String(seed);
    identity = { id, name: defaultGuestName(seed), color: pickColor(seed) };
  }
  if (authedName) identity = { ...identity, name: authedName };
  saveIdentity(identity);
  return identity;
}
```

- [ ] **Step 5: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음(`editorName` 잔존 참조 0).

- [ ] **Step 6: 커밋**

```bash
git add src/shared/access/resolve-viewer-gate.server.ts "app/p/[publicId]/layout.tsx" src/widgets/realtime-shell/ui/realtime-shell.tsx src/shared/realtime/identity.ts
git commit -m "feat: show display name for all logged-in users (editorName -> viewerName)"
```

---

## Task 3: PresenceBar 상시 로그인 진입점 (Part C)

게스트(비로그인)일 때만 우상단 PresenceBar에 "로그인" 링크를 노출.

**Files:**
- Modify: `src/widgets/realtime-shell/ui/realtime-shell.tsx` (PresenceBar 호출 38행 근처)
- Modify: `src/widgets/realtime-shell/ui/presence-bar.tsx` (props + 렌더)

**Interfaces:**
- Consumes: `RealtimeShell`의 `viewerName`
- Produces: `PresenceBar` prop `isAuthed: boolean`

- [ ] **Step 1: `realtime-shell.tsx`에서 isAuthed 전달**

`rename` 함수 정의 아래, return 블록의 PresenceBar 호출(38행)을 교체:

```tsx
      <PresenceBar identity={identity} onRename={rename} isAuthed={viewerName != null} />
```

- [ ] **Step 2: `presence-bar.tsx` props 추가**

함수 시그니처(8–14행)를 교체:

```tsx
export function PresenceBar({
  identity,
  onRename,
  isAuthed,
}: {
  identity: Identity;
  onRename: (name: string) => void;
  isAuthed: boolean;
}) {
```

- [ ] **Step 3: 로그인 링크 렌더**

비편집 폼 분기(`) : (` 이후의 `<button onClick={() => setEditing(true)} ...>` 블록, 57–63행)의 닫는 `)`  직전, 즉 이름 버튼 다음에 게스트 한정 링크를 추가. 구체적으로 58–63행의 버튼 JSX 바로 아래에:

```tsx
      )}
      {!isAuthed && (
        <a
          href={`/login?returnTo=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname + window.location.search : "/")}`}
          className="text-muted-foreground ml-1 text-xs underline"
        >
          로그인
        </a>
      )}
```

(주의: 기존 `{editing ? (...) : (...)}` 삼항의 닫는 `)}` 뒤, 최상위 `<div>` 내부에 위치시킨다. 줌/배치는 기존 컨테이너 그대로.)

- [ ] **Step 4: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 5: 수동 검증 (실행 후)**

게스트로 `/p/<공개시안>` 접속 → 우상단에 이름 옆 "로그인" 링크 표시. 클릭 시 `/login?returnTo=/p/<...>`로 이동. 로그인 후 복귀하면 링크가 사라지고 실명 표시.

- [ ] **Step 6: 커밋**

```bash
git add src/widgets/realtime-shell/ui/realtime-shell.tsx src/widgets/realtime-shell/ui/presence-bar.tsx
git commit -m "feat: persistent login link in PresenceBar for guests"
```

---

## Task 4: `returnTo` 전 구간 전달 (Part A)

핀 팝업 → 로그인 ↔ 가입 → 시안 복귀까지 `returnTo`가 끊기지 않게 한다.

**Files:**
- Modify: `app/(auth)/signup/page.tsx`
- Modify: `src/pages/signup/ui/signup-page.tsx`
- Modify: `src/features/auth/ui/signup-form.tsx`
- Modify: `src/pages/login/ui/login-page.tsx`

**Interfaces:**
- Consumes: `isSafeInternalPath` (`@/shared/lib/safe-redirect`)
- Produces: `SignupPage({ returnTo?: string })`, `SignupForm({ returnTo?: string })`

- [ ] **Step 1: `app/(auth)/signup/page.tsx` — searchParams 수신**

파일 전체를 교체(로그인 페이지와 동형):

```tsx
import { SignupPage } from "@/pages/signup";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { returnTo } = await searchParams;
  return <SignupPage returnTo={returnTo} />;
}
```

- [ ] **Step 2: `src/pages/signup/ui/signup-page.tsx` — returnTo 전달 + 로그인 링크 보존**

파일 전체를 교체:

```tsx
import Link from "next/link";
import { SignupForm } from "@/features/auth";
import { Card } from "@/shared/ui/card";

export function SignupPage({ returnTo }: { returnTo?: string }) {
  const loginHref = returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : "/login";
  return (
    <div className="bg-background flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-sm p-8">
        <h1 className="text-2xl font-semibold tracking-tight">회원가입</h1>
        <p className="text-muted-foreground mt-2 text-sm">가입 후 관리자 승인이 필요합니다.</p>
        <SignupForm returnTo={returnTo} />
        <Link href={loginHref} className="mt-4 block text-sm underline">
          이미 계정이 있으신가요? 로그인
        </Link>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: `src/features/auth/ui/signup-form.tsx` — returnTo 우선 리다이렉트**

import 블록에 추가(8행 `Button` import 근처):

```tsx
import { isSafeInternalPath } from "@/shared/lib/safe-redirect";
```

시그니처(25행) 교체: `export function SignupForm() {` → `export function SignupForm({ returnTo }: { returnTo?: string }) {`

성공 리다이렉트(40행) 교체:

```tsx
      await signupMutation.mutateAsync(values);
      router.replace(isSafeInternalPath(returnTo) ? returnTo : "/pending");
      router.refresh();
```

- [ ] **Step 4: `src/pages/login/ui/login-page.tsx` — 가입 링크 보존**

`LoginPage` 본문(5행)에 href 계산 추가 + Link 교체:

```tsx
export function LoginPage({ returnTo }: { returnTo?: string }) {
  const signupHref = returnTo ? `/signup?returnTo=${encodeURIComponent(returnTo)}` : "/signup";
  return (
    <div className="bg-background flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-sm p-8">
        <h1 className="text-2xl font-semibold tracking-tight">로그인</h1>
        <LoginForm returnTo={returnTo} />
        <Link href={signupHref} className="mt-4 block text-sm underline">
          계정이 없으신가요? 가입
        </Link>
      </Card>
    </div>
  );
}
```

- [ ] **Step 5: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 6: 수동 검증 (실행 후)**

게스트로 시안에서 핀 클릭 → "로그인" → 로그인 페이지의 "가입" 클릭 → URL이 `/signup?returnTo=/p/<...>` 유지 → 가입 완료 후 `/p/<...>`로 복귀하고 즉시 핀 작성 가능.

- [ ] **Step 7: 커밋**

```bash
git add "app/(auth)/signup/page.tsx" src/pages/signup/ui/signup-page.tsx src/features/auth/ui/signup-form.tsx src/pages/login/ui/login-page.tsx
git commit -m "feat: thread returnTo through login<->signup<->proposal"
```

---

## Task 5: 관리 라우트 `/studio` 이동 (Part E)

`/dashboard/*`·`/admin/users`를 `/studio/*`로 물리 이동하고 모든 참조를 갱신. (기계적 변경 — tsc + grep 0건으로 검증.)

**Files:**
- Move: `app/(dashboard)/layout.tsx` → `app/studio/layout.tsx`
- Move: `app/(dashboard)/dashboard/proposals/**` → `app/studio/proposals/**`
- Move: `app/(dashboard)/admin/users/**` → `app/studio/users/**`
- Create: `app/studio/page.tsx` (redirect)
- Delete: `app/(dashboard)/dashboard/page.tsx`, `src/pages/dashboard-home/**`
- Modify: `proxy.ts:40`, `src/features/auth/ui/login-form.tsx:38`, `src/pages/home/ui/home-page.tsx:8`, `src/features/edit-proposal-settings/ui/proposal-settings.tsx:58`, `src/features/create-proposal/ui/proposal-create-form.tsx:45`, `src/pages/proposals-list/ui/proposals-list-page.tsx:17,59`, `tests/shared/lib/safe-redirect.test.ts:8`

- [ ] **Step 1: 디렉터리 이동 (git mv)**

Bash 도구에서:

```bash
mkdir -p app/studio
git mv "app/(dashboard)/layout.tsx" "app/studio/layout.tsx"
git mv "app/(dashboard)/dashboard/proposals" "app/studio/proposals"
git mv "app/(dashboard)/admin/users" "app/studio/users"
git rm "app/(dashboard)/dashboard/page.tsx"
git rm -r "src/pages/dashboard-home"
rmdir "app/(dashboard)/dashboard" "app/(dashboard)/admin" "app/(dashboard)" 2>/dev/null || true
```

- [ ] **Step 2: `app/studio/page.tsx` 생성 (`/studio` → 목록 리다이렉트)**

```tsx
import { redirect } from "next/navigation";

export default function Page() {
  redirect("/studio/proposals");
}
```

- [ ] **Step 3: `app/studio/layout.tsx` 링크 갱신**

함수명/링크 갱신(전체 교체):

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/shared/auth/guards.server";
import { isEditor, isAdmin, type Role } from "@/shared/auth/roles";
import { LogoutButton } from "@/features/auth";

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (!isEditor(profile.role as Role)) redirect("/pending");

  return (
    <div className="flex min-h-screen">
      <aside className="border-border w-60 border-r p-4">
        <div className="mb-6 text-sm font-medium tracking-tight">uxis live design</div>
        <nav className="space-y-1 text-sm">
          <Link href="/studio/proposals" className="hover:bg-muted block rounded-[4px] px-3 py-2">
            시안
          </Link>
          {isAdmin(profile.role as Role) && (
            <Link href="/studio/users" className="hover:bg-muted block rounded-[4px] px-3 py-2">
              사용자 관리
            </Link>
          )}
        </nav>
        <LogoutButton className="mt-6 w-full" />
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
```

- [ ] **Step 4: `app/studio/users/page.tsx` 리다이렉트 갱신**

8행 `redirect("/dashboard")` → `redirect("/studio")`:

```tsx
  if (!profile || !isAdmin(profile.role as Role)) redirect("/studio");
```

- [ ] **Step 5: `proxy.ts` 가드 경로 갱신**

40행:

```ts
  if (path.startsWith("/studio")) {
```

- [ ] **Step 6: 외부 참조 갱신**

- `src/features/auth/ui/login-form.tsx:38` — `"/dashboard"` → `"/studio"`:
```tsx
      router.replace(isSafeInternalPath(returnTo) ? returnTo : "/studio");
```
- `src/pages/home/ui/home-page.tsx:8` — `"/dashboard"` → `"/studio"`(이 태스크에서는 삼항 형태 유지; Task 8에서 재구성):
```tsx
  redirect(isEditor(profile.role as Role) ? "/studio" : "/pending");
```
- `src/features/edit-proposal-settings/ui/proposal-settings.tsx:58` — `"/dashboard/proposals"` → `"/studio/proposals"`:
```tsx
      onSuccess: () => router.push("/studio/proposals"),
```
- `src/features/create-proposal/ui/proposal-create-form.tsx:45` — `/dashboard/proposals/${proposalId}` → `/studio/proposals/${proposalId}`:
```tsx
      router.push(`/studio/proposals/${proposalId}`);
```
- `src/pages/proposals-list/ui/proposals-list-page.tsx` 17행·59행:
```tsx
        <Link href="/studio/proposals/new" className={buttonVariants()}>
```
```tsx
                <Link href={`/studio/proposals/${p.id}`} className="underline">
```
- `tests/shared/lib/safe-redirect.test.ts:8` — 예시 경로 정리(`"/dashboard"` → `"/studio"`):
```ts
    expect(isSafeInternalPath("/studio")).toBe(true);
```

- [ ] **Step 7: 잔존 참조 0건 확인**

Run (Grep 도구 또는):
```bash
grep -rn --include=*.ts --include=*.tsx -E '"/(dashboard|admin/users)' src app proxy.ts
```
Expected: 출력 없음. (`app/api/admin/...`는 API라 대상 아님 — `src/`·`app/`(비 api)·`proxy.ts`만 확인.)

- [ ] **Step 8: 타입체크 + 전체 테스트**

Run: `npx tsc --noEmit` → 에러 없음.
Run: `npm test` → 전체 통과(safe-redirect 포함).

- [ ] **Step 9: 수동 검증 (실행 후)**

편집자 로그인 → `/studio/proposals` 진입, 새 시안/시안 상세/사용자관리(관리자) 링크 모두 동작. 미인증으로 `/studio/proposals` 접근 → `/login`. `/studio` 접근 → `/studio/proposals`.

- [ ] **Step 10: 커밋**

```bash
git add -A
git commit -m "refactor: move management routes under /studio (was /dashboard, /admin)"
```

---

## Task 6: 최근 본 시안 localStorage 헬퍼 (Part D 코어)

**Files:**
- Create: `src/shared/recent/recent-proposals.ts`
- Test: `tests/shared/recent/recent-proposals.test.ts`

**Interfaces:**
- Produces:
  - `type RecentProposal = { publicId: string; title: string; viewedAt: number }`
  - `upsertRecent(prev: RecentProposal[], entry: RecentProposal, max?: number): RecentProposal[]` (순수)
  - `parseRecent(raw: string | null): RecentProposal[]` (순수)
  - `loadRecent(): RecentProposal[]`, `addRecent(entry: RecentProposal): void` (브라우저 I/O)

- [ ] **Step 1: 실패 테스트 작성**

`tests/shared/recent/recent-proposals.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { upsertRecent, parseRecent, type RecentProposal } from "@/shared/recent/recent-proposals";

const mk = (publicId: string, viewedAt: number): RecentProposal => ({
  publicId,
  title: `T-${publicId}`,
  viewedAt,
});

describe("upsertRecent", () => {
  it("prepends a new entry", () => {
    const out = upsertRecent([mk("a", 1)], mk("b", 2));
    expect(out.map((r) => r.publicId)).toEqual(["b", "a"]);
  });
  it("dedupes by publicId, moving it to the front with new data", () => {
    const out = upsertRecent([mk("a", 1), mk("b", 2)], mk("a", 3));
    expect(out.map((r) => r.publicId)).toEqual(["a", "b"]);
    expect(out[0].viewedAt).toBe(3);
  });
  it("caps the list at max (default keeps most recent)", () => {
    const prev = Array.from({ length: 20 }, (_, i) => mk(`p${i}`, i));
    const out = upsertRecent(prev, mk("new", 99));
    expect(out.length).toBe(20);
    expect(out[0].publicId).toBe("new");
    expect(out.some((r) => r.publicId === "p19")).toBe(false); // oldest dropped
  });
  it("respects a custom max", () => {
    const out = upsertRecent([mk("a", 1), mk("b", 2)], mk("c", 3), 2);
    expect(out.map((r) => r.publicId)).toEqual(["c", "a"]);
  });
});

describe("parseRecent", () => {
  it("returns [] for null / invalid JSON", () => {
    expect(parseRecent(null)).toEqual([]);
    expect(parseRecent("not json")).toEqual([]);
    expect(parseRecent("{}")).toEqual([]);
  });
  it("filters out malformed entries", () => {
    const raw = JSON.stringify([
      { publicId: "a", title: "A", viewedAt: 1 },
      { publicId: "", title: "x", viewedAt: 2 },
      { publicId: "b", title: 5, viewedAt: 3 },
      { publicId: "c", title: "C", viewedAt: "nope" },
      { publicId: "d", title: "D", viewedAt: 4 },
    ]);
    expect(parseRecent(raw).map((r) => r.publicId)).toEqual(["a", "d"]);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/shared/recent/recent-proposals.test.ts`
Expected: FAIL ("Cannot find module '@/shared/recent/recent-proposals'").

- [ ] **Step 3: 구현**

`src/shared/recent/recent-proposals.ts`:

```ts
export type RecentProposal = { publicId: string; title: string; viewedAt: number };

const STORAGE_KEY = "uxis:recent";
const MAX_RECENT = 20;

// 순수: 이전 목록에 entry를 맨 앞으로(같은 publicId 제거), 상한 절단.
export function upsertRecent(
  prev: RecentProposal[],
  entry: RecentProposal,
  max: number = MAX_RECENT,
): RecentProposal[] {
  const filtered = prev.filter((r) => r.publicId !== entry.publicId);
  return [entry, ...filtered].slice(0, max);
}

// 순수: 저장된 JSON 파싱·검증. 손상/형식오류는 무시.
export function parseRecent(raw: string | null): RecentProposal[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (o): o is RecentProposal =>
        !!o &&
        typeof o.publicId === "string" &&
        o.publicId.length > 0 &&
        typeof o.title === "string" &&
        typeof o.viewedAt === "number" &&
        Number.isFinite(o.viewedAt),
    );
  } catch {
    return [];
  }
}

// 브라우저 I/O.
export function loadRecent(): RecentProposal[] {
  if (typeof localStorage === "undefined") return [];
  return parseRecent(localStorage.getItem(STORAGE_KEY));
}

export function addRecent(entry: RecentProposal): void {
  if (typeof localStorage === "undefined") return;
  const next = upsertRecent(parseRecent(localStorage.getItem(STORAGE_KEY)), entry);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/shared/recent/recent-proposals.test.ts`
Expected: PASS (6 passed).

- [ ] **Step 5: 커밋**

```bash
git add src/shared/recent/recent-proposals.ts tests/shared/recent/recent-proposals.test.ts
git commit -m "feat: localStorage helper for recently-viewed proposals"
```

---

## Task 7: 시안 조회 시 최근 목록 기록 (Part D 기록)

공개 뷰어가 `allow`일 때 현재 시안을 localStorage에 기록.

**Files:**
- Modify: `app/p/[publicId]/page.tsx:60`
- Modify: `src/pages/public-viewer/ui/public-viewer-page.tsx`

**Interfaces:**
- Consumes: `addRecent` (Task 6)
- Produces: `PublicViewerPage({ publicId, viewer, proposalTitle })`

- [ ] **Step 1: `app/p/[publicId]/page.tsx` — proposalTitle 전달**

60행 교체:

```tsx
  return (
    <ClientViewerPage
      publicId={publicId}
      viewer={viewer ? { id: viewer.id } : null}
      proposalTitle={proposal.title}
    />
  );
```

- [ ] **Step 2: `src/pages/public-viewer/ui/public-viewer-page.tsx` — 기록 effect**

import 추가(상단):

```tsx
import { useEffect } from "react";
import { addRecent } from "@/shared/recent/recent-proposals";
```

시그니처 + effect 교체(7–14행 영역):

```tsx
export function PublicViewerPage({
  publicId,
  viewer,
  proposalTitle,
}: {
  publicId: string;
  viewer: { id: string } | null;
  proposalTitle: string;
}) {
  useEffect(() => {
    addRecent({ publicId, title: proposalTitle, viewedAt: Date.now() });
  }, [publicId, proposalTitle]);

  const { data: variants, isPending, isError } = useQuery(proposalQueries.viewerVariants(publicId));
```

(나머지 본문은 그대로.)

- [ ] **Step 3: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 4: 수동 검증 (실행 후)**

`/p/<공개시안>` 접속 후 브라우저 콘솔에서 `localStorage.getItem("uxis:identity")` 옆 `localStorage.getItem("uxis:recent")`에 `{publicId,title,viewedAt}`가 기록되는지 확인. 다른 시안 방문 시 맨 앞에 추가·중복 제거.

- [ ] **Step 5: 커밋**

```bash
git add "app/p/[publicId]/page.tsx" src/pages/public-viewer/ui/public-viewer-page.tsx
git commit -m "feat: record viewed proposals to localStorage on the public viewer"
```

---

## Task 8: `/` 최근 본 시안 페이지 + home 분기 (Part D 표시)

가입만 한(pending) 사용자가 `/` 접속 시 최근 본 시안 리스트를 렌더.

**Files:**
- Create: `src/pages/recent-proposals/ui/recent-proposals-page.tsx`
- Create: `src/pages/recent-proposals/index.ts`
- Modify: `src/pages/home/ui/home-page.tsx`

**Interfaces:**
- Consumes: `loadRecent`, `RecentProposal` (Task 6)
- Produces: `RecentProposalsPage` (client)

- [ ] **Step 1: `recent-proposals-page.tsx` 생성**

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadRecent, type RecentProposal } from "@/shared/recent/recent-proposals";

export function RecentProposalsPage() {
  // localStorage는 브라우저 전용 → 마운트 후 로드(하이드레이션 안전, identity 패턴과 동일).
  const [items, setItems] = useState<RecentProposal[] | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: localStorage is browser-only
    setItems(loadRecent());
  }, []);

  if (items === null) return null;

  return (
    <div className="bg-background flex min-h-screen flex-col items-center px-6 py-16">
      <div className="w-full max-w-md">
        <h1 className="text-xl font-semibold tracking-tight">최근 본 시안</h1>
        {items.length === 0 ? (
          <p className="text-muted-foreground mt-4 text-sm">
            최근 본 시안이 없습니다. 공유받은 링크로 시안을 열어보세요.
          </p>
        ) : (
          <ul className="mt-6 space-y-2">
            {items.map((r) => (
              <li key={r.publicId}>
                <Link
                  href={`/p/${r.publicId}`}
                  className="border-border hover:bg-muted block rounded-[6px] border px-4 py-3 text-sm"
                >
                  {r.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="text-muted-foreground mt-8 text-xs">
          편집 권한은 관리자 승인 후 부여됩니다.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `index.ts` 배럴 생성**

`src/pages/recent-proposals/index.ts`:

```ts
export { RecentProposalsPage } from "./ui/recent-proposals-page";
```

- [ ] **Step 3: `home-page.tsx` 분기 변경**

전체 교체(편집자는 `/studio`, 게스트는 `/login`, pending은 최근 리스트 렌더):

```tsx
import { redirect } from "next/navigation";
import { getProfile } from "@/shared/auth/guards.server";
import { isEditor, type Role } from "@/shared/auth/roles";
import { RecentProposalsPage } from "@/pages/recent-proposals";

export async function HomePage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (isEditor(profile.role as Role)) redirect("/studio");
  return <RecentProposalsPage />;
}
```

- [ ] **Step 4: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 5: 수동 검증 (실행 후)**

pending 계정으로 로그인 상태에서 `/` 접속 → 직전에 본 시안들이 리스트로 표시, 항목 클릭 시 해당 `/p/<id>`로 이동. 게스트는 `/` → `/login`, 편집자는 `/` → `/studio`.

- [ ] **Step 6: 커밋**

```bash
git add src/pages/recent-proposals src/pages/home/ui/home-page.tsx
git commit -m "feat: show recently-viewed proposals at / for pending users"
```

---

## Task 9: 통합 검증 + 마무리

- [ ] **Step 1: 전체 타입체크 + 테스트**

Run: `npx tsc --noEmit` → 에러 없음.
Run: `npm test` → 전체 통과.
Run: `npm run lint` → 에러 없음.

- [ ] **Step 2: 잔존 `/dashboard`·`/admin/users` 0건 재확인**

Run: `grep -rn --include=*.ts --include=*.tsx -E '"/(dashboard|admin/users)' src app proxy.ts`
Expected: 출력 없음.

- [ ] **Step 3: 전체 수동 E2E (스펙 §8)**

1. 게스트 → 핀 클릭 → 로그인 → 가입 → 시안 복귀 + 즉시 핀.
2. 로그인(pending/편집자) 후 프레즌스·채팅·핀에서 실명 표시.
3. 게스트 우상단 "로그인" 링크 → returnTo 복귀.
4. pending `/` → 최근 리스트 → 항목 진입.
5. `/studio` 이동 후 전 관리 링크 동작, 미인증 `/studio/*` → `/login`.

- [ ] **Step 4: 브랜치 마무리**

`superpowers:finishing-a-development-branch` 스킬로 master 병합 옵션을 사용자에게 제시.

---

## Self-Review (작성자 점검 결과)

**1. Spec coverage:** A(Task 4) · B(Task 1·2) · C(Task 3) · D(Task 6·7·8) · E(Task 5) · 전제(Task 0) · 테스트(각 태스크 + Task 9) 모두 매핑됨. API 미이동·`/pending` 유지 = 의도적 비작업(스펙 §1 제외 항목).

**2. Placeholder scan:** TBD/“적절히 처리” 류 없음. 모든 코드 스텝에 실제 코드 포함.

**3. Type consistency:** `viewerName: string\|null`(Task 2 정의) → Task 3 소비 일치. `RecentProposal`/`upsertRecent`/`parseRecent`/`loadRecent`/`addRecent`(Task 6 정의) → Task 7·8 소비 일치. `SignupPage/SignupForm({returnTo?})`(Task 4) 일치. `deriveViewerName`(Task 1) → Task 2 소비 일치.
