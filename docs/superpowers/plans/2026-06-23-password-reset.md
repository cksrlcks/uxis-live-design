# 비밀번호 재설정 (이메일 링크) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 로그인하지 않은 사용자가 이메일 링크를 통해 비밀번호를 재설정할 수 있는 end-to-end 플로우를 추가한다.

**Architecture:** Supabase Auth `resetPasswordForEmail`로 재설정 메일을 보내고, 이메일 링크는 `token_hash`를 담아 `GET /auth/confirm`로 들어온다. 거기서 `verifyOtp({ type: "recovery" })`로 recovery 세션을 만들고 `/reset-password`로 보낸다. 새 비밀번호 페이지는 세션을 가드한 뒤 `updateUser` 후 `signOut`하고 로그인 화면으로 복귀시킨다. 기존 패턴(API route → `.server.ts` 서버 액션 / react-hook-form + zod / Base UI / react-query 훅)을 그대로 따른다.

**Tech Stack:** Next.js 16 (App Router, Route Handlers), `@supabase/ssr`, react-hook-form, zod v4, @tanstack/react-query, Base UI, Tailwind v4, vitest.

설계 문서: [docs/superpowers/specs/2026-06-23-password-reset-design.md](../specs/2026-06-23-password-reset-design.md)

## Global Constraints

- Node ≥ 22 (package.json `engines`).
- Next.js 16 App Router. Route Handlers는 Web `Request`/`Response`(또는 `NextResponse`) 사용. `searchParams`/`cookies()`/`headers()`는 `await` 필요(Promise).
- Base UI `Button`은 기본 `type="button"` → **submit 버튼은 반드시 `type="submit"`** 명시.
- zod v4: 이메일은 `z.email(...)`.
- 오픈 리다이렉트 방지는 기존 `isSafeInternalPath`(`@/shared/lib/safe-redirect`) **재사용**(새 헬퍼 만들지 않음).
- 이메일 열거 방지: 요청 단계는 존재 여부와 무관하게 동일 성공(429만 구분).
- 모든 사용자 노출 문구는 한국어.
- `auth.server.ts`는 `import "server-only"`를 포함 → 단위 테스트에서 `vi.mock("server-only", () => ({}))` 필요.
- 에러 코드(`RATE_LIMITED`/`WEAK_PASSWORD`/`SAME_PASSWORD`/`PASSWORD_UPDATE_FAILED`/`UNAUTHORIZED`)는 이미 `to-error-response.ts`의 `STATUS_BY_CODE`에 존재 → **그 파일은 수정 불필요**.

## File Structure

**생성**
- `src/features/auth/ui/forgot-password-form.tsx` — 이메일 요청 폼(클라이언트)
- `src/features/auth/ui/reset-password-form.tsx` — 새 비밀번호 폼(클라이언트)
- `src/pages/forgot-password/ui/forgot-password-page.tsx` + `src/pages/forgot-password/index.ts`
- `src/pages/reset-password/ui/reset-password-page.tsx` + `src/pages/reset-password/index.ts`
- `app/(auth)/forgot-password/page.tsx` — 요청 페이지(서버)
- `app/(auth)/reset-password/page.tsx` — 새 비밀번호 페이지(서버, 세션 가드)
- `app/auth/confirm/route.ts` — 링크 핸들러(GET, verifyOtp)
- `app/api/auth/forgot-password/route.ts` — POST(요청)
- `app/api/auth/reset-password/route.ts` — POST(새 비밀번호)
- `tests/features/auth/password-reset.server.test.ts` — 서버 액션 테스트

**수정**
- `src/features/auth/model/schema.ts` — `forgotPasswordSchema`/`resetPasswordSchema` + 타입
- `src/features/auth/api/auth.server.ts` — `requestPasswordReset`/`resetPassword`(+ origin 헬퍼)
- `src/features/auth/api/auth.ts` — 클라이언트 래퍼 2개
- `src/features/auth/api/use-auth.ts` — 훅 2개
- `src/features/auth/index.ts` — 새 폼 export
- `src/features/auth/ui/login-form.tsx` — "비밀번호를 잊으셨나요?" 링크 추가
- `src/pages/login/ui/login-page.tsx` — `notice` prop + 성공 배너
- `app/(auth)/login/page.tsx` — `reset=success` → notice 전달
- `tests/features/auth/schema.test.ts` — 새 스키마 테스트 추가
- `.env.example` — `NEXT_PUBLIC_SITE_URL`

---

## Task 1: 스키마 (forgotPasswordSchema, resetPasswordSchema)

**Files:**
- Modify: `src/features/auth/model/schema.ts`
- Test: `tests/features/auth/schema.test.ts`

**Interfaces:**
- Produces: `forgotPasswordSchema` (`{ email: string }`), `resetPasswordSchema` (`{ newPassword: string; confirmPassword: string }`, refine로 일치 검증), 타입 `ForgotPasswordInput`, `ResetPasswordInput`

- [ ] **Step 1: 실패하는 테스트 추가**

`tests/features/auth/schema.test.ts` 맨 위 import에 새 스키마를 추가하고, 파일 끝에 describe 블록을 추가:

```ts
// 기존 import 줄을 아래로 교체
import {
  loginSchema,
  signupSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@/features/auth/model/schema";
```

파일 맨 끝에 추가:

```ts
describe("forgotPasswordSchema", () => {
  it("accepts a valid email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "a@b.com" }).success).toBe(true);
  });
  it("rejects a malformed email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "nope" }).success).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  it("accepts matching passwords of 8+ chars", () => {
    expect(
      resetPasswordSchema.safeParse({ newPassword: "12345678", confirmPassword: "12345678" })
        .success,
    ).toBe(true);
  });
  it("rejects a password under 8 chars", () => {
    expect(
      resetPasswordSchema.safeParse({ newPassword: "1234567", confirmPassword: "1234567" }).success,
    ).toBe(false);
  });
  it("flags mismatched passwords on confirmPassword", () => {
    const r = resetPasswordSchema.safeParse({
      newPassword: "12345678",
      confirmPassword: "87654321",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path[0] === "confirmPassword")).toBe(true);
    }
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/features/auth/schema.test.ts`
Expected: FAIL — `forgotPasswordSchema`/`resetPasswordSchema` is undefined (import 에러)

- [ ] **Step 3: 스키마 구현**

`src/features/auth/model/schema.ts` 파일 끝에 추가:

```ts
export const forgotPasswordSchema = z.object({
  email: z.email("올바른 이메일을 입력하세요"),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    newPassword: z.string().min(8, "비밀번호는 8자 이상이어야 합니다"),
    confirmPassword: z.string().min(1, "비밀번호 확인을 입력하세요"),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "비밀번호가 일치하지 않습니다",
    path: ["confirmPassword"],
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/features/auth/schema.test.ts`
Expected: PASS (기존 loginSchema/signupSchema 포함 전체 통과)

- [ ] **Step 5: 커밋**

```bash
git add src/features/auth/model/schema.ts tests/features/auth/schema.test.ts
git commit -m "feat(auth): add forgot/reset password schemas"
```

---

## Task 2: 서버 액션 (requestPasswordReset, resetPassword)

**Files:**
- Modify: `src/features/auth/api/auth.server.ts`
- Test: `tests/features/auth/password-reset.server.test.ts`

**Interfaces:**
- Consumes: `forgotPasswordSchema`, `resetPasswordSchema` (Task 1), `createSupabaseServer` (`@/shared/supabase/server`)
- Produces:
  - `requestPasswordReset(input: unknown): Promise<void>` — `resetPasswordForEmail(email, { redirectTo: \`${origin}/auth/confirm\` })`. 429 → `RATE_LIMITED` throw, 그 외 에러는 무시(성공 처리).
  - `resetPassword(input: unknown): Promise<void>` — 세션 없으면 `UNAUTHORIZED`, `updateUser({ password })` 후 `signOut()`.

- [ ] **Step 1: 실패하는 테스트 작성**

Create `tests/features/auth/password-reset.server.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const resetPasswordForEmail = vi.fn();
const getUser = vi.fn();
const updateUser = vi.fn();
const signOut = vi.fn();

vi.mock("@/shared/supabase/server", () => ({
  createSupabaseServer: vi.fn(async () => ({
    auth: { resetPasswordForEmail, getUser, updateUser, signOut },
  })),
}));

const headersGet = vi.fn();
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({ get: headersGet })),
}));

import { requestPasswordReset, resetPassword } from "@/features/auth/api/auth.server";

beforeEach(() => {
  vi.clearAllMocks();
  headersGet.mockImplementation((k: string) => (k === "origin" ? "http://localhost:3000" : null));
});

describe("requestPasswordReset", () => {
  it("builds redirectTo from the request origin", async () => {
    resetPasswordForEmail.mockResolvedValue({ error: null });
    await requestPasswordReset({ email: "a@b.com" });
    expect(resetPasswordForEmail).toHaveBeenCalledWith("a@b.com", {
      redirectTo: "http://localhost:3000/auth/confirm",
    });
  });

  it("throws RATE_LIMITED on a 429", async () => {
    resetPasswordForEmail.mockResolvedValue({ error: { status: 429 } });
    await expect(requestPasswordReset({ email: "a@b.com" })).rejects.toThrow("RATE_LIMITED");
  });

  it("swallows non-429 errors (no email enumeration)", async () => {
    resetPasswordForEmail.mockResolvedValue({ error: { status: 500 } });
    await expect(requestPasswordReset({ email: "a@b.com" })).resolves.toBeUndefined();
  });

  it("rejects an invalid email before hitting Supabase", async () => {
    await expect(requestPasswordReset({ email: "nope" })).rejects.toBeTruthy();
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });
});

describe("resetPassword", () => {
  it("throws UNAUTHORIZED without a recovery session", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    await expect(
      resetPassword({ newPassword: "12345678", confirmPassword: "12345678" }),
    ).rejects.toThrow("UNAUTHORIZED");
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("updates the password then signs out", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    updateUser.mockResolvedValue({ error: null });
    signOut.mockResolvedValue({ error: null });
    await resetPassword({ newPassword: "12345678", confirmPassword: "12345678" });
    expect(updateUser).toHaveBeenCalledWith({ password: "12345678" });
    expect(signOut).toHaveBeenCalled();
  });

  it("maps weak_password to WEAK_PASSWORD and does not sign out", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    updateUser.mockResolvedValue({ error: { code: "weak_password" } });
    await expect(
      resetPassword({ newPassword: "12345678", confirmPassword: "12345678" }),
    ).rejects.toThrow("WEAK_PASSWORD");
    expect(signOut).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/features/auth/password-reset.server.test.ts`
Expected: FAIL — `requestPasswordReset`/`resetPassword` is not exported

- [ ] **Step 3: 서버 액션 구현**

`src/features/auth/api/auth.server.ts` 수정. 먼저 상단 import 두 줄을 교체/추가:

```ts
import "server-only";
import { headers } from "next/headers";
import { createSupabaseServer } from "@/shared/supabase/server";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
} from "../model/schema";
import { signupErrorCode } from "./signup-error";
```

파일 끝에 함수 추가:

```ts
// 이메일 재설정 링크의 베이스 URL. 요청 Origin을 우선 쓰고(로컬·운영 무관), 없으면
// Host 헤더, 마지막으로 NEXT_PUBLIC_SITE_URL로 폴백한다.
async function resolveOrigin(): Promise<string> {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("host");
  if (host) return `${h.get("x-forwarded-proto") ?? "https"}://${host}`;
  return process.env.NEXT_PUBLIC_SITE_URL ?? "";
}

export async function requestPasswordReset(input: unknown): Promise<void> {
  const { email } = forgotPasswordSchema.parse(input);
  const supabase = await createSupabaseServer();
  const redirectTo = `${await resolveOrigin()}/auth/confirm`;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  // 레이트 리밋만 노출. 그 외 에러는 삼켜 호출자가 이메일 존재 여부를 추측하지 못하게 한다.
  if (error?.status === 429) throw new Error("RATE_LIMITED");
}

export async function resetPassword(input: unknown): Promise<void> {
  const { newPassword } = resetPasswordSchema.parse(input);
  const supabase = await createSupabaseServer();

  // recovery 세션(=verifyOtp 성공)이 있어야만 갱신 가능.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("UNAUTHORIZED");

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    if (error.status === 429) throw new Error("RATE_LIMITED");
    if (error.code === "same_password") throw new Error("SAME_PASSWORD");
    if (error.code === "weak_password") throw new Error("WEAK_PASSWORD");
    throw new Error("PASSWORD_UPDATE_FAILED");
  }

  // recovery 세션은 역할을 다했으니 종료 → 새 비밀번호로 재로그인하게 한다.
  await supabase.auth.signOut();
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/features/auth/password-reset.server.test.ts`
Expected: PASS (7개 테스트 전부)

- [ ] **Step 5: 커밋**

```bash
git add src/features/auth/api/auth.server.ts tests/features/auth/password-reset.server.test.ts
git commit -m "feat(auth): add requestPasswordReset/resetPassword server actions"
```

---

## Task 3: API 라우트 (forgot-password / reset-password POST)

**Files:**
- Create: `app/api/auth/forgot-password/route.ts`
- Create: `app/api/auth/reset-password/route.ts`

**Interfaces:**
- Consumes: `requestPasswordReset`, `resetPassword` (Task 2), `toErrorResponse` (`@/shared/api/to-error-response`)
- Produces: `POST /api/auth/forgot-password`, `POST /api/auth/reset-password` (성공 204)

- [ ] **Step 1: forgot-password 라우트 작성**

Create `app/api/auth/forgot-password/route.ts`:

```ts
import { NextRequest } from "next/server";
import { requestPasswordReset } from "@/features/auth/api/auth.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

export async function POST(req: NextRequest) {
  try {
    await requestPasswordReset(await req.json());
    return new Response(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
```

- [ ] **Step 2: reset-password 라우트 작성**

Create `app/api/auth/reset-password/route.ts`:

```ts
import { NextRequest } from "next/server";
import { resetPassword } from "@/features/auth/api/auth.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

export async function POST(req: NextRequest) {
  try {
    await resetPassword(await req.json());
    return new Response(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
```

- [ ] **Step 3: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 4: 커밋**

```bash
git add app/api/auth/forgot-password/route.ts app/api/auth/reset-password/route.ts
git commit -m "feat(auth): add forgot/reset password API routes"
```

---

## Task 4: 링크 핸들러 `GET /auth/confirm`

**Files:**
- Create: `app/auth/confirm/route.ts`

**Interfaces:**
- Consumes: `createSupabaseServer` (`@/shared/supabase/server`), `isSafeInternalPath` (`@/shared/lib/safe-redirect`)
- Produces: `GET /auth/confirm?token_hash=&type=&next=` → verifyOtp 성공 시 `next`(검증된 내부 경로, 기본 `/reset-password`)로 redirect, 실패 시 `/forgot-password?error=invalid`로 redirect

- [ ] **Step 1: 라우트 작성**

Create `app/auth/confirm/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServer } from "@/shared/supabase/server";
import { isSafeInternalPath } from "@/shared/lib/safe-redirect";

// 비밀번호 재설정 메일 링크의 착지점. token_hash를 verifyOtp로 검증해 recovery 세션 쿠키를
// 심고(= createSupabaseServer의 쿠키 어댑터가 응답에 반영), next로 보낸다.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const rawNext = searchParams.get("next");
  const next = isSafeInternalPath(rawNext) ? rawNext : "/reset-password";

  if (tokenHash && type) {
    const supabase = await createSupabaseServer();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(new URL(next, req.url));
    }
  }

  return NextResponse.redirect(new URL("/forgot-password?error=invalid", req.url));
}
```

- [ ] **Step 2: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음 (`EmailOtpType`은 `@supabase/supabase-js`에서 제공)

- [ ] **Step 3: 커밋**

```bash
git add app/auth/confirm/route.ts
git commit -m "feat(auth): add /auth/confirm recovery link handler"
```

---

## Task 5: 클라이언트 API 래퍼 + react-query 훅

**Files:**
- Modify: `src/features/auth/api/auth.ts`
- Modify: `src/features/auth/api/use-auth.ts`

**Interfaces:**
- Consumes: `ForgotPasswordInput`, `ResetPasswordInput` (Task 1), `http` (`@/shared/api/http`)
- Produces: `requestPasswordReset(input)`, `resetPassword(input)` (client), `useRequestPasswordReset()`, `useResetPassword()`

- [ ] **Step 1: 클라이언트 래퍼 추가**

`src/features/auth/api/auth.ts` 상단 타입 import를 교체:

```ts
import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  ResetPasswordInput,
  SignupInput,
} from "../model/schema";
```

파일 끝에 추가:

```ts
export function requestPasswordReset(input: ForgotPasswordInput): Promise<void> {
  return http<void>("/api/auth/forgot-password", { method: "POST", body: JSON.stringify(input) });
}

export function resetPassword(input: ResetPasswordInput): Promise<void> {
  return http<void>("/api/auth/reset-password", { method: "POST", body: JSON.stringify(input) });
}
```

- [ ] **Step 2: 훅 추가**

`src/features/auth/api/use-auth.ts` 상단 import를 교체:

```ts
import {
  login,
  signup,
  logout,
  changePassword,
  requestPasswordReset,
  resetPassword,
} from "./auth";
```

파일 끝에 추가:

```ts
export function useRequestPasswordReset() {
  return useMutation({ mutationFn: requestPasswordReset });
}

export function useResetPassword() {
  return useMutation({ mutationFn: resetPassword });
}
```

- [ ] **Step 3: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 4: 커밋**

```bash
git add src/features/auth/api/auth.ts src/features/auth/api/use-auth.ts
git commit -m "feat(auth): add password reset client api + hooks"
```

---

## Task 6: 비밀번호 찾기 화면 (폼 + 페이지 + 라우트 + 로그인 진입점)

**Files:**
- Create: `src/features/auth/ui/forgot-password-form.tsx`
- Create: `src/pages/forgot-password/ui/forgot-password-page.tsx`
- Create: `src/pages/forgot-password/index.ts`
- Create: `app/(auth)/forgot-password/page.tsx`
- Modify: `src/features/auth/index.ts`
- Modify: `src/features/auth/ui/login-form.tsx`

**Interfaces:**
- Consumes: `forgotPasswordSchema`/`ForgotPasswordInput` (Task 1), `useRequestPasswordReset` (Task 5), `AuthLayout` (`@/features/auth`), `Button`/`buttonVariants`/`Input`/`Label` (`@/shared/ui/*`)
- Produces: `ForgotPasswordForm`, `ForgotPasswordPage`(prop `notice?: string`), 라우트 `/forgot-password`

- [ ] **Step 1: 폼 작성**

Create `src/features/auth/ui/forgot-password-form.tsx`:

```tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import Link from "next/link";
import { HttpError } from "@/shared/api/http";
import { Button, buttonVariants } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { forgotPasswordSchema, type ForgotPasswordInput } from "../model/schema";
import { useRequestPasswordReset } from "../api/use-auth";

function requestErrorMessage(err: unknown): string {
  if (err instanceof HttpError && err.code === "RATE_LIMITED") {
    return "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.";
  }
  return "메일 발송 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
}

export function ForgotPasswordForm() {
  const requestMutation = useRequestPasswordReset();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });

  async function onSubmit(values: ForgotPasswordInput) {
    setFormError(null);
    try {
      await requestMutation.mutateAsync(values);
      setSentTo(values.email);
    } catch (err) {
      setFormError(requestErrorMessage(err));
    }
  }

  if (sentTo) {
    return (
      <div className="space-y-4">
        <p className="text-sm leading-relaxed">
          <span className="font-medium">{sentTo}</span> 주소로 비밀번호 재설정 링크를 보냈습니다.
          받은 편지함과 스팸함을 확인해주세요.
        </p>
        <Link
          href="/login"
          className={buttonVariants({ className: "h-12 w-full rounded-lg text-base font-semibold" })}
        >
          로그인으로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2.5">
        <Label htmlFor="email" className="text-muted-foreground font-normal">
          이메일
        </Label>
        <Input
          id="email"
          type="email"
          placeholder="you@example.com"
          className="h-12 rounded-lg px-4"
          {...register("email")}
        />
        {errors.email && <p className="text-destructive text-sm">{errors.email.message}</p>}
      </div>
      {formError && <p className="text-destructive text-sm">{formError}</p>}
      <Button
        type="submit"
        className="h-12 w-full rounded-lg text-base font-semibold"
        disabled={requestMutation.isPending}
      >
        {requestMutation.isPending ? "전송 중…" : "재설정 링크 보내기"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: 페이지 컴포넌트 + barrel 작성**

Create `src/pages/forgot-password/ui/forgot-password-page.tsx`:

```tsx
import Link from "next/link";
import { AuthLayout, ForgotPasswordForm } from "@/features/auth";

export function ForgotPasswordPage({ notice }: { notice?: string }) {
  return (
    <AuthLayout
      title="비밀번호 재설정"
      subtitle="가입하신 이메일로 재설정 링크를 보내드립니다"
      footer={
        <>
          비밀번호가 기억나셨나요?{" "}
          <Link
            href="/login"
            className="text-foreground font-medium underline-offset-4 hover:underline"
          >
            로그인
          </Link>
        </>
      }
    >
      {notice && (
        <p className="border-destructive/30 bg-destructive/10 text-destructive mb-4 rounded-lg border px-4 py-3 text-sm">
          {notice}
        </p>
      )}
      <ForgotPasswordForm />
    </AuthLayout>
  );
}
```

Create `src/pages/forgot-password/index.ts`:

```ts
export { ForgotPasswordPage } from "./ui/forgot-password-page";
```

- [ ] **Step 3: 새 폼 export (찾기 폼만)**

`src/features/auth/index.ts`의 `LoginForm` export 줄 아래에 추가. `ResetPasswordForm`은 아직 파일이 없으므로 **여기서는 추가하지 않는다**(Task 7에서 추가):

```ts
export { ForgotPasswordForm } from "./ui/forgot-password-form";
```

- [ ] **Step 4: 앱 라우트 작성**

Create `app/(auth)/forgot-password/page.tsx`:

```tsx
import { ForgotPasswordPage } from "@/pages/forgot-password";

const ERROR_NOTICES: Record<string, string> = {
  invalid: "링크가 유효하지 않거나 만료되었습니다. 다시 요청해주세요.",
  expired: "링크가 만료되었습니다. 다시 요청해주세요.",
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return <ForgotPasswordPage notice={error ? ERROR_NOTICES[error] : undefined} />;
}
```

- [ ] **Step 5: 로그인 폼에 진입 링크 추가**

`src/features/auth/ui/login-form.tsx` 상단 import에 추가:

```tsx
import Link from "next/link";
```

비밀번호 입력 블록(`</div>` 닫힘, `{errors.password && ...}` 포함하는 div)과 `{formError && ...}` 사이에 아래 블록을 삽입:

```tsx
      <div className="flex justify-end">
        <Link
          href="/forgot-password"
          className="text-muted-foreground text-sm underline-offset-4 hover:underline"
        >
          비밀번호를 잊으셨나요?
        </Link>
      </div>
```

- [ ] **Step 6: 타입 체크 + 빌드**

Run: `npx tsc --noEmit`
Expected: 에러 없음

(주의: `src/features/auth/index.ts`에 `ResetPasswordForm` export를 넣었다면 이 단계에서 실패한다. Step 3대로 `ForgotPasswordForm`만 export했는지 확인.)

- [ ] **Step 7: 커밋**

```bash
git add src/features/auth/ui/forgot-password-form.tsx src/pages/forgot-password app/(auth)/forgot-password src/features/auth/index.ts src/features/auth/ui/login-form.tsx
git commit -m "feat(auth): add forgot-password page + login entry link"
```

---

## Task 7: 새 비밀번호 화면 (폼 + 페이지 + 세션 가드 라우트)

**Files:**
- Create: `src/features/auth/ui/reset-password-form.tsx`
- Create: `src/pages/reset-password/ui/reset-password-page.tsx`
- Create: `src/pages/reset-password/index.ts`
- Create: `app/(auth)/reset-password/page.tsx`
- Modify: `src/features/auth/index.ts`

**Interfaces:**
- Consumes: `resetPasswordSchema`/`ResetPasswordInput` (Task 1), `useResetPassword` (Task 5), `getSessionUser` (`@/shared/auth/guards.server`), `AuthLayout`, `Button`/`Input`/`Label`
- Produces: `ResetPasswordForm`, `ResetPasswordPage`, 라우트 `/reset-password`(세션 없으면 `/forgot-password?error=expired`로 redirect)

- [ ] **Step 1: 폼 작성**

Create `src/features/auth/ui/reset-password-form.tsx`:

```tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { HttpError } from "@/shared/api/http";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { resetPasswordSchema, type ResetPasswordInput } from "../model/schema";
import { useResetPassword } from "../api/use-auth";

function resetErrorMessage(err: unknown): string {
  if (err instanceof HttpError) {
    if (err.code === "WEAK_PASSWORD") return "더 안전한 비밀번호를 입력해주세요.";
    if (err.code === "SAME_PASSWORD") return "이전과 다른 비밀번호를 입력해주세요.";
    if (err.code === "RATE_LIMITED") return "잠시 후 다시 시도해주세요.";
    if (err.code === "UNAUTHORIZED") return "링크가 만료되었습니다. 다시 요청해주세요.";
  }
  return "비밀번호 변경 중 오류가 발생했습니다.";
}

export function ResetPasswordForm() {
  const resetMutation = useResetPassword();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordInput>({ resolver: zodResolver(resetPasswordSchema) });

  async function onSubmit(values: ResetPasswordInput) {
    setFormError(null);
    try {
      await resetMutation.mutateAsync(values);
      // 서버에서 recovery 세션을 막 종료했으므로 전체 문서 로드로 클라이언트 캐시를 비우고
      // 로그인 페이지를 성공 안내와 함께 새로 렌더한다.
      window.location.replace("/login?reset=success");
    } catch (err) {
      setFormError(resetErrorMessage(err));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2.5">
        <Label htmlFor="newPassword" className="text-muted-foreground font-normal">
          새 비밀번호
        </Label>
        <Input
          id="newPassword"
          type="password"
          placeholder="8자 이상"
          className="h-12 rounded-lg px-4"
          {...register("newPassword")}
        />
        {errors.newPassword && (
          <p className="text-destructive text-sm">{errors.newPassword.message}</p>
        )}
      </div>
      <div className="space-y-2.5">
        <Label htmlFor="confirmPassword" className="text-muted-foreground font-normal">
          새 비밀번호 확인
        </Label>
        <Input
          id="confirmPassword"
          type="password"
          placeholder="비밀번호를 다시 입력하세요"
          className="h-12 rounded-lg px-4"
          {...register("confirmPassword")}
        />
        {errors.confirmPassword && (
          <p className="text-destructive text-sm">{errors.confirmPassword.message}</p>
        )}
      </div>
      {formError && <p className="text-destructive text-sm">{formError}</p>}
      <Button
        type="submit"
        className="h-12 w-full rounded-lg text-base font-semibold"
        disabled={resetMutation.isPending}
      >
        {resetMutation.isPending ? "변경 중…" : "비밀번호 변경"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: 페이지 컴포넌트 + barrel 작성**

Create `src/pages/reset-password/ui/reset-password-page.tsx`:

```tsx
import { AuthLayout, ResetPasswordForm } from "@/features/auth";

export function ResetPasswordPage() {
  return (
    <AuthLayout title="새 비밀번호 설정" subtitle="새로 사용할 비밀번호를 입력해주세요" footer={null}>
      <ResetPasswordForm />
    </AuthLayout>
  );
}
```

Create `src/pages/reset-password/index.ts`:

```ts
export { ResetPasswordPage } from "./ui/reset-password-page";
```

- [ ] **Step 3: 새 폼 export**

`src/features/auth/index.ts`의 `ForgotPasswordForm` export 줄 아래에 추가:

```ts
export { ResetPasswordForm } from "./ui/reset-password-form";
```

- [ ] **Step 4: 세션 가드 라우트 작성**

Create `app/(auth)/reset-password/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getSessionUser } from "@/shared/auth/guards.server";
import { ResetPasswordPage } from "@/pages/reset-password";

export default async function Page() {
  // /auth/confirm가 심은 recovery 세션이 있어야 진입 가능. 없으면 직접 접근/만료로 간주.
  const user = await getSessionUser();
  if (!user) redirect("/forgot-password?error=expired");
  return <ResetPasswordPage />;
}
```

- [ ] **Step 5: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 6: 커밋**

```bash
git add src/features/auth/ui/reset-password-form.tsx src/pages/reset-password app/(auth)/reset-password src/features/auth/index.ts
git commit -m "feat(auth): add reset-password page with recovery session guard"
```

---

## Task 8: 로그인 성공 안내 + 환경 변수 + 최종 빌드

**Files:**
- Modify: `src/pages/login/ui/login-page.tsx`
- Modify: `app/(auth)/login/page.tsx`
- Modify: `.env.example`

**Interfaces:**
- Consumes: `LoginPage`(prop `notice?: string` 추가)
- Produces: `/login?reset=success` → 성공 배너 표시

- [ ] **Step 1: LoginPage에 notice prop 추가**

`src/pages/login/ui/login-page.tsx`를 아래로 교체:

```tsx
import Link from "next/link";
import { AuthLayout, LoginForm } from "@/features/auth";

export function LoginPage({ returnTo, notice }: { returnTo?: string; notice?: string }) {
  const signupHref = returnTo ? `/signup?returnTo=${encodeURIComponent(returnTo)}` : "/signup";
  return (
    <AuthLayout
      title="로그인"
      subtitle="가입하신 이메일로 로그인해주세요"
      footer={
        <>
          계정이 없으신가요?{" "}
          <Link
            href={signupHref}
            className="text-foreground font-medium underline-offset-4 hover:underline"
          >
            회원가입
          </Link>
        </>
      }
    >
      {notice && (
        <p className="border-primary/30 bg-primary/10 text-foreground mb-4 rounded-lg border px-4 py-3 text-sm">
          {notice}
        </p>
      )}
      <LoginForm returnTo={returnTo} />
    </AuthLayout>
  );
}
```

- [ ] **Step 2: 로그인 앱 라우트에서 reset 파라미터 전달**

`app/(auth)/login/page.tsx`를 아래로 교체:

```tsx
import { LoginPage } from "@/pages/login";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; reset?: string }>;
}) {
  const { returnTo, reset } = await searchParams;
  const notice =
    reset === "success" ? "비밀번호가 변경되었습니다. 새 비밀번호로 로그인해주세요." : undefined;
  return <LoginPage returnTo={returnTo} notice={notice} />;
}
```

- [ ] **Step 3: .env.example에 변수 추가**

`.env.example` 끝에 추가:

```
# Optional: 인증 메일 링크 베이스 URL 폴백 (요청 Origin 헤더가 우선).
# 예: https://app.example.com — 로컬은 http://localhost:3000
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
```

- [ ] **Step 4: 전체 테스트 + 빌드**

Run: `npm run test`
Expected: 전체 PASS

Run: `npm run build`
Expected: 빌드 성공, 새 라우트(`/forgot-password`, `/reset-password`, `/auth/confirm`, `/api/auth/forgot-password`, `/api/auth/reset-password`)가 출력에 보임

- [ ] **Step 5: 커밋**

```bash
git add src/pages/login/ui/login-page.tsx app/(auth)/login/page.tsx .env.example
git commit -m "feat(auth): show reset-success notice on login + NEXT_PUBLIC_SITE_URL"
```

---

## Task 9: Supabase 대시보드 설정 안내 (코드 아님 — 사람이 수행)

> 코드만으로는 동작하지 않는다. 머지 후 아래를 **사용자가 직접** 설정해야 링크가 작동한다. 구현 완료 시 이 체크리스트를 사용자에게 전달할 것.

- [ ] **URL Configuration → Redirect URLs** 에 추가
  - `http://localhost:3000/**`
  - `https://<운영도메인>/**`
- [ ] **Email Templates → Reset Password** 링크를 아래로 변경
  ```html
  <a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password">
    비밀번호 재설정
  </a>
  ```
- [ ] (선택) **Site URL** 을 운영 도메인으로 설정
- [ ] 운영 배포 시 `.env`에 `NEXT_PUBLIC_SITE_URL`을 운영 도메인으로 설정(Origin 헤더가 없을 때의 폴백)

### 수동 E2E 확인
1. `/login` → "비밀번호를 잊으셨나요?" → `/forgot-password`
2. 가입된 이메일 입력 → "메일을 보냈습니다" 안내
3. 받은 메일의 링크 클릭 → (다른 브라우저에서 열어도) `/reset-password` 도달
4. 새 비밀번호(8자 이상, 확인 일치) 입력 → `/login?reset=success`로 이동 + 성공 배너
5. 새 비밀번호로 로그인 성공
6. (음성 케이스) 만료/위조 링크 → `/forgot-password?error=invalid` 안내 / 세션 없이 `/reset-password` 직접 접근 → `?error=expired`

---

## Self-Review (작성자 점검 결과)

**Spec coverage:**
- §1 A(로그인 진입점) → Task 6 Step 5 ✓
- §1 B(요청+메일) → Task 2 `requestPasswordReset` + Task 3 + Task 6 ✓
- §1 C(링크 핸들러) → Task 4 ✓
- §1 D(새 비밀번호 페이지+가드) → Task 2 `resetPassword` + Task 3 + Task 7 ✓
- §1 E(성공→로그아웃→/login) → Task 2 `signOut` + Task 7 폼 redirect + Task 8 배너 ✓
- §1 F(엣지: 열거/오픈리다이렉트/만료/429) → Task 2(열거,429) + Task 4(오픈리다이렉트,invalid) + Task 7(expired) ✓
- §1 G(테스트) → Task 1, Task 2 ✓
- §5 redirectTo origin → Task 2 `resolveOrigin` ✓
- §6 대시보드 설정 → Task 9 ✓
- §8 환경변수 → Task 8 Step 3 ✓

**Placeholder scan:** 없음(모든 코드 블록 실내용 포함). `<운영도메인>`은 사용자가 채우는 설정 값(의도된 것).

**Type consistency:** `forgotPasswordSchema`/`resetPasswordSchema`/`ForgotPasswordInput`/`ResetPasswordInput`(Task1) → 서버액션(Task2)·클라이언트(Task5)·폼(Task6/7)에서 동일 사용. `requestPasswordReset`/`resetPassword` 이름이 서버(`auth.server.ts`)·클라이언트(`auth.ts`)에 양쪽 존재하나 서로 다른 모듈 export라 충돌 없음(기존 `changePassword`도 동일 패턴). 에러 코드는 `to-error-response.ts` 기존 맵과 일치.

**Spec deviation(주의):** 설계 §4.3은 성공 안내를 "sonner 토스트"로 적었으나, 구현은 **로그인 페이지 인라인 배너**(`?reset=success`)로 한다. 사유: 토스트는 `useSearchParams`(Suspense 경계 필요)·자동 소멸로 놓치기 쉬움. 인라인 배너가 서버 렌더만으로 더 안정적이고 `/forgot-password`의 에러 안내와 일관됨.
