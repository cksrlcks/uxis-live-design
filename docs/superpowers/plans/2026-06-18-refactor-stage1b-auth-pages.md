# Refactor Stage 1b — Auxiliary Pages + `features/auth` (route handlers)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Migrate the remaining auxiliary routes onto the new FSD architecture — the `/` redirect and dashboard home become `src/pages/*` re-exports, and the auth surface (login/signup/logout/pending) moves to a `features/auth` slice whose forms are React Hook Form + Zod and whose Supabase calls run behind **thin HTTP route handlers** (`/api/auth/*`) instead of server actions.

**Architecture:** Auth writes flow RHF+Zod form → feature mutation (`useMutation`) → `POST /api/auth/{login,signup,logout}` (thin route handler, `try/catch` → `toErrorResponse`) → guarded server fn `auth.server.ts` (`createSupabaseServer()` + Zod `parse` + Supabase auth → sets/clears session cookies). Success navigates **client-side** (`router.replace`); failures surface **inline** via typed error codes (`HttpError.code` → Korean message). The shared `loginSchema`/`signupSchema` live in `features/auth/model` (both the route handler's server fn and the client form are inside the same feature, so no cross-layer import). The two trivial pages (`/`, dashboard home) become 1-line re-exports; `/` keeps its server boundary (auth gate stays server-side).

**Tech Stack:** Next.js 16 (App Router, `proxy.ts` middleware, Route Handlers), React 19, `@tanstack/react-query` v5, Zod v4 (`z.email()`), React Hook Form v7 + `@hookform/resolvers`, Supabase SSR, Vitest (node env).

**Source spec:** `docs/superpowers/specs/2026-06-17-fsd-react-query-refactor-design.md`. **Handoff:** `docs/superpowers/HANDOFF.md`. Builds on Stage 0 + Stage 1 (merged on this branch): `@→src`, `@drizzle`, `src/shared/api/{http,query-client,to-error-response,same-origin}`, `src/shared/{ui,db,auth,supabase,storage,lib,...}`, QueryProvider in root layout, CSRF guard in `proxy.ts`.

**Decision change vs. the handoff:** The handoff anticipated keeping Supabase auth as **server actions**. The user has chosen to use **route handlers** instead, making auth consistent with the rest of the refactor (HTTP API + RHF/Zod + `useMutation`). This plan implements the route-handler approach and deletes `app/(auth)/actions.ts`.

## Global Constraints

- **Node ≥22** (`package.json` `engines`; `next build` requires it). This machine may be on Node 20 — switch to Node ≥22 before any `npm run build` / verification step. `tsc`/`lint`/`test` (Vitest) run on Node 20, but the build gate needs ≥22.
- **FSD layer order:** `shared < entities < features < pages < app`. Lower layers never import higher ones. A slice's `index.ts` barrel exports **only client-safe** modules — never `*.server.ts`. Route handlers (in `app/`) import `*.server.ts` directly, not via the barrel.
- **Auth stays server-side:** Supabase auth runs inside route handlers via `createSupabaseServer()` (which sets/clears session cookies in a Route Handler response). Only the post-auth redirect **target** is computed client-side, validated with `isSafeInternalPath`.
- **CSRF:** `proxy.ts` already rejects cross-origin `/api` POST/PUT/PATCH/DELETE; `/api/auth/*` POSTs are covered automatically. Do not add per-route CSRF code.
- **Base UI Button** (`@/shared/ui/button`) defaults to `type="button"`. Form **submit** buttons MUST set `type="submit"`; the logout button stays the default `type="button"`.
- **TDD (red-green) for PURE logic only:** Zod schemas, the signup-error mapper, the relocated `isSafeInternalPath`, and `toErrorResponse` additions. Integration code (server fns hitting Supabase, route handlers, RHF forms, pages) has **no unit tests in this repo's style** (Vitest runs in `node` env; no React render harness) — verify via `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`, and manual smoke. State honestly per task which you did.
- **Next 16 first:** Before Task 5 (route handlers + Supabase cookies) read `node_modules/next/dist/docs/01-app/` guides for Route Handlers and async `cookies()`; before Task 8 (server-component page reading `searchParams`) confirm `searchParams` is a `Promise` in this version (it is — see `app/(auth)/login/page.tsx`).
- **One commit per task.** Prettier-format touched/new files before committing (`npx prettier --write <paths>`). `format:check` stays globally red on not-yet-migrated `src/legacy` + `app/` — only format the files you touch.

### Documented behavior divergences (intended)

- **Login failure** → `INVALID_CREDENTIALS` (401) → generic inline message "이메일 또는 비밀번호가 올바르지 않습니다." (was: verbatim Supabase `error.message` via `?error=` redirect). Generic message avoids account enumeration.
- **Signup failure** → `EMAIL_TAKEN` (409) or `SIGNUP_FAILED` (400) → Korean inline messages (was: verbatim Supabase message). The raw Supabase string is no longer surfaced (the `http()` contract is code-based).
- **Errors are inline**, not `?error=` query-string redirects. **Success navigates client-side** (`router.replace`) instead of a server `redirect()`.
- **Validation** runs client-side (`zodResolver`) and server-side (`schema.parse` in the server fn → `VALIDATION_ERROR` 400 if bypassed).
- **Auth errors are collapsed by design:** login failures collapse to `INVALID_CREDENTIALS` (no account enumeration). The one carve-out is **rate limiting** — Supabase 429s are surfaced distinctly as `RATE_LIMITED` (so the user is told to wait, not to re-check a correct password). Genuinely transient/network errors still fall through to a generic message.
- **No app-level rate limiting** is added: `/api/auth/login` and `/api/auth/signup` are public unauthenticated POST endpoints protected only by the same-origin CSRF guard and **Supabase's built-in auth rate limits**. This matches the pre-refactor server actions (equally unthrottled). App-level throttling (e.g. in `proxy.ts` for `/api/auth/*`) is a **deferred follow-up**, not handled here.

---

### Task 1: Home `/` redirect + dashboard home → `src/pages/*` re-exports

**Files:**

- Create: `src/pages/home/ui/home-page.tsx`
- Create: `src/pages/home/index.ts`
- Create: `src/pages/dashboard-home/ui/dashboard-home-page.tsx`
- Create: `src/pages/dashboard-home/index.ts`
- Modify: `app/page.tsx` (→ re-export)
- Modify: `app/(dashboard)/dashboard/page.tsx` (→ re-export)

> Both are trivial and fully independent of the auth work. `/` is a server component that keeps its auth gate server-side (no UI, just `getProfile()` + `redirect`). Dashboard home is a static heading.

- [ ] **Step 1: Home page composition (server component)** — `src/pages/home/ui/home-page.tsx`

```tsx
import { redirect } from "next/navigation";
import { getProfile } from "@/shared/auth/guards.server";
import { isEditor, type Role } from "@/shared/auth/roles";

export async function HomePage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  redirect(isEditor(profile.role as Role) ? "/dashboard" : "/pending");
}
```

`src/pages/home/index.ts`:

```ts
export { HomePage } from "./ui/home-page";
```

- [ ] **Step 2: Dashboard home composition** — `src/pages/dashboard-home/ui/dashboard-home-page.tsx`

```tsx
export function DashboardHomePage() {
  return <h1 className="text-2xl font-semibold tracking-tight">대시보드</h1>;
}
```

`src/pages/dashboard-home/index.ts`:

```ts
export { DashboardHomePage } from "./ui/dashboard-home-page";
```

- [ ] **Step 3: Re-export from the routes** — replace the entire contents of each file.

`app/page.tsx`:

```tsx
export { HomePage as default } from "@/pages/home";
```

`app/(dashboard)/dashboard/page.tsx`:

```tsx
export { DashboardHomePage as default } from "@/pages/dashboard-home";
```

- [ ] **Step 4: Typecheck + build** — switch to Node ≥22, then `npx tsc --noEmit && npm run build` → both PASS (route count unchanged; `/` still redirects, `/dashboard` still renders).

- [ ] **Step 5: Format + commit**

```bash
npx prettier --write src/pages/home src/pages/dashboard-home "app/page.tsx" "app/(dashboard)/dashboard/page.tsx"
git add -A
git commit -m "refactor: home redirect + dashboard home → src/pages re-exports (Stage 1b)"
```

---

### Task 2: Promote `isSafeInternalPath` to `src/shared/lib/safe-redirect.ts`

**Files:**

- Move: `src/legacy/lib/access/safe-redirect.ts` → `src/shared/lib/safe-redirect.ts`
- Move: `tests/access/safe-redirect.test.ts` → `tests/shared/lib/safe-redirect.test.ts`
- Modify: `app/(auth)/actions.ts` (repoint import — temporary; this file is deleted in Task 8)

> `isSafeInternalPath` becomes a shared helper because the client login form needs it (open-redirect-safe navigation target). The ONLY live runtime importers today are `app/(auth)/actions.ts` and the test (verified by grep). Repoint `actions.ts` now so the tree stays green; `actions.ts` itself is deleted in Task 8.

- [ ] **Step 1: Move the module + its test**

```bash
mkdir -p src/shared/lib tests/shared/lib
git mv src/legacy/lib/access/safe-redirect.ts src/shared/lib/safe-redirect.ts
git mv tests/access/safe-redirect.test.ts tests/shared/lib/safe-redirect.test.ts
```

- [ ] **Step 2: Update the test import** — in `tests/shared/lib/safe-redirect.test.ts` change line 2:

```ts
import { isSafeInternalPath } from "@/shared/lib/safe-redirect";
```

(The module body is unchanged — pure function, no edits.)

- [ ] **Step 3: Repoint the one live importer** — in `app/(auth)/actions.ts` change the import on line 4:

```ts
import { isSafeInternalPath } from "@/shared/lib/safe-redirect";
```

- [ ] **Step 4: Run test → PASS** — `npm test -- tests/shared/lib/safe-redirect.test.ts` (4 tests pass). Then guard the old path is gone:

```bash
grep -rn "legacy/lib/access/safe-redirect" app src tests   # expect NO output
```

- [ ] **Step 5: Typecheck** — `npx tsc --noEmit` → exit 0.

- [ ] **Step 6: Format + commit**

```bash
npx prettier --write src/shared/lib/safe-redirect.ts tests/shared/lib/safe-redirect.test.ts "app/(auth)/actions.ts"
git add -A
git commit -m "refactor: promote isSafeInternalPath to shared/lib (Stage 1b)"
```

---

### Task 3: Extend `to-error-response` with auth status codes (TDD)

**Files:**

- Modify: `src/shared/api/to-error-response.ts`
- Modify: `tests/shared/api/to-error-response.test.ts`

> Auth server fns throw typed `Error(CODE)` values; `toErrorResponse` maps each code to an HTTP status. The client `http()` helper turns the body `{ error: CODE }` into `HttpError.code`, which the forms map to Korean messages.

- [ ] **Step 1: Add failing tests** — append inside the `describe("toErrorResponse", …)` block in `tests/shared/api/to-error-response.test.ts`:

```ts
it("maps INVALID_CREDENTIALS to 401", () => {
  expect(toErrorResponse(new Error("INVALID_CREDENTIALS")).status).toBe(401);
});

it("maps EMAIL_TAKEN to 409", () => {
  expect(toErrorResponse(new Error("EMAIL_TAKEN")).status).toBe(409);
});

it("maps SIGNUP_FAILED to 400", async () => {
  const res = toErrorResponse(new Error("SIGNUP_FAILED"));
  expect(res.status).toBe(400);
  expect((await res.json()).error).toBe("SIGNUP_FAILED");
});

it("maps RATE_LIMITED to 429", () => {
  expect(toErrorResponse(new Error("RATE_LIMITED")).status).toBe(429);
});
```

- [ ] **Step 2: Run tests → FAIL** — `npm test -- tests/shared/api/to-error-response.test.ts` (the four new cases fail: codes map to 500).

- [ ] **Step 3: Implement** — extend the `STATUS_BY_CODE` map in `src/shared/api/to-error-response.ts`:

```ts
const STATUS_BY_CODE: Record<string, number> = {
  FORBIDDEN: 403,
  UNAUTHORIZED: 401,
  LOGIN_REQUIRED: 401,
  NOT_FOUND: 404,
  INVALID_CREDENTIALS: 401,
  EMAIL_TAKEN: 409,
  SIGNUP_FAILED: 400,
  RATE_LIMITED: 429,
};
```

- [ ] **Step 4: Run tests → PASS** — `npm test -- tests/shared/api/to-error-response.test.ts` (all pass).

- [ ] **Step 5: Format + commit**

```bash
npx prettier --write src/shared/api/to-error-response.ts tests/shared/api/to-error-response.test.ts
git add -A
git commit -m "feat: map auth error codes (INVALID_CREDENTIALS/EMAIL_TAKEN/SIGNUP_FAILED) in toErrorResponse (Stage 1b)"
```

---

### Task 4: `features/auth` model schema + signup-error mapper (TDD)

**Files:**

- Create: `src/features/auth/model/schema.ts`
- Create: `src/features/auth/api/signup-error.ts`
- Test: `tests/features/auth/schema.test.ts`
- Test: `tests/features/auth/signup-error.test.ts`

> Two pure units shared by both sides of the feature. The schema is the single source of truth for form + server validation. `signupErrorCode` maps a Supabase `AuthError`-shaped object to one of our typed codes; it is pure (no Supabase import) so it is unit-testable.

- [ ] **Step 1: Write the failing schema test** — `tests/features/auth/schema.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { loginSchema, signupSchema } from "@/features/auth/model/schema";

describe("loginSchema", () => {
  it("accepts a valid email + password", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "x" }).success).toBe(true);
  });
  it("rejects a malformed email", () => {
    expect(loginSchema.safeParse({ email: "nope", password: "x" }).success).toBe(false);
  });
  it("rejects an empty password", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "" }).success).toBe(false);
  });
});

describe("signupSchema", () => {
  it("accepts a valid payload", () => {
    expect(
      signupSchema.safeParse({ name: "홍길동", email: "a@b.com", password: "12345678" }).success,
    ).toBe(true);
  });
  it("trims and rejects an empty name", () => {
    expect(
      signupSchema.safeParse({ name: "   ", email: "a@b.com", password: "12345678" }).success,
    ).toBe(false);
  });
  it("rejects a password under 8 chars", () => {
    expect(
      signupSchema.safeParse({ name: "홍길동", email: "a@b.com", password: "1234567" }).success,
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run → FAIL** — `npm test -- tests/features/auth/schema.test.ts` ("Cannot find module '@/features/auth/model/schema'").

- [ ] **Step 3: Implement the schema** — `src/features/auth/model/schema.ts`

```ts
import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("올바른 이메일을 입력하세요"),
  password: z.string().min(1, "비밀번호를 입력하세요"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const signupSchema = z.object({
  name: z.string().trim().min(1, "이름을 입력하세요"),
  email: z.email("올바른 이메일을 입력하세요"),
  password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다"),
});
export type SignupInput = z.infer<typeof signupSchema>;
```

> Zod v4: `z.email("msg")` is the non-deprecated form (`z.string().email()` is deprecated). An empty string fails `z.email` with the same message — acceptable.

- [ ] **Step 4: Run schema test → PASS** (6 tests).

- [ ] **Step 5: Write the failing mapper test** — `tests/features/auth/signup-error.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { signupErrorCode } from "@/features/auth/api/signup-error";

describe("signupErrorCode", () => {
  it("maps user_already_exists code to EMAIL_TAKEN", () => {
    expect(signupErrorCode({ code: "user_already_exists" })).toBe("EMAIL_TAKEN");
  });
  it("maps an 'already registered' message to EMAIL_TAKEN", () => {
    expect(signupErrorCode({ message: "User already registered" })).toBe("EMAIL_TAKEN");
  });
  it("falls back to SIGNUP_FAILED for anything else", () => {
    expect(signupErrorCode({ code: "weak_password", message: "boom" })).toBe("SIGNUP_FAILED");
    expect(signupErrorCode({})).toBe("SIGNUP_FAILED");
  });
});
```

- [ ] **Step 6: Run → FAIL** — `npm test -- tests/features/auth/signup-error.test.ts`.

- [ ] **Step 7: Implement the mapper** — `src/features/auth/api/signup-error.ts`

```ts
// Pure mapper for Supabase signUp errors → our typed codes (no Supabase import, so it's testable).
// Supabase config-dependent: with email confirmation OFF, a duplicate email returns an error
// ("User already registered" / code "user_already_exists"). We match code first, message as fallback.
export function signupErrorCode(error: {
  code?: string | null;
  message?: string | null;
}): "EMAIL_TAKEN" | "SIGNUP_FAILED" {
  const code = error.code ?? "";
  const message = error.message ?? "";
  if (
    code === "user_already_exists" ||
    /already (registered|been registered|exists)/i.test(message)
  ) {
    return "EMAIL_TAKEN";
  }
  return "SIGNUP_FAILED";
}
```

- [ ] **Step 8: Run mapper test → PASS** (3 tests).

- [ ] **Step 9: Format + commit**

```bash
npx prettier --write src/features/auth/model src/features/auth/api/signup-error.ts tests/features/auth
git add -A
git commit -m "feat: features/auth login+signup Zod schema + signup-error mapper (Stage 1b)"
```

---

### Task 5: `auth.server.ts` server fns + `/api/auth/*` route handlers

**Files:**

- Create: `src/features/auth/api/auth.server.ts`
- Create: `app/api/auth/login/route.ts`
- Create: `app/api/auth/signup/route.ts`
- Create: `app/api/auth/logout/route.ts`

> Read first (Next 16): `node_modules/next/dist/docs/01-app/` Route Handlers + async `cookies()`. `createSupabaseServer()` uses `next/headers` `cookies()`; inside a Route Handler `cookieStore.set` succeeds, so `signInWithPassword`/`signUp`/`signOut` correctly write/clear `Set-Cookie` on the response. Each route is thin: parse → server fn → 204, errors via `toErrorResponse`.

- [ ] **Step 1: Server fns** — `src/features/auth/api/auth.server.ts`

```ts
import "server-only";
import { createSupabaseServer } from "@/shared/supabase/server";
import { loginSchema, signupSchema } from "../model/schema";
import { signupErrorCode } from "./signup-error";

export async function signIn(input: unknown): Promise<void> {
  const { email, password } = loginSchema.parse(input);
  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.status === 429) throw new Error("RATE_LIMITED");
    throw new Error("INVALID_CREDENTIALS");
  }
}

export async function signUp(input: unknown): Promise<void> {
  const { name, email, password } = signupSchema.parse(input);
  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: name } },
  });
  if (error) {
    if (error.status === 429) throw new Error("RATE_LIMITED");
    throw new Error(signupErrorCode(error));
  }
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
}
```

> `schema.parse` throws `ZodError` on bad input → `toErrorResponse` → 400 `VALIDATION_ERROR`. Supabase 429s become `RATE_LIMITED` (429) in both fns so the user is told to wait rather than re-check credentials. Otherwise `signIn` collapses every auth error to `INVALID_CREDENTIALS` (no enumeration), and `signUp` delegates to the tested mapper. (`AuthError` carries a numeric `.status`.)

- [ ] **Step 2: Login route** — `app/api/auth/login/route.ts`

```ts
import { NextRequest } from "next/server";
import { signIn } from "@/features/auth/api/auth.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

export async function POST(req: NextRequest) {
  try {
    await signIn(await req.json());
    return new Response(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
```

- [ ] **Step 3: Signup route** — `app/api/auth/signup/route.ts`

```ts
import { NextRequest } from "next/server";
import { signUp } from "@/features/auth/api/auth.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

export async function POST(req: NextRequest) {
  try {
    await signUp(await req.json());
    return new Response(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
```

- [ ] **Step 4: Logout route** — `app/api/auth/logout/route.ts` (no body read)

```ts
import { signOut } from "@/features/auth/api/auth.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

export async function POST() {
  try {
    await signOut();
    return new Response(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
```

- [ ] **Step 5: Typecheck + build** — Node ≥22, `npx tsc --noEmit && npm run build` → PASS (build now lists the 3 new `/api/auth/*` routes).

- [ ] **Step 6: Manual smoke (optional but recommended)** — `npm run dev`; cross-origin guard + cookie set:

```bash
# Wrong creds → 401 INVALID_CREDENTIALS
curl -s -o /dev/null -w "%{http_code}\n" -X POST -H "Origin: http://localhost:3000" -H "Content-Type: application/json" -d '{"email":"nope@x.com","password":"wrong"}' http://localhost:3000/api/auth/login   # 401
# Malformed payload (missing password) → 400 VALIDATION_ERROR
curl -s -X POST -H "Origin: http://localhost:3000" -H "Content-Type: application/json" -d '{"email":"nope@x.com"}' http://localhost:3000/api/auth/login   # {"error":"VALIDATION_ERROR",...}
```

Stop dev. (If no Supabase env locally, rely on tsc+build and note it.)

- [ ] **Step 7: Format + commit**

```bash
npx prettier --write src/features/auth/api/auth.server.ts app/api/auth
git add -A
git commit -m "feat: auth server fns + thin /api/auth/{login,signup,logout} route handlers (Stage 1b)"
```

---

### Task 6: `features/auth` client API — fetchers + mutation hooks

**Files:**

- Create: `src/features/auth/api/auth.ts`
- Create: `src/features/auth/api/use-auth.ts`

> Client fetchers POST to the route handlers; hooks wrap them in `useMutation`. `useLogout` clears the React Query cache on success (the previous user's cached data must not leak into the next session).

- [ ] **Step 1: Client fetchers** — `src/features/auth/api/auth.ts`

```ts
import { http } from "@/shared/api/http";
import type { LoginInput, SignupInput } from "../model/schema";

export function login(input: LoginInput): Promise<void> {
  return http<void>("/api/auth/login", { method: "POST", body: JSON.stringify(input) });
}

export function signup(input: SignupInput): Promise<void> {
  return http<void>("/api/auth/signup", { method: "POST", body: JSON.stringify(input) });
}

export function logout(): Promise<void> {
  return http<void>("/api/auth/logout", { method: "POST" });
}
```

> `http()` returns `undefined` on 204 and throws `HttpError(status, code)` on failure (the forms read `.code`). Logout sends no body; the route ignores it.

- [ ] **Step 2: Mutation hooks** — `src/features/auth/api/use-auth.ts`

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { login, signup, logout } from "./auth";

export function useLogin() {
  return useMutation({ mutationFn: login });
}

export function useSignup() {
  return useMutation({ mutationFn: signup });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logout,
    onSuccess: () => queryClient.clear(),
  });
}
```

- [ ] **Step 3: Typecheck** — `npx tsc --noEmit` → exit 0.

- [ ] **Step 4: Format + commit**

```bash
npx prettier --write src/features/auth/api/auth.ts src/features/auth/api/use-auth.ts
git add -A
git commit -m "feat: features/auth client fetchers + useLogin/useSignup/useLogout hooks (Stage 1b)"
```

---

### Task 7: `features/auth` UI — login / signup forms + logout button + barrel

**Files:**

- Create: `src/features/auth/ui/login-form.tsx`
- Create: `src/features/auth/ui/signup-form.tsx`
- Create: `src/features/auth/ui/logout-button.tsx`
- Create: `src/features/auth/index.ts`

> RHF+Zod forms with inline errors; the barrel exports ONLY the three client components (never `auth.server.ts`). The login form receives `returnTo` as a prop from its (server) page so it does not need `useSearchParams` (avoids the Next "useSearchParams must be wrapped in Suspense" build error).

- [ ] **Step 1: Login form** — `src/features/auth/ui/login-form.tsx`

```tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { HttpError } from "@/shared/api/http";
import { isSafeInternalPath } from "@/shared/lib/safe-redirect";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { loginSchema, type LoginInput } from "../model/schema";
import { useLogin } from "../api/use-auth";

function loginErrorMessage(err: unknown): string {
  if (err instanceof HttpError) {
    if (err.code === "INVALID_CREDENTIALS") return "이메일 또는 비밀번호가 올바르지 않습니다.";
    if (err.code === "RATE_LIMITED") return "잠시 후 다시 시도해주세요.";
  }
  return "로그인 중 오류가 발생했습니다.";
}

export function LoginForm({ returnTo }: { returnTo?: string }) {
  const router = useRouter();
  const loginMutation = useLogin();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginInput) {
    setFormError(null);
    try {
      await loginMutation.mutateAsync(values);
      router.replace(isSafeInternalPath(returnTo) ? returnTo : "/dashboard");
      router.refresh();
    } catch (err) {
      setFormError(loginErrorMessage(err));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">이메일</Label>
        <Input id="email" type="email" {...register("email")} />
        {errors.email && <p className="text-destructive text-sm">{errors.email.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">비밀번호</Label>
        <Input id="password" type="password" {...register("password")} />
        {errors.password && <p className="text-destructive text-sm">{errors.password.message}</p>}
      </div>
      {formError && <p className="text-destructive text-sm">{formError}</p>}
      <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
        {loginMutation.isPending ? "로그인 중…" : "로그인"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Signup form** — `src/features/auth/ui/signup-form.tsx`

```tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { HttpError } from "@/shared/api/http";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { signupSchema, type SignupInput } from "../model/schema";
import { useSignup } from "../api/use-auth";

function signupErrorMessage(err: unknown): string {
  if (err instanceof HttpError) {
    if (err.code === "EMAIL_TAKEN") return "이미 가입된 이메일입니다.";
    if (err.code === "RATE_LIMITED") return "잠시 후 다시 시도해주세요.";
    if (err.code === "SIGNUP_FAILED" || err.code === "VALIDATION_ERROR") {
      return "가입에 실패했습니다. 입력을 확인해주세요.";
    }
  }
  return "회원가입 중 오류가 발생했습니다.";
}

export function SignupForm() {
  const router = useRouter();
  const signupMutation = useSignup();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupInput>({ resolver: zodResolver(signupSchema) });

  async function onSubmit(values: SignupInput) {
    setFormError(null);
    try {
      await signupMutation.mutateAsync(values);
      router.replace("/pending");
      router.refresh();
    } catch (err) {
      setFormError(signupErrorMessage(err));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">이름</Label>
        <Input id="name" type="text" {...register("name")} />
        {errors.name && <p className="text-destructive text-sm">{errors.name.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">이메일</Label>
        <Input id="email" type="email" {...register("email")} />
        {errors.email && <p className="text-destructive text-sm">{errors.email.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">비밀번호</Label>
        <Input id="password" type="password" {...register("password")} />
        {errors.password && <p className="text-destructive text-sm">{errors.password.message}</p>}
      </div>
      {formError && <p className="text-destructive text-sm">{formError}</p>}
      <Button type="submit" className="w-full" disabled={signupMutation.isPending}>
        {signupMutation.isPending ? "가입 중…" : "가입하기"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 3: Logout button** — `src/features/auth/ui/logout-button.tsx`

```tsx
"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/shared/ui/button";
import { useLogout } from "../api/use-auth";

export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  const logoutMutation = useLogout();

  async function onClick() {
    // Always navigate to /login even if the POST fails (network/500/403) — the old server
    // action redirected unconditionally; the proxy re-gates /dashboard if the cookie survived.
    try {
      await logoutMutation.mutateAsync();
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      className={className}
      onClick={onClick}
      disabled={logoutMutation.isPending}
    >
      로그아웃
    </Button>
  );
}
```

> Both current logout call-sites use `variant="outline"`, so it is hardcoded; `className` carries the layout's `w-full`. `type="button"` is explicit (Base UI default, but it's no longer inside a `<form>`).

- [ ] **Step 4: Barrel** — `src/features/auth/index.ts` (client-safe only; NO `auth.server.ts`)

```ts
export { LoginForm } from "./ui/login-form";
export { SignupForm } from "./ui/signup-form";
export { LogoutButton } from "./ui/logout-button";
```

- [ ] **Step 5: Typecheck + lint + build** — Node ≥22, `npx tsc --noEmit && npm run lint && npm run build` → PASS. (Forms not yet wired to routes; this verifies the slice compiles.)

- [ ] **Step 6: Format + commit**

```bash
npx prettier --write src/features/auth/ui src/features/auth/index.ts
git add -A
git commit -m "feat: features/auth UI (login/signup forms + logout button) + barrel (Stage 1b)"
```

---

### Task 8: Wire auth pages + flip routes + delete server actions

**Files:**

- Create: `src/pages/login/ui/login-page.tsx`, `src/pages/login/index.ts`
- Create: `src/pages/signup/ui/signup-page.tsx`, `src/pages/signup/index.ts`
- Create: `src/pages/pending/ui/pending-page.tsx`, `src/pages/pending/index.ts`
- Modify: `app/(auth)/login/page.tsx` (→ re-export)
- Modify: `app/(auth)/signup/page.tsx` (→ re-export)
- Modify: `app/pending/page.tsx` (→ re-export)
- Modify: `app/(dashboard)/layout.tsx` (logout `<form>` → `<LogoutButton/>`)
- Delete: `app/(auth)/actions.ts`

> Pages are server components that render the Card shell, then mount the client form. **`returnTo` is read in the `app/` route, not the page composition:** the proven re-export precedents in this repo (`proposals/page.tsx`, `new/page.tsx`) are all prop-less; a page that takes `searchParams` is exercised by Next 16's generated `PageProps` validators against the route's **default export**. To stay on the proven path, the login `app/` route defines the default export **locally** (owning the `searchParams` contract) and passes `returnTo` down to `LoginPage`, which takes a plain prop. Signup/pending need no params, so they keep the bare re-export. This flips every auth route at once and removes the last server-action importer, so `actions.ts` can be deleted.

- [ ] **Step 1: Login page composition** — `src/pages/login/ui/login-page.tsx` (takes a plain `returnTo` prop; the route awaits `searchParams` in Step 4)

```tsx
import { LoginForm } from "@/features/auth";
import { Card } from "@/shared/ui/card";

export function LoginPage({ returnTo }: { returnTo?: string }) {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-sm p-8">
        <h1 className="text-2xl font-semibold tracking-tight">로그인</h1>
        <LoginForm returnTo={returnTo} />
        <a href="/signup" className="mt-4 block text-sm underline">
          계정이 없으신가요? 가입
        </a>
      </Card>
    </div>
  );
}
```

`src/pages/login/index.ts`:

```ts
export { LoginPage } from "./ui/login-page";
```

- [ ] **Step 2: Signup page composition** — `src/pages/signup/ui/signup-page.tsx`

```tsx
import { SignupForm } from "@/features/auth";
import { Card } from "@/shared/ui/card";

export function SignupPage() {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-sm p-8">
        <h1 className="text-2xl font-semibold tracking-tight">회원가입</h1>
        <p className="text-muted-foreground mt-2 text-sm">가입 후 관리자 승인이 필요합니다.</p>
        <SignupForm />
        <a href="/login" className="mt-4 block text-sm underline">
          이미 계정이 있으신가요? 로그인
        </a>
      </Card>
    </div>
  );
}
```

`src/pages/signup/index.ts`:

```ts
export { SignupPage } from "./ui/signup-page";
```

- [ ] **Step 3: Pending page composition** — `src/pages/pending/ui/pending-page.tsx`

```tsx
import { LogoutButton } from "@/features/auth";

export function PendingPage() {
  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">승인 대기 중</h1>
      <p className="text-muted-foreground text-sm">관리자 승인 후 시안을 관리할 수 있습니다.</p>
      <LogoutButton />
    </div>
  );
}
```

`src/pages/pending/index.ts`:

```ts
export { PendingPage } from "./ui/pending-page";
```

- [ ] **Step 4: Flip the routes** — replace the entire contents of each.

`app/(auth)/login/page.tsx` (local default owns the `searchParams` contract, then delegates):

```tsx
import { LoginPage } from "@/pages/login";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { returnTo } = await searchParams;
  return <LoginPage returnTo={returnTo} />;
}
```

`app/(auth)/signup/page.tsx` (prop-less → bare re-export):

```tsx
export { SignupPage as default } from "@/pages/signup";
```

`app/pending/page.tsx` (prop-less → bare re-export):

```tsx
export { PendingPage as default } from "@/pages/pending";
```

- [ ] **Step 5: Swap the dashboard logout button** — in `app/(dashboard)/layout.tsx`: remove `import { logout } from "../(auth)/actions";` and `import { Button } from "@/shared/ui/button";`, add `import { LogoutButton } from "@/features/auth";`, and replace the logout `<form>…</form>` (currently `<form action={logout} className="mt-6"><Button type="submit" variant="outline" className="w-full">로그아웃</Button></form>`) with:

```tsx
<LogoutButton className="mt-6 w-full" />
```

> **Importer note:** `logout` has THREE live importers — `app/(auth)/login/page.tsx`/`signup/page.tsx` import `login`/`signup`, and BOTH `app/pending/page.tsx` AND `app/(dashboard)/layout.tsx` import `logout`. Step 4 replaces the whole contents of the login/signup/**pending** route files (re-exports), and Step 5 rewrites the layout — so after Steps 4–5 nothing imports `app/(auth)/actions.ts`. Run Steps 4 + 5 strictly BEFORE Step 6's delete, or tsc breaks.

- [ ] **Step 6: Delete the server actions + verify nothing imports them** (only after Steps 4–5)

```bash
git rm "app/(auth)/actions.ts"
grep -rn "(auth)/actions\|from \"../actions\"" app src   # expect NO output
```

- [ ] **Step 7: Typecheck + lint + build** — Node ≥22, `npx tsc --noEmit && npm run lint && npm run build` → PASS. The `/login`, `/signup`, `/pending` routes plus `/api/auth/*` are present; `app/(auth)/actions.ts` is gone.

- [ ] **Step 8: Manual smoke** — `npm run dev`:
  1. `/login` empty submit → inline "올바른 이메일을 입력하세요" / "비밀번호를 입력하세요".
  2. wrong creds → inline "이메일 또는 비밀번호가 올바르지 않습니다." (no `?error=` in the URL).
  3. valid editor login → lands on `/dashboard` (or `returnTo` if `?returnTo=/dashboard/proposals`, but never an external URL).
  4. `/signup` with an existing email → "이미 가입된 이메일입니다."; a fresh signup → `/pending`.
  5. logout from the dashboard sidebar and from `/pending` → back to `/login`; revisiting `/dashboard` redirects to `/login` (middleware).
     Stop dev. (If no Supabase env, do 1 + 2 via the form validation path and note the rest as deferred.)

- [ ] **Step 9: Format + commit**

```bash
npx prettier --write src/pages/login src/pages/signup src/pages/pending "app/(auth)/login/page.tsx" "app/(auth)/signup/page.tsx" "app/pending/page.tsx" "app/(dashboard)/layout.tsx"
git add -A
git commit -m "feat: auth pages via features/auth + route handlers; drop server actions (Stage 1b)"
```

---

### Task 9: Stage 1b verification gate

**Files:** none (verification only)

- [ ] **Step 1: Full green gate** — Node ≥22: `npx tsc --noEmit && npm run lint && npm test && npm run build` → all PASS. Report the test count as a DELTA from the pre-Stage-1b baseline (capture `npm test` count first if unsure): this adds +4 to-error-response, +6 schema, +3 signup-error (the relocated safe-redirect test moves, not added) → **+13 tests**. Report the route table as a DELTA too: **+3 `/api/auth/{login,signup,logout}`**; page routes are unchanged in count because every migrated page becomes a re-export of the same route path. Do NOT assert a hardcoded absolute count — read the actual `next build` route table.

- [ ] **Step 2: No-SSR check** — the migrated auth pages/feature must not fetch data on the server (the `/` redirect is the only intentional server boundary, and it does auth gating, not data fetching):

```bash
grep -rn "@/shared/db\|@drizzle/schema\|@/shared/storage\"" src/pages/login src/pages/signup src/pages/pending src/pages/dashboard-home src/features/auth
```

Expected: NO output.

- [ ] **Step 3: FSD layering + barrel safety**

```bash
grep -rn "@/features/\|@/widgets/\|@/pages/" src/entities src/shared   # expect empty
grep -rn "@/widgets/\|@/pages/" src/features                           # expect empty
grep -rn "\.server" src/features/auth/index.ts                         # expect empty (no server fn in barrel)
grep -rn "@/legacy" src/pages/home src/pages/dashboard-home src/pages/login src/pages/signup src/pages/pending src/features/auth   # expect empty
```

All expected empty.

- [ ] **Step 4: server-only safety** — two checks. (a) No `"use client"` module **directly** imports a server module:

```bash
grep -rln "use client" src/features/auth src/pages | xargs grep -l "\.server\"\|@/shared/supabase/service\|@/shared/storage\"" 2>/dev/null
```

Expected: NO output. (b) Because (a) is a direct-import check only, also assert the non-`"use client"` intermediates the forms import (`auth.ts`, `use-auth.ts`, `schema.ts`) are themselves server-free, so the whole client chain `login-form → use-auth → auth → http` cannot reach a `.server` module:

```bash
grep -rn "\.server\"\|@/shared/supabase/service\|@/shared/storage\"" src/features/auth/api/auth.ts src/features/auth/api/use-auth.ts src/features/auth/model/schema.ts
```

Expected: NO output. (The barrel exports UI only; `auth.server.ts` is reached solely by the route handlers in `app/api/auth/*`.)

- [ ] **Step 5: Old server-action surface is gone**

```bash
test ! -f "app/(auth)/actions.ts" && echo "actions.ts deleted OK"
grep -rn "action={login}\|action={signup}\|action={logout}\|from \"../actions\"" app src   # expect empty
```

- [ ] **Step 6: Final commit (only if fixups were needed)**

```bash
git add -A && git commit -m "chore: Stage 1b verification fixups" || echo "nothing to commit"
```

- [ ] **Step 7: Update the handoff** — in `docs/superpowers/HANDOFF.md`, move Stage 1b from "Next steps" into "Done so far" (note: auth migrated to **route handlers**, not server actions, per the user's decision; `isSafeInternalPath` now lives in `src/shared/lib`), and set the next step to **Stage 2** (variants/versions + proposal-detail, including the guarded editor-images GET). Commit:

```bash
npx prettier --write docs/superpowers/HANDOFF.md
git add docs/superpowers/HANDOFF.md
git commit -m "docs: handoff — Stage 1b done (auth via route handlers), next = Stage 2"
```

---

## Self-Review (completed by author)

- **Spec/handoff coverage:** `/` redirect → `src/pages/home` (Task 1, server boundary kept); dashboard home → `src/pages/dashboard-home` (Task 1); `(auth)` login/signup + pending → `src/pages/{login,signup,pending}` + `features/auth` (Tasks 4–8); Supabase auth via **route handlers** per the user's decision (Tasks 5–6), not server actions; logout also converted (Task 7 button, Task 8 wiring) per the user's decision. `isSafeInternalPath` promoted to shared for the client redirect target (Task 2). Verification incl. no-SSR + FSD + server-only gates (Task 9).
- **Deviation from handoff (documented + user-approved):** auth uses route handlers + `useMutation` rather than retained server actions; `app/(auth)/actions.ts` is deleted. This makes auth consistent with the proposals slice.
- **Placeholder scan:** none — every code/command step is concrete.
- **Type consistency:** `loginSchema`/`signupSchema` + `LoginInput`/`SignupInput` (Task 4) consumed by `auth.server.ts` (Task 5), client fetchers (Task 6), and forms (Task 7). `signupErrorCode` (Task 4) consumed by `signUp` (Task 5). `signIn`/`signUp`/`signOut` (Task 5) consumed by the route handlers (Task 5). `login`/`signup`/`logout` fetchers (Task 6) consumed by `useLogin`/`useSignup`/`useLogout` (Task 6) consumed by the forms/button (Task 7). `LoginForm`/`SignupForm`/`LogoutButton` (Task 7) consumed by pages + dashboard layout (Task 8). Error codes `INVALID_CREDENTIALS`/`EMAIL_TAKEN`/`SIGNUP_FAILED` (Task 3) produced by Task 5 and read by Task 7 forms. `isSafeInternalPath` (Task 2) consumed by `LoginForm` (Task 7).
- **Ordering keeps the tree green:** Task 2 repoints `actions.ts` to the moved helper (so tsc passes) before Task 8 deletes it. Forms (Task 7) compile against schema/hooks built in Tasks 4–6. Routes are flipped only in Task 8, after the whole `features/auth` slice exists.
- **Known edges (carried/accepted):** malformed JSON body → `await req.json()` throws → 500 `INTERNAL_ERROR` (same class of edge documented in Stage 1); Supabase duplicate-email detection is config-dependent (mapper matches code first, message fallback — tested); `http()` still drops server message text (forms use code→Korean maps).

**Adversarial audit (4 lenses: FSD / Next16-RQ-RHF-Zod / behavior-security / executability; high+ findings independently refute-verified):**

- **Linchpin verified clean:** Supabase auth in a Route Handler DOES set/clear session cookies — Next 16 `cookies().set` works in Route Handlers (docs `…/functions/cookies.md`), and `createSupabaseServer()`'s try/catch only swallows the Server-Component case. No blockers/high confirmed.
- Fixed (medium): login `app/` route now defines its default export **locally** to own the `searchParams` contract (re-exporting a params-taking page through a barrel was unverified against Next 16 generated `PageProps`); `LoginPage` takes a plain `returnTo` prop. Signup/pending keep bare re-exports.
- Fixed (medium): logout button wraps navigation in `try/finally` so it always reaches `/login` even if the POST fails (matches the old unconditional server-action redirect).
- Fixed (medium): Task 8 now explicitly calls out `app/pending/page.tsx` as the third `logout` importer and enforces Step 4–5 before the Step 6 delete.
- Fixed (low): Supabase 429s surface as `RATE_LIMITED` (429) instead of collapsing to `INVALID_CREDENTIALS`; Task 9 route/test counts report DELTAs not absolutes; Task 9 server-only gate adds an intermediate-module check; documented the no-app-rate-limiting tradeoff as a deferred follow-up.

## Next: Stage 2

After Stage 1b lands: Stage 2 (variants/versions + proposal-detail, currently legacy RSC), including the `requireEditor`-guarded editor-images GET the spec/audit flagged, and migrating the legacy `add-variant-form`/`add-version-form` to `features/{add-variant,add-version}`.
