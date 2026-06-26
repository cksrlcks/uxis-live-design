# 시안 작업연도 필드 추가 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 시안(proposal)에 작업연도(work_year) 필드를 추가하고, 등록 폼 셀렉트·목록 칼럼·목록 필터(연도+공개상태)를 구현한다.

**Architecture:** DB에 INTEGER NULL 컬럼 추가 → 서버 쿼리/API에 필터 파라미터 추가 → 클라이언트 query 키 확장 → 등록·설정 폼에 셀렉트 추가 → 목록 페이지에 칼럼·필터 UI 추가. 기존 패턴(수기 마이그레이션, nuqs URL 상태, Base UI Select)을 그대로 따른다.

**Tech Stack:** Drizzle ORM, PostgreSQL, Next.js App Router, React Hook Form, Zod, TanStack Query, nuqs, Base UI Select

## Global Constraints

- 마이그레이션은 수기 SQL + `_journal.json` 수동 추가 (db:generate 사용 금지)
- 연도 범위: 2000 ~ 현재 연도(서버 빌드 타임 고정 불가이므로 클라이언트에서 `new Date().getFullYear()` 사용)
- workYear는 선택 사항(optional, NULL 허용)
- 필터 상태는 nuqs로 URL 파라미터 관리(`year`, `visibility`)
- Base UI Select 컴포넌트 사용 (`src/shared/ui/select.tsx`)
- 기존 코드 스타일 유지 (className 상수, 한국어 레이블)

---

## 파일 변경 목록

| 구분 | 파일 |
|------|------|
| 신규 | `drizzle/migrations/0024_proposal_work_year.sql` |
| 수정 | `drizzle/migrations/meta/_journal.json` |
| 수정 | `drizzle/schema.ts` |
| 수정 | `src/entities/proposal/model/types.ts` |
| 수정 | `src/entities/proposal/model/create-schema.ts` |
| 수정 | `src/entities/proposal/model/edit-schemas.ts` |
| 수정 | `src/entities/proposal/api/create-proposal.server.ts` |
| 수정 | `src/entities/proposal/api/get-proposals.server.ts` |
| 수정 | `src/entities/proposal/api/get-proposals.ts` |
| 수정 | `src/entities/proposal/api/proposal.query.ts` |
| 수정 | `src/entities/proposal/api/proposal-mutations.server.ts` |
| 수정 | `app/api/proposals/route.ts` |
| 수정 | `src/features/create-proposal/ui/proposal-create-form.tsx` |
| 수정 | `src/features/edit-proposal-settings/ui/proposal-settings.tsx` |
| 수정 | `src/pages/proposals-list/ui/proposals-list-page.tsx` |

---

### Task 1: DB 마이그레이션 — work_year 컬럼 추가

**Files:**
- Create: `drizzle/migrations/0024_proposal_work_year.sql`
- Modify: `drizzle/migrations/meta/_journal.json`
- Modify: `drizzle/schema.ts`

**Interfaces:**
- Produces: `proposals.workYear: number | null` — 이후 모든 Task에서 사용

- [ ] **Step 1: SQL 마이그레이션 파일 생성**

`drizzle/migrations/0024_proposal_work_year.sql`:
```sql
ALTER TABLE "proposals" ADD COLUMN "work_year" integer;
```

- [ ] **Step 2: journal에 항목 추가**

`drizzle/migrations/meta/_journal.json`의 `entries` 배열 끝에 추가:
```json
{
  "idx": 24,
  "version": "7",
  "when": 1783900000000,
  "tag": "0024_proposal_work_year",
  "breakpoints": true
}
```

- [ ] **Step 3: Drizzle 스키마에 컬럼 추가**

`drizzle/schema.ts`의 `proposals` 테이블, `exposedToUxisworks` 줄 바로 뒤에 추가:
```ts
workYear: integer("work_year"), // 작업 연도(선택, nullable)
```

- [ ] **Step 4: DB에 마이그레이션 적용**

```bash
npx drizzle-kit migrate
```
Expected: "0024_proposal_work_year" applied.

- [ ] **Step 5: 커밋**

```bash
git add drizzle/migrations/0024_proposal_work_year.sql drizzle/migrations/meta/_journal.json drizzle/schema.ts
git commit -m "feat(db): proposals에 work_year 컬럼 추가 (0024)"
```

---

### Task 2: 타입·스키마 레이어 업데이트

**Files:**
- Modify: `src/entities/proposal/model/create-schema.ts`
- Modify: `src/entities/proposal/model/edit-schemas.ts`

**Interfaces:**
- Consumes: `proposals.workYear` from Task 1
- Produces:
  - `createProposalSchema` — `workYear?: number`
  - `updateSettingsSchema` — `workYear?: number | null`

- [ ] **Step 1: 생성 스키마에 workYear 추가**

`src/entities/proposal/model/create-schema.ts`에서 `createProposalSchema`를 다음으로 교체:
```ts
export const createProposalSchema = z.object({
  title: titleSchema,
  files: z.array(fileMetaSchema).default([]),
  workYear: z.number().int().min(2000).max(2100).optional(),
});
```

- [ ] **Step 2: 수정 스키마에 workYear 추가**

`src/entities/proposal/model/edit-schemas.ts`에서 `updateSettingsSchema` 객체에 필드 추가 (`.refine()` 전):
```ts
// workYear를 정수로 설정/변경, null로 해제. Absent = unchanged.
workYear: z.union([z.number().int().min(2000).max(2100), z.null()]).optional(),
```
그리고 `.refine()` 조건에 `v.workYear !== undefined ||` 추가:
```ts
.refine(
  (v) =>
    v.title !== undefined ||
    v.visibility !== undefined ||
    v.password !== undefined ||
    v.domain !== undefined ||
    v.whiteboardEnabled !== undefined ||
    v.exposedToUxisworks !== undefined ||
    v.participants !== undefined ||
    v.figmaUrl !== undefined ||
    v.workYear !== undefined,
  { message: "변경할 항목이 없습니다" },
);
```

- [ ] **Step 3: 커밋**

```bash
git add src/entities/proposal/model/create-schema.ts src/entities/proposal/model/edit-schemas.ts
git commit -m "feat(schema): createProposalSchema·updateSettingsSchema에 workYear 추가"
```

---

### Task 3: 서버 액션·뮤테이션 업데이트

**Files:**
- Modify: `src/entities/proposal/api/create-proposal.server.ts`
- Modify: `src/entities/proposal/api/proposal-mutations.server.ts`

**Interfaces:**
- Consumes: `createProposalSchema.workYear` (Task 2), `updateSettingsSchema.workYear` (Task 2)
- Produces: DB insert/update에 `workYear` 포함

- [ ] **Step 1: 시안 생성 서버 액션에 workYear 반영**

`src/entities/proposal/api/create-proposal.server.ts`에서:
```ts
// 변경 전
const { title, files } = createProposalSchema.parse(input);
// ...
await db.insert(proposals).values({ id: proposalId, publicId, title, ownerId: editor.id });
```
```ts
// 변경 후
const { title, files, workYear } = createProposalSchema.parse(input);
// ...
await db.insert(proposals).values({
  id: proposalId,
  publicId,
  title,
  ownerId: editor.id,
  ...(workYear !== undefined && { workYear }),
});
```

- [ ] **Step 2: 설정 업데이트 서버 액션에 workYear 반영**

`src/entities/proposal/api/proposal-mutations.server.ts`에서:
1. 구조분해에 `workYear` 추가:
```ts
const {
  title, visibility, password, domain,
  whiteboardEnabled, exposedToUxisworks, participants, figmaUrl,
  workYear,
} = updateSettingsSchema.parse(input);
```
2. updates 블록에 추가 (`if (exposedToUxisworks !== undefined)` 뒤):
```ts
if (workYear !== undefined) updates.workYear = workYear;
```

- [ ] **Step 3: 커밋**

```bash
git add src/entities/proposal/api/create-proposal.server.ts src/entities/proposal/api/proposal-mutations.server.ts
git commit -m "feat(api): 시안 생성·수정 서버 액션에 workYear 반영"
```

---

### Task 4: 목록 API — 필터 파라미터 추가

**Files:**
- Modify: `src/entities/proposal/api/get-proposals.server.ts`
- Modify: `app/api/proposals/route.ts`

**Interfaces:**
- Produces:
  - `getProposals(page, pageSize, search, year, visibility)` 시그니처
  - `GET /api/proposals?year=2024&visibility=public` 지원

- [ ] **Step 1: getProposals 서버 함수에 필터 파라미터 추가**

`src/entities/proposal/api/get-proposals.server.ts` 전체 교체:
```ts
import "server-only";
import { and, desc, eq, getTableColumns, ilike, or, sql } from "drizzle-orm";
import { db } from "@/shared/db";
import { proposals, proposalTags, tagGroups, tagOptions } from "@drizzle/schema";
import { requireEditor } from "@/shared/auth/guards.server";
import { taggingPercent } from "../lib/tagging-progress";
import { PROPOSALS_PAGE_SIZE, type Paginated, type ProposalListItem } from "../model/types";

export async function getProposals(
  page = 1,
  pageSize = PROPOSALS_PAGE_SIZE,
  search = "",
  year?: number,
  visibility?: "public" | "private",
): Promise<Paginated<ProposalListItem>> {
  await requireEditor();

  const safePage = Math.max(1, Math.trunc(page));
  const safeSize = Math.min(100, Math.max(1, Math.trunc(pageSize)));

  const term = search.trim();
  const searchWhere = term
    ? or(
        ilike(proposals.title, `%${escapeLike(term)}%`),
        ilike(proposals.participants, `%${escapeLike(term)}%`),
        ilike(proposals.domain, `%${escapeLike(term)}%`),
      )
    : undefined;

  const yearWhere = year !== undefined ? eq(proposals.workYear, year) : undefined;
  const visWhere = visibility !== undefined ? eq(proposals.visibility, visibility) : undefined;

  const where = and(searchWhere, yearWhere, visWhere);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(proposals)
    .where(where);

  const [{ totalGroups }] = await db
    .select({ totalGroups: sql<number>`count(*)::int` })
    .from(tagGroups);

  const rows = await db
    .select({
      ...getTableColumns(proposals),
      taggedGroups: sql<number>`count(distinct ${tagOptions.groupId})::int`,
    })
    .from(proposals)
    .leftJoin(proposalTags, eq(proposalTags.proposalId, proposals.id))
    .leftJoin(tagOptions, eq(tagOptions.id, proposalTags.optionId))
    .where(where)
    .groupBy(proposals.id)
    .orderBy(desc(proposals.createdAt), desc(proposals.id))
    .limit(safeSize)
    .offset((safePage - 1) * safeSize);

  const items: ProposalListItem[] = rows.map(({ taggedGroups, ...p }) => ({
    ...p,
    taggingProgress: taggingPercent(taggedGroups, totalGroups),
  }));

  return { items, total, page: safePage, pageSize: safeSize };
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}
```

- [ ] **Step 2: API 라우트에서 year·visibility 파싱 후 전달**

`app/api/proposals/route.ts`의 `GET` 핸들러를 교체:
```ts
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Number(searchParams.get("page") ?? "1");
    const pageSize = Number(searchParams.get("pageSize") ?? "");
    const search = searchParams.get("q") ?? "";
    const yearRaw = searchParams.get("year");
    const year = yearRaw ? Number(yearRaw) : undefined;
    const visRaw = searchParams.get("visibility");
    const visibility =
      visRaw === "public" || visRaw === "private" ? visRaw : undefined;
    return Response.json(
      await getProposals(
        Number.isFinite(page) ? page : 1,
        Number.isFinite(pageSize) && pageSize > 0 ? pageSize : undefined,
        search,
        Number.isFinite(year) ? year : undefined,
        visibility,
      ),
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
```

- [ ] **Step 3: 커밋**

```bash
git add src/entities/proposal/api/get-proposals.server.ts app/api/proposals/route.ts
git commit -m "feat(api): 시안 목록에 연도·공개상태 필터 파라미터 추가"
```

---

### Task 5: 클라이언트 fetch·query 키 업데이트

**Files:**
- Modify: `src/entities/proposal/api/get-proposals.ts`
- Modify: `src/entities/proposal/api/proposal.query.ts`

**Interfaces:**
- Produces:
  - `getProposals(page, search, year?, visibility?)` 클라이언트 fetch
  - `proposalQueries.list(page, search, year?, visibility?)` query options

- [ ] **Step 1: 클라이언트 fetch 함수에 year·visibility 추가**

`src/entities/proposal/api/get-proposals.ts` 전체 교체:
```ts
import { http } from "@/shared/api/http";
import { type Paginated, type ProposalListItem } from "../model/types";

export function getProposals(
  page = 1,
  search = "",
  year?: number,
  visibility?: "public" | "private",
): Promise<Paginated<ProposalListItem>> {
  const qs = new URLSearchParams({ page: String(page) });
  const term = search.trim();
  if (term) qs.set("q", term);
  if (year !== undefined) qs.set("year", String(year));
  if (visibility) qs.set("visibility", visibility);
  return http<Paginated<ProposalListItem>>(`/api/proposals?${qs}`);
}
```

- [ ] **Step 2: proposal.query.ts — list 쿼리 키에 year·visibility 포함**

`src/entities/proposal/api/proposal.query.ts`에서 `list` 항목을 교체:
```ts
list: (page = 1, search = "", year?: number, visibility?: "public" | "private") =>
  queryOptions({
    queryKey: [
      ...proposalQueries.lists(),
      page,
      ...(search ? [search] : []),
      ...(year !== undefined ? [year] : []),
      ...(visibility ? [visibility] : []),
    ],
    queryFn: () => getProposals(page, search, year, visibility),
    placeholderData: keepPreviousData,
  }),
```

- [ ] **Step 3: 커밋**

```bash
git add src/entities/proposal/api/get-proposals.ts src/entities/proposal/api/proposal.query.ts
git commit -m "feat(query): 시안 목록 쿼리에 year·visibility 필터 지원"
```

---

### Task 6: 등록 폼에 작업연도 셀렉트 추가

**Files:**
- Modify: `src/features/create-proposal/ui/proposal-create-form.tsx`

**Interfaces:**
- Consumes: `createProposalSchema.workYear` (Task 2), `Select*` from `@/shared/ui/select`
- Produces: 폼 제출 시 `workYear?: number` 포함

- [ ] **Step 1: proposal-create-form.tsx 업데이트**

파일 전체를 다음으로 교체:
```tsx
"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/shared/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { createProposalSchema } from "@/entities/proposal/model/create-schema";
import { useCreateProposal } from "../api/use-create-proposal";

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from(
  { length: CURRENT_YEAR - 2000 + 1 },
  (_, i) => CURRENT_YEAR - i,
);

const formSchema = createProposalSchema.pick({ title: true, workYear: true });
type FormValues = z.infer<typeof formSchema>;

export function ProposalCreateForm() {
  const router = useRouter();
  const createProposal = useCreateProposal();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema) });

  async function onSubmit({ title, workYear }: FormValues) {
    setFormError(null);
    try {
      const { proposalId } = await createProposal.mutateAsync({ title, workYear });
      toast.success("시안을 만들었습니다");
      router.push(`/studio/proposals/${proposalId}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Card>
        <CardHeader>
          <CardTitle>기본 정보</CardTitle>
          <CardDescription>제목을 입력하면 빈 v1이 자동 생성됩니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="title">제목</Label>
            <Input
              id="title"
              placeholder="시안 제목을 입력하세요"
              className="h-9"
              {...register("title")}
            />
            {errors.title && <p className="text-destructive text-sm">{errors.title.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="workYear">작업연도</Label>
            <Controller
              control={control}
              name="workYear"
              render={({ field }) => (
                <Select<number | undefined>
                  value={field.value}
                  onValueChange={(v) => field.onChange(v)}
                >
                  <SelectTrigger id="workYear" className="w-40">
                    <SelectValue placeholder="연도 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {YEAR_OPTIONS.map((y) => (
                      <SelectItem key={y} value={y}>
                        {y}년
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {formError && <p className="text-destructive text-sm">{formError}</p>}
        </CardContent>
        <CardFooter>
          <p className="text-muted-foreground text-sm">이미지는 생성 후 추가·교체할 수 있습니다.</p>
          <Button type="submit" size="lg" className="ml-auto" disabled={createProposal.isPending}>
            {createProposal.isPending ? "만드는 중…" : "시안 만들기"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/features/create-proposal/ui/proposal-create-form.tsx
git commit -m "feat(create-form): 시안 등록 폼에 작업연도 셀렉트 추가"
```

---

### Task 7: 설정 폼에 작업연도 카드 추가

**Files:**
- Modify: `src/features/edit-proposal-settings/ui/proposal-settings.tsx`

**Interfaces:**
- Consumes: `updateSettingsSchema.workYear` (Task 2), `useUpdateSettings` 훅 (기존)
- Produces: 작업연도 변경 시 PATCH 요청으로 저장

- [ ] **Step 1: ProposalSettings 컴포넌트 업데이트**

1. import에 Select 컴포넌트 추가:
```tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
```

2. 컴포넌트 상단 (import 아래)에 상수 추가:
```tsx
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from(
  { length: CURRENT_YEAR - 2000 + 1 },
  (_, i) => CURRENT_YEAR - i,
);
```

3. `ProposalSettings` props에 `workYear` 추가:
```tsx
export function ProposalSettings({
  proposalId,
  title,
  participants,
  workYear,         // 추가
  domain,
  figmaUrl,
  visibility,
  hasPassword,
  whiteboardEnabled,
  exposedToUxisworks,
}: {
  proposalId: string;
  title: string;
  participants: string | null;
  workYear: number | null;   // 추가
  domain: string | null;
  figmaUrl: string | null;
  visibility: string;
  hasPassword: boolean;
  whiteboardEnabled: boolean;
  exposedToUxisworks: boolean;
}) {
```

4. `/* 참여자 */` form 블록 바로 뒤에 작업연도 카드 추가:
```tsx
{/* 작업연도 */}
<Card>
  <CardHeader>
    <CardTitle>작업연도</CardTitle>
    <CardDescription>이 시안이 제작된 연도를 선택합니다. 목록 표시와 필터에 사용됩니다.</CardDescription>
  </CardHeader>
  <CardContent>
    <Select<number | null>
      value={workYear}
      onValueChange={(v) =>
        change({ workYear: v ?? null })
      }
    >
      <SelectTrigger className="w-40">
        <SelectValue placeholder="연도 선택" />
      </SelectTrigger>
      <SelectContent>
        {YEAR_OPTIONS.map((y) => (
          <SelectItem key={y} value={y}>
            {y}년
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </CardContent>
  {workYear && (
    <CardFooter>
      <p className="text-muted-foreground text-sm">{workYear}년으로 설정됨</p>
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="ml-auto"
        disabled={pending}
        onClick={() => change({ workYear: null })}
      >
        해제
      </Button>
    </CardFooter>
  )}
</Card>
```

- [ ] **Step 2: 커밋**

```bash
git add src/features/edit-proposal-settings/ui/proposal-settings.tsx
git commit -m "feat(settings-form): 시안 설정에 작업연도 셀렉트 카드 추가"
```

---

### Task 8: 설정 페이지에서 workYear prop 전달

`ProposalSettings`를 렌더링하는 페이지/컴포넌트가 `workYear`를 prop으로 내려주지 않으면 Task 7이 동작하지 않는다. 이 Task에서 해당 호출부를 찾아 수정한다.

**Files:**
- Modify: `ProposalSettings`를 렌더링하는 파일 (아래 탐색으로 확인 후 수정)

**Interfaces:**
- Consumes: `ProposalDetailHeader.workYear` — Task 8b에서 타입에 추가 필요

- [ ] **Step 1: ProposalDetailHeader 타입에 workYear 추가**

`src/entities/proposal/model/types.ts`에서 `ProposalDetailHeader`에 필드 추가:
```ts
export type ProposalDetailHeader = {
  id: string;
  title: string;
  participants: string | null;
  workYear: number | null;      // 추가
  figmaUrl: string | null;
  publicId: string;
  domain: string | null;
  visibility: string;
  hasPassword: boolean;
  whiteboardEnabled: boolean;
  exposedToUxisworks: boolean;
};
```

- [ ] **Step 2: 설정 페이지 렌더링 호출부 찾기**

```bash
grep -r "ProposalSettings" src/ app/ --include="*.tsx" -l
```

찾은 파일에서 `<ProposalSettings` 호출에 `workYear={proposal.workYear}` prop 추가.

- [ ] **Step 3: get-proposal-detail.server.ts에서 workYear 포함 확인**

```bash
grep -n "workYear\|ProposalDetailHeader" src/entities/proposal/api/get-proposal-detail.server.ts
```

`ProposalDetailHeader`를 수동 조립하는 경우 `workYear: proposal.workYear` 추가. `getTableColumns()` 또는 `$inferSelect`로 자동 매핑된다면 별도 수정 불필요.

- [ ] **Step 4: 커밋**

```bash
git add src/entities/proposal/model/types.ts
# 수정된 호출부 파일도 추가
git commit -m "feat: ProposalDetailHeader에 workYear 추가 및 설정 페이지 prop 전달"
```

---

### Task 9: 목록 페이지 — 연도 칼럼 + 필터 UI

**Files:**
- Modify: `src/pages/proposals-list/ui/proposals-list-page.tsx`

**Interfaces:**
- Consumes:
  - `proposalQueries.list(page, search, year, visibility)` (Task 5)
  - `ProposalListItem.workYear` (Task 1 스키마, Drizzle `$inferSelect` 자동 포함)
  - `Select*` from `@/shared/ui/select`
- Produces: 완성된 목록 UI (필터 + 연도 칼럼)

- [ ] **Step 1: proposals-list-page.tsx 전체 교체**

```tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { parseAsInteger, parseAsString, useQueryState } from "nuqs";
import { toast } from "sonner";
import { ArrowUpRight, Copy, MoreVertical, Pencil, Share2 } from "lucide-react";
import { proposalQueries } from "@/entities/proposal";
import { PROPOSALS_PAGE_SIZE } from "@/entities/proposal/model/types";
import { NewProposalDialog } from "@/features/create-proposal";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/shared/ui/dialog";
import { ProgressRing } from "@/shared/ui/progress-ring";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/shared/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { SearchInput } from "@/shared/ui/search-input";
import { Skeleton } from "@/shared/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { PageHeader } from "@/widgets/studio-shell";

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from(
  { length: CURRENT_YEAR - 2000 + 1 },
  (_, i) => CURRENT_YEAR - i,
);

const headCell = "text-muted-foreground h-10 px-5 text-xs font-medium tracking-wide";
const bodyCell = "px-5 py-3.5 align-middle";
const menuItem = "gap-2.5 px-2.5 py-2";

function formatDate(value: string | Date) {
  return new Date(value).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

async function copyViewerLink(path: string) {
  try {
    await navigator.clipboard.writeText(`${window.location.origin}${path}`);
    toast.success("시안 링크를 복사했습니다");
  } catch {
    toast.error("복사에 실패했습니다");
  }
}

function pageItems(current: number, count: number): (number | "ellipsis")[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const items: (number | "ellipsis")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(count - 1, current + 1);
  if (start > 2) items.push("ellipsis");
  for (let p = start; p <= end; p++) items.push(p);
  if (end < count - 1) items.push("ellipsis");
  items.push(count);
  return items;
}

type ShareTarget = {
  title: string;
  links: { key: string; label: string; path: string }[];
};

// nuqs parseAs helpers for filter params
const parseAsYear = parseAsInteger;
const parseAsVisibility = parseAsString;

export function ProposalsListPage() {
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
  const [q, setQ] = useQueryState("q", parseAsString.withDefault(""));
  const [yearFilter, setYearFilter] = useQueryState("year", parseAsYear);
  const [visFilter, setVisFilter] = useQueryState("visibility", parseAsVisibility);

  const year = yearFilter ?? undefined;
  const visibility =
    visFilter === "public" || visFilter === "private" ? visFilter : undefined;

  const { data, isPending, isError, isPlaceholderData } = useQuery(
    proposalQueries.list(page, q, year, visibility),
  );
  const [shareTarget, setShareTarget] = useState<ShareTarget | null>(null);

  function onSearch(next: string) {
    setQ(next || null);
    setPage(1);
  }

  function onYearChange(v: number | null) {
    setYearFilter(v);
    setPage(1);
  }

  function onVisChange(v: string | null) {
    setVisFilter(v);
    setPage(1);
  }

  const rows = data?.items;
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PROPOSALS_PAGE_SIZE));
  // 테이블 colspan: 기존 9 → 연도 칼럼 추가로 10
  const COL_COUNT = 10;

  return (
    <div>
      <PageHeader title="시안" actions={<NewProposalDialog />} />

      <div className="mb-3 flex items-center gap-3">
        <SearchInput
          value={q}
          onChange={onSearch}
          placeholder="제목·참여자·도메인 검색"
          className="w-full max-w-xs"
        />

        {/* 연도 필터 */}
        <Select<number | null>
          value={yearFilter}
          onValueChange={(v) => onYearChange(v)}
        >
          <SelectTrigger size="sm" className="w-32">
            <SelectValue placeholder="전체 연도" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>전체 연도</SelectItem>
            {YEAR_OPTIONS.map((y) => (
              <SelectItem key={y} value={y}>
                {y}년
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* 공개상태 필터 */}
        <Select<string | null>
          value={visFilter}
          onValueChange={(v) => onVisChange(v)}
        >
          <SelectTrigger size="sm" className="w-28">
            <SelectValue placeholder="전체" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>전체</SelectItem>
            <SelectItem value="public">공개</SelectItem>
            <SelectItem value="private">비공개</SelectItem>
          </SelectContent>
        </Select>

        {total > 0 && (
          <p className="text-muted-foreground ml-auto shrink-0 text-sm">전체 {total}개</p>
        )}
      </div>

      <div className="bg-card overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 border-border/60 border-b">
              <TableHead className={headCell}>제목</TableHead>
              <TableHead className={headCell}>참여자</TableHead>
              <TableHead className={cn(headCell, "whitespace-nowrap")}>연도</TableHead>
              <TableHead className={headCell}>공개 ID</TableHead>
              <TableHead className={headCell}>공개 도메인</TableHead>
              <TableHead className={headCell}>상태</TableHead>
              <TableHead className={headCell}>태깅</TableHead>
              <TableHead className={cn(headCell, "whitespace-nowrap")}>작성일</TableHead>
              <TableHead className={cn(headCell, "whitespace-nowrap")}>최근수정일</TableHead>
              <TableHead className={cn(headCell, "w-0")}>
                <span className="sr-only">작업</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending &&
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow
                  key={`skeleton-${i}`}
                  className="border-border/60 border-b last:border-0 hover:bg-transparent"
                >
                  <TableCell className={bodyCell}><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell className={bodyCell}><Skeleton className="h-3.5 w-24" /></TableCell>
                  <TableCell className={bodyCell}><Skeleton className="h-3.5 w-10" /></TableCell>
                  <TableCell className={bodyCell}><Skeleton className="h-3.5 w-16" /></TableCell>
                  <TableCell className={bodyCell}><Skeleton className="h-3.5 w-24" /></TableCell>
                  <TableCell className={bodyCell}><Skeleton className="h-5 w-12 rounded-full" /></TableCell>
                  <TableCell className={bodyCell}><Skeleton className="size-6 rounded-full" /></TableCell>
                  <TableCell className={bodyCell}><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell className={bodyCell}><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell className={bodyCell}><Skeleton className="ml-auto size-7 rounded-full" /></TableCell>
                </TableRow>
              ))}

            {isError && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={COL_COUNT} className="text-destructive px-5 py-16 text-center">
                  목록을 불러오지 못했습니다.
                </TableCell>
              </TableRow>
            )}

            {rows?.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={COL_COUNT} className="px-5 py-16 text-center">
                  {q || yearFilter || visFilter ? (
                    <p className="text-muted-foreground text-sm">검색 결과가 없습니다.</p>
                  ) : (
                    <>
                      <p className="text-muted-foreground mb-4 text-sm">아직 시안이 없습니다.</p>
                      <NewProposalDialog />
                    </>
                  )}
                </TableCell>
              </TableRow>
            )}

            {rows?.map((p) => {
              const isPublic = p.visibility === "public";
              const hasPassword = isPublic && !!p.accessPasswordHash;
              const links = [
                { key: "id", label: "ID", name: "공개ID 링크", path: `/p/${p.publicId}` },
                ...(p.domain
                  ? [{ key: "domain", label: "도메인", name: "도메인 링크", path: `/p/${p.domain}` }]
                  : []),
              ];
              return (
                <TableRow key={p.id} className="border-border/60 border-b last:border-0">
                  <TableCell className={bodyCell}>
                    <Link
                      href={`/studio/proposals/${p.id}`}
                      className="hover:text-primary font-medium underline underline-offset-4 transition-colors"
                    >
                      {p.title}
                    </Link>
                  </TableCell>
                  <TableCell className={bodyCell}>
                    {p.participants ? (
                      <span className="text-foreground">{p.participants}</span>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </TableCell>
                  <TableCell className={cn(bodyCell, "tabular-nums")}>
                    {p.workYear ? (
                      <span className="text-foreground">{p.workYear}</span>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </TableCell>
                  <TableCell className={cn(bodyCell, "text-muted-foreground font-mono")}>
                    {p.publicId}
                  </TableCell>
                  <TableCell className={cn(bodyCell, "font-mono")}>
                    {p.domain ? (
                      <span className="text-foreground">{p.domain}</span>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </TableCell>
                  <TableCell className={bodyCell}>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant={isPublic ? "info" : "neutral"} size="md">
                        {isPublic ? "공개" : "비공개"}
                      </Badge>
                      {hasPassword && (
                        <Badge variant="purple" size="md">비번</Badge>
                      )}
                      {p.exposedToUxisworks && (
                        <Badge variant="success" size="md">노출</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className={bodyCell}>
                    <ProgressRing value={p.taggingProgress} />
                  </TableCell>
                  <TableCell
                    className={cn(bodyCell, "text-muted-foreground text-sm whitespace-nowrap tabular-nums")}
                  >
                    {formatDate(p.createdAt)}
                  </TableCell>
                  <TableCell
                    className={cn(bodyCell, "text-muted-foreground text-sm whitespace-nowrap tabular-nums")}
                  >
                    {formatDate(p.updatedAt)}
                  </TableCell>
                  <TableCell className={bodyCell}>
                    <div className="flex justify-end">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          aria-label="작업 메뉴"
                          className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-7 items-center justify-center rounded-full transition-colors"
                        >
                          <MoreVertical className="size-4" aria-hidden />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44 p-1.5">
                          <DropdownMenuItem
                            className={menuItem}
                            render={<Link href={`/studio/proposals/${p.id}`} />}
                          >
                            <Pencil />
                            수정하기
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className={menuItem}
                            onClick={() =>
                              setShareTarget({
                                title: p.title,
                                links: links.map((l) => ({
                                  key: l.key,
                                  label: l.label,
                                  path: l.path,
                                })),
                              })
                            }
                          >
                            <Share2 />
                            공유하기
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!shareTarget} onOpenChange={(open) => !open && setShareTarget(null)}>
        <DialogContent className="sm:max-w-md p-6">
          <DialogHeader className="mb-1">
            <DialogTitle>시안 공유</DialogTitle>
            {shareTarget && (
              <DialogDescription className="truncate">{shareTarget.title}</DialogDescription>
            )}
          </DialogHeader>
          {shareTarget && (
            <div className="flex flex-col gap-4">
              {shareTarget.links.map((l) => {
                const fullUrl = `${typeof window !== "undefined" ? window.location.origin : ""}${l.path}`;
                return (
                  <div key={l.key} className="flex flex-col gap-2">
                    <span className="text-muted-foreground text-xs font-medium">{l.label} 링크</span>
                    <div className="flex gap-2">
                      <input
                        readOnly
                        value={fullUrl}
                        className="bg-muted text-foreground border-input flex-1 rounded-md border px-3 py-1.5 font-mono text-xs outline-none"
                        onFocus={(e) => e.target.select()}
                      />
                      <Button
                        size="icon-sm"
                        variant="outline"
                        aria-label="링크 복사"
                        onClick={() => copyViewerLink(l.path)}
                      >
                        <Copy className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
              <a
                href={(shareTarget.links.find((l) => l.key === "domain") ?? shareTarget.links[0]).path}
                target="_blank"
                rel="noreferrer"
                className="border-input bg-background hover:bg-accent hover:text-accent-foreground mt-2 flex w-full items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors"
              >
                <ArrowUpRight className="size-4" />
                바로가기
              </a>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {total > 0 && (
        <div className="mt-4">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  disabled={page <= 1 || isPlaceholderData}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                />
              </PaginationItem>

              {pageItems(page, pageCount).map((item, i) =>
                item === "ellipsis" ? (
                  <PaginationItem key={`ellipsis-${i}`}>
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : (
                  <PaginationItem key={item}>
                    <PaginationLink
                      isActive={item === page}
                      disabled={isPlaceholderData}
                      onClick={() => setPage(item)}
                    >
                      {item}
                    </PaginationLink>
                  </PaginationItem>
                ),
              )}

              <PaginationItem>
                <PaginationNext
                  disabled={page >= pageCount || isPlaceholderData}
                  onClick={() => setPage((p) => p + 1)}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/pages/proposals-list/ui/proposals-list-page.tsx
git commit -m "feat(list): 시안 목록에 연도 칼럼 + 연도/공개상태 필터 추가"
```

---

## 실행 순서

Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 6 → Task 7 → Task 8 → Task 9

각 Task는 독립적으로 커밋되며, Task 8(설정 페이지 호출부 수정)은 Task 7 이후 진행한다.
