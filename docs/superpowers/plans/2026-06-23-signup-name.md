# 구글 가입 이름 채우기 + 마이페이지 이름 변경 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 구글 OAuth 신규 가입 시 `profiles.display_name`을 구글 실명→이메일 local-part 순으로 자동 채우고, 마이페이지에서 이름을 클릭해 변경하는 모달을 추가한다.

**Architecture:** Part 1은 가입 트리거(`handle_new_user`)를 `CREATE OR REPLACE`로 교체하는 SQL 마이그레이션. Part 2는 기존 auth feature 패턴(zod 스키마 → 서버 함수 → API 라우트 → react-query 훅 → Dialog UI)을 그대로 따라 이름 변경 흐름을 추가하고, 마이페이지의 이름 텍스트를 클릭형 다이얼로그로 교체한다.

**Tech Stack:** Next.js(App Router, 서버 컴포넌트), TypeScript, Drizzle(postgres-js, RLS 우회 직접 연결), Supabase Auth, zod, react-hook-form, @tanstack/react-query, Base UI Dialog, vitest.

## Global Constraints

- 앱이 이름을 읽는 유일한 출처는 `profiles.display_name`. 이름 변경은 **이 컬럼만** 갱신한다(auth user_metadata 동기화 안 함).
- 이름 폴백 우선순위(가입 시): `display_name` → `full_name` → `name` → `split_part(email,'@',1)`.
- DB 쓰기는 `@/shared/db`의 드리즐 `db`(RLS 우회 직접 연결)를 쓴다 — `getProfile`/`getUsers`와 동일 경로.
- API 라우트는 `try/catch` + `toErrorResponse(error)` 패턴. `toErrorResponse`는 `ZodError`→400(`VALIDATION_ERROR`), `UNAUTHORIZED`→401, `RATE_LIMITED`→429를 이미 매핑함.
- 마이그레이션은 `drizzle-kit migrate`가 `drizzle/migrations/meta/_journal.json`을 읽어 적용 → 새 `.sql` 파일과 journal 엔트리를 **둘 다** 추가해야 한다.
- 사용자 응답·UI 카피는 한국어. Base UI `Button`/`DialogTrigger`는 기본 `type="button"`.
- 패키지 매니저: `pnpm`. 테스트: `pnpm test`(vitest).

---

### Task 1: 가입 트리거 이름 폴백 마이그레이션

**Files:**
- Create: `drizzle/migrations/0012_signup_name_fallback.sql`
- Modify: `drizzle/migrations/meta/_journal.json` (entries 배열에 idx 12 추가)

**Interfaces:**
- Consumes: 없음 (DB 스키마/함수 정의)
- Produces: 가입 시 `profiles.display_name`이 비지 않음. 후속 태스크는 무관(독립).

- [ ] **Step 1: 마이그레이션 SQL 작성**

`drizzle/migrations/0012_signup_name_fallback.sql` 생성:

```sql
-- 가입 시 display_name 폴백: 이메일 가입은 display_name, 구글은 full_name/name,
-- 그래도 없으면 이메일 local-part. 트리거(on_auth_user_created)는 그대로 두고 함수만 교체한다.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'display_name', ''),
      NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
      NULLIF(NEW.raw_user_meta_data->>'name', ''),
      split_part(NEW.email, '@', 1)
    ),
    'pending'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
```

- [ ] **Step 2: journal 엔트리 추가**

`drizzle/migrations/meta/_journal.json`의 `entries` 배열 끝(마지막 `0011_proposal_whiteboard_enabled` 엔트리 뒤)에 추가. 직전 엔트리에 콤마를 붙이는 것을 잊지 말 것:

```json
    {
      "idx": 12,
      "version": "7",
      "when": 1782600000000,
      "tag": "0012_signup_name_fallback",
      "breakpoints": true
    }
```

- [ ] **Step 3: SQL 문법 검증 (적용은 수동)**

라이브 DB 적용은 머지 후 수동(`pnpm db:migrate` 또는 Supabase SQL 에디터). 여기서는 파일이 올바른지 확인만 한다:
Run: `git diff --stat`
Expected: `0012_signup_name_fallback.sql`(신규), `_journal.json`(수정 1줄 블록) 두 파일이 보임. JSON이 유효해야 함 — `node -e "require('./drizzle/migrations/meta/_journal.json')"` 가 에러 없이 끝나면 OK.

- [ ] **Step 4: 커밋**

```bash
git add drizzle/migrations/0012_signup_name_fallback.sql drizzle/migrations/meta/_journal.json
git commit -m "feat(auth): 가입 시 display_name 폴백(구글 실명→이메일 앞부분)"
```

---

### Task 2: `updateNameSchema` + 스키마 테스트

**Files:**
- Modify: `src/features/auth/model/schema.ts` (끝에 추가)
- Test: `tests/features/auth/schema.test.ts` (describe 블록 추가)

**Interfaces:**
- Consumes: 없음
- Produces: `updateNameSchema: ZodObject<{ name: string }>`, `type UpdateNameInput = { name: string }`. Task 3·5가 import한다.

- [ ] **Step 1: 실패 테스트 작성**

`tests/features/auth/schema.test.ts`의 import에 `updateNameSchema`를 추가하고(기존 import 목록에 한 줄), 파일 끝에 describe 추가:

```ts
describe("updateNameSchema", () => {
  it("accepts a non-empty name", () => {
    expect(updateNameSchema.safeParse({ name: "홍길동" }).success).toBe(true);
  });
  it("trims and rejects a blank name", () => {
    expect(updateNameSchema.safeParse({ name: "   " }).success).toBe(false);
  });
  it("rejects a name over 50 chars", () => {
    expect(updateNameSchema.safeParse({ name: "가".repeat(51) }).success).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm test -- schema.test.ts`
Expected: FAIL — `updateNameSchema`가 없어 import 에러 또는 `is not defined`.

- [ ] **Step 3: 스키마 구현**

`src/features/auth/model/schema.ts` 끝에 추가:

```ts
export const updateNameSchema = z.object({
  name: z.string().trim().min(1, "이름을 입력하세요").max(50, "이름은 50자 이하여야 합니다"),
});
export type UpdateNameInput = z.infer<typeof updateNameSchema>;
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm test -- schema.test.ts`
Expected: PASS (updateNameSchema 3건 포함 전체 green).

- [ ] **Step 5: 커밋**

```bash
git add src/features/auth/model/schema.ts tests/features/auth/schema.test.ts
git commit -m "feat(auth): updateNameSchema 추가"
```

---

### Task 3: `updateDisplayName` 서버 함수 + 서버 테스트

**Files:**
- Modify: `src/features/auth/api/auth.server.ts` (import 추가 + 함수 추가)
- Test: `tests/features/auth/update-name.server.test.ts` (신규)

**Interfaces:**
- Consumes: `updateNameSchema`(Task 2), `createSupabaseServer`, `db`, `profiles`, `eq`
- Produces: `updateDisplayName(input: unknown): Promise<void>` — 미인증 시 `throw new Error("UNAUTHORIZED")`, 검증 실패 시 zod throw. Task 4가 호출.

- [ ] **Step 1: 실패 테스트 작성**

`tests/features/auth/update-name.server.test.ts` 생성:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const getUser = vi.fn();
vi.mock("@/shared/supabase/server", () => ({
  createSupabaseServer: vi.fn(async () => ({ auth: { getUser } })),
}));

const where = vi.fn(async () => undefined);
const set = vi.fn(() => ({ where }));
const update = vi.fn(() => ({ set }));
vi.mock("@/shared/db", () => ({ db: { update } }));

import { updateDisplayName } from "@/features/auth/api/auth.server";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("updateDisplayName", () => {
  it("throws UNAUTHORIZED when not signed in", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    await expect(updateDisplayName({ name: "홍길동" })).rejects.toThrow("UNAUTHORIZED");
    expect(update).not.toHaveBeenCalled();
  });

  it("updates display_name for the current user", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    await updateDisplayName({ name: "  홍길동  " });
    expect(set).toHaveBeenCalledWith({ displayName: "홍길동" }); // trim 적용
    expect(where).toHaveBeenCalled();
  });

  it("rejects a blank name before touching the db", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    await expect(updateDisplayName({ name: "   " })).rejects.toBeTruthy();
    expect(update).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm test -- update-name.server.test.ts`
Expected: FAIL — `updateDisplayName` export 없음.

- [ ] **Step 3: 서버 함수 구현**

`src/features/auth/api/auth.server.ts` 상단 import에 추가:

```ts
import { eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { profiles } from "@drizzle/schema";
```

`model/schema` import 목록에 `updateNameSchema`를 추가하고, 파일 끝(`changePassword` 뒤)에 함수 추가:

```ts
// 마이페이지 이름 변경. 앱이 이름을 읽는 profiles.display_name만 갱신한다.
export async function updateDisplayName(input: unknown): Promise<void> {
  const { name } = updateNameSchema.parse(input);
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("UNAUTHORIZED");
  await db.update(profiles).set({ displayName: name }).where(eq(profiles.id, user.id));
}
```

(주의: zod `.parse`는 검증 실패 시 throw하므로 blank name은 db 도달 전에 막힌다. trim은 스키마가 처리.)

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm test -- update-name.server.test.ts`
Expected: PASS (3건 green).

- [ ] **Step 5: 커밋**

```bash
git add src/features/auth/api/auth.server.ts tests/features/auth/update-name.server.test.ts
git commit -m "feat(auth): updateDisplayName 서버 함수"
```

---

### Task 4: `PATCH /api/auth/profile` 라우트

**Files:**
- Create: `app/api/auth/profile/route.ts`

**Interfaces:**
- Consumes: `updateDisplayName`(Task 3), `toErrorResponse`
- Produces: HTTP `PATCH /api/auth/profile` — 성공 204, 검증 실패 400(`VALIDATION_ERROR`), 미인증 401(`UNAUTHORIZED`). Task 5가 호출.

- [ ] **Step 1: 라우트 구현**

`app/api/auth/profile/route.ts` 생성 (`password/route.ts`와 동일 형태, 메서드만 PATCH):

```ts
import { NextRequest } from "next/server";
import { updateDisplayName } from "@/features/auth/api/auth.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

export async function PATCH(req: NextRequest) {
  try {
    await updateDisplayName(await req.json());
    return new Response(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
```

- [ ] **Step 2: 타입/빌드 검증**

Run: `pnpm exec tsc --noEmit`
Expected: 에러 없음(0 errors). 새 라우트가 컴파일됨.

- [ ] **Step 3: 커밋**

```bash
git add app/api/auth/profile/route.ts
git commit -m "feat(auth): PATCH /api/auth/profile 라우트"
```

---

### Task 5: 클라이언트 API + react-query 훅

**Files:**
- Modify: `src/features/auth/api/auth.ts` (함수 추가)
- Modify: `src/features/auth/api/use-auth.ts` (훅 추가)

**Interfaces:**
- Consumes: `UpdateNameInput`(Task 2), `http`, `updateName`
- Produces: `updateName(input: UpdateNameInput): Promise<void>`, `useUpdateName()` → react-query mutation. Task 6이 사용.

- [ ] **Step 1: 클라이언트 API 함수 추가**

`src/features/auth/api/auth.ts`의 타입 import 목록에 `UpdateNameInput`을 추가하고, 파일 끝에 추가:

```ts
export function updateName(input: UpdateNameInput): Promise<void> {
  return http<void>("/api/auth/profile", { method: "PATCH", body: JSON.stringify(input) });
}
```

- [ ] **Step 2: 훅 추가**

`src/features/auth/api/use-auth.ts`의 `./auth` import 목록에 `updateName`을 추가하고, 파일 끝에 추가:

```ts
export function useUpdateName() {
  return useMutation({ mutationFn: updateName });
}
```

- [ ] **Step 3: 타입/빌드 검증**

Run: `pnpm exec tsc --noEmit`
Expected: 에러 없음(0 errors).

- [ ] **Step 4: 커밋**

```bash
git add src/features/auth/api/auth.ts src/features/auth/api/use-auth.ts
git commit -m "feat(auth): updateName 클라 API + useUpdateName 훅"
```

---

### Task 6: `EditNameDialog` + 마이페이지 연결

**Files:**
- Create: `src/features/auth/ui/edit-name-dialog.tsx`
- Modify: `src/features/auth/index.ts` (export 추가)
- Modify: `src/pages/my-page/ui/my-page.tsx` (`<p>{name}</p>` → `<EditNameDialog>`)

**Interfaces:**
- Consumes: `useUpdateName`(Task 5), `updateNameSchema`(Task 2), `HttpError`, Base UI Dialog, `useRouter`
- Produces: `EditNameDialog({ displayName }: { displayName: string | null })` 컴포넌트. MyPage가 렌더.

- [ ] **Step 1: 컴포넌트 작성**

`src/features/auth/ui/edit-name-dialog.tsx` 생성:

```tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { HttpError } from "@/shared/api/http";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { updateNameSchema, type UpdateNameInput } from "../model/schema";
import { useUpdateName } from "../api/use-auth";

function editNameErrorMessage(err: unknown): string {
  if (err instanceof HttpError) {
    if (err.code === "VALIDATION_ERROR") return "이름을 다시 확인해주세요.";
    if (err.code === "RATE_LIMITED") return "잠시 후 다시 시도해주세요.";
    if (err.code === "UNAUTHORIZED") return "다시 로그인해주세요.";
  }
  return "이름 변경 중 오류가 발생했습니다.";
}

export function EditNameDialog({ displayName }: { displayName: string | null }) {
  const router = useRouter();
  const updateNameMutation = useUpdateName();
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const name = displayName ?? "사용자";

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdateNameInput>({
    resolver: zodResolver(updateNameSchema),
    defaultValues: { name: displayName ?? "" },
  });

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      reset({ name: displayName ?? "" });
      setFormError(null);
    }
  }

  async function onSubmit(values: UpdateNameInput) {
    setFormError(null);
    try {
      await updateNameMutation.mutateAsync(values);
      setOpen(false);
      router.refresh();
    } catch (err) {
      setFormError(editNameErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={
          <button
            type="button"
            className="hover:text-foreground/70 mt-4 text-lg font-semibold tracking-tight underline-offset-4 transition-colors hover:underline"
            aria-label="이름 변경"
          />
        }
      >
        {name}
      </DialogTrigger>
      <DialogContent showCloseButton={false} className="gap-5 p-6">
        <DialogHeader>
          <DialogTitle>이름 변경</DialogTitle>
          <DialogDescription>표시할 이름을 입력하세요.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2.5">
            <Label htmlFor="display-name" className="text-muted-foreground font-normal">
              이름
            </Label>
            <Input
              id="display-name"
              autoFocus
              maxLength={50}
              className="h-11 rounded-lg px-4"
              {...register("name")}
            />
            {errors.name && <p className="text-destructive text-sm">{errors.name.message}</p>}
          </div>

          {formError && <p className="text-destructive text-sm">{formError}</p>}

          <DialogFooter showCloseButton={false}>
            <DialogClose
              render={<Button type="button" variant="outline" className="h-10 rounded-lg" />}
            >
              취소
            </DialogClose>
            <Button type="submit" className="h-10 rounded-lg" disabled={updateNameMutation.isPending}>
              {updateNameMutation.isPending ? "변경 중…" : "변경"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: feature export 추가**

`src/features/auth/index.ts`에 추가:

```ts
export { EditNameDialog } from "./ui/edit-name-dialog";
```

- [ ] **Step 3: 마이페이지에서 이름 텍스트 교체**

`src/pages/my-page/ui/my-page.tsx`를 수정한다. 상단에 import 추가:

```ts
import { EditNameDialog } from "@/features/auth";
```

함수 본문에서 `const name = displayName ?? "사용자";` 줄을 삭제하고(이름 표시는 이제 EditNameDialog가 담당), 아래 줄을

```tsx
      <p className="mt-4 text-lg font-semibold tracking-tight">{name}</p>
```

다음으로 교체:

```tsx
      <EditNameDialog displayName={displayName} />
```

(`initial`/`joined` 로직과 나머지 마크업은 그대로 둔다. `initial`은 `displayName ?? email`을 쓰므로 영향 없음.)

- [ ] **Step 4: 타입/빌드 검증**

Run: `pnpm exec tsc --noEmit`
Expected: 에러 없음(0 errors). `name` 미사용 변수 경고/에러가 없어야 함(삭제했으므로).

- [ ] **Step 5: 전체 테스트 + 린트**

Run: `pnpm test` 그리고 `pnpm lint`
Expected: 둘 다 PASS.

- [ ] **Step 6: 커밋**

```bash
git add src/features/auth/ui/edit-name-dialog.tsx src/features/auth/index.ts src/pages/my-page/ui/my-page.tsx
git commit -m "feat(auth): 마이페이지 이름 클릭 변경 모달(EditNameDialog)"
```

---

## 수동 검증 (머지 전/후)

- [ ] `pnpm dev`로 마이페이지(`/me`) 진입 → 이름 클릭 → 모달에서 변경 → 닫힌 뒤 이름이 갱신되어 보임.
- [ ] 빈 이름/51자 입력 시 필드 에러 노출, 저장 막힘.
- [ ] (머지 후) 라이브 Supabase에 `0012` 마이그레이션 수동 적용.
- [ ] (적용 후) 구글 신규 계정 가입 → 실명 있으면 실명, 없으면 이메일 `@` 앞부분이 `profiles.display_name`에 저장됨(`pnpm db:check` 또는 관리자 사용자 목록에서 확인).

## Self-Review 결과

- **Spec coverage:** Part1(트리거)=Task1, updateNameSchema=Task2, updateDisplayName=Task3, API 라우트=Task4, 클라/훅=Task5, EditNameDialog+my-page=Task6. 결정사항(폴백 우선순위·profiles만 갱신) 모두 반영. 누락 없음.
- **Placeholder scan:** 모든 step에 실제 코드/명령/기대결과 포함. TODO/TBD 없음.
- **Type consistency:** `updateNameSchema`/`UpdateNameInput`/`updateDisplayName`/`updateName`/`useUpdateName`/`EditNameDialog` 이름이 정의처(Task2/3/5/6)와 사용처에서 일치. `displayName` 프로퍼티명·`{ displayName: name }` set 페이로드 일관.
