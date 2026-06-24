# 시안 유시스웍스 노출 토글 + 태깅 완성도 컬럼 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 시안에 (1) 유시스웍스 노출 여부 토글과 (2) 시안 리스트의 태깅 완성도 원형차트 컬럼을 추가한다.

**Architecture:** 기능1은 기존 `whiteboardEnabled` boolean이 거치는 경로(schema → 마이그레이션 → zod → mutation → detail → 설정 Switch → 리스트 배지)를 그대로 복제한다. 기능2는 목록 쿼리에 태그 구분 커버리지 집계를 더하고, 진행률(%)·색 구간은 순수 함수로 분리해 vitest로 검증하며, 표시는 SVG로 만든 `ProgressRing`이 담당한다.

**Tech Stack:** Next.js 16.2.9, React 19, Drizzle ORM(postgres), Zod 4, TanStack Query, Tailwind v4, vitest 4.

## Global Constraints

- Node `>=22.0.0`.
- Next.js 16.2.9 — 이 버전은 학습데이터와 다를 수 있으니 코드 작성 전 `node_modules/next/dist/docs/`의 관련 가이드를 확인한다(AGENTS.md).
- 모든 UI 카피는 한국어.
- 테스트는 `tests/**/*.test.ts`에만 둔다(vitest include 설정). `environment: node`라 DOM 렌더 테스트는 불가 — 순수 함수만 단위 테스트한다.
- 테스트는 `import { describe, it, expect } from "vitest";` + `@/` 경로 alias 사용(기존 `tests/pins/locate.test.ts` 패턴).
- Drizzle 마이그레이션은 `drizzle/migrations/NNNN_*.sql` 순번. 현재 최신 0016 → 신규는 0017.
- 리스트 테이블 컬럼 수가 8→9로 바뀌므로 `colSpan={8}`(에러/빈 상태 셀)을 모두 9로 갱신해야 한다.
- 검증 시 기존 무관 실패(lint 2건·format:check 전역·`tests/pins/locate.test.ts` 2건)는 내 변경과 무관하므로 새로 생긴 실패만 본다.

---

### Task 1: DB 스키마 + 마이그레이션 (`exposed_to_uxisworks`)

**Files:**
- Modify: `drizzle/schema.ts:28` (proposals 테이블)
- Create: `drizzle/migrations/0017_proposal_exposed_to_uxisworks.sql`
- Modify(자동): `drizzle/migrations/meta/_journal.json`, 스냅샷 (db:generate가 갱신)

**Interfaces:**
- Produces: `proposals.exposedToUxisworks` (boolean, NOT NULL, default false) → `Proposal` 타입에 자동 반영(`typeof proposals.$inferSelect`).

- [ ] **Step 1: 스키마에 컬럼 추가**

`drizzle/schema.ts`의 `proposals` 테이블에서 `whiteboardEnabled` 줄 바로 아래에 추가:

```ts
  whiteboardEnabled: boolean("whiteboard_enabled").notNull().default(false),
  // 유시스웍스(포트폴리오/갤러리) 노출 여부. visibility(공개 링크 접근)와 독립된 축.
  exposedToUxisworks: boolean("exposed_to_uxisworks").notNull().default(false),
```

- [ ] **Step 2: 마이그레이션 생성 시도**

Run: `npm run db:generate`
Expected: `drizzle/migrations/0017_*.sql`가 생성되고 내용이 아래와 동치인지 확인:
```sql
ALTER TABLE "proposals" ADD COLUMN "exposed_to_uxisworks" boolean DEFAULT false NOT NULL;
```

- [ ] **Step 3: 파일명/내용 확정**

생성된 파일명이 자동 슬러그라면 `0017_proposal_exposed_to_uxisworks.sql`로 맞추거나, 자동 생성이 실패/불가하면 위 SQL로 파일을 직접 만들고 `meta/_journal.json`에 0011 패턴과 동일하게 0017 엔트리를 수동 추가한다. 0016(seed)이 손상되지 않았는지 `git diff drizzle/migrations/meta`로 확인한다.

- [ ] **Step 4: 타입체크**

Run: `npx tsc --noEmit`
Expected: 신규 에러 없음(컬럼 추가는 `Proposal`에 비파괴적).

- [ ] **Step 5: 커밋**

```bash
git add drizzle/schema.ts drizzle/migrations
git commit -m "feat(proposal): 유시스웍스 노출 컬럼 추가 (마이그레이션 0017)"
```

---

### Task 2: 노출 토글 백엔드 (검증·저장·detail·타입)

**Files:**
- Modify: `src/entities/proposal/model/edit-schemas.ts:4-28`
- Modify: `src/entities/proposal/api/proposal-mutations.server.ts:12,36-37`
- Modify: `src/entities/proposal/model/types.ts:48-58` (`ProposalDetailHeader`)
- Modify: `src/entities/proposal/api/get-proposal-detail.server.ts:82-92`

**Interfaces:**
- Consumes: `proposals.exposedToUxisworks` (Task 1).
- Produces: `updateSettingsSchema`가 `exposedToUxisworks?: boolean` 수락; `ProposalDetailHeader.exposedToUxisworks: boolean`; detail API가 해당 값을 반환.

- [ ] **Step 1: zod 스키마에 필드 + refine 추가**

`edit-schemas.ts` `updateSettingsSchema`의 `whiteboardEnabled` 아래에 추가:
```ts
    whiteboardEnabled: z.boolean().optional(),
    exposedToUxisworks: z.boolean().optional(),
```
그리고 `.refine(...)`의 조건 체인에 한 줄 추가:
```ts
      v.whiteboardEnabled !== undefined ||
      v.exposedToUxisworks !== undefined ||
```

- [ ] **Step 2: mutation에 처리 추가**

`proposal-mutations.server.ts`의 구조분해에 `exposedToUxisworks` 추가:
```ts
  const { title, visibility, password, domain, whiteboardEnabled, exposedToUxisworks, participants, figmaUrl } =
    updateSettingsSchema.parse(input);
```
그리고 `whiteboardEnabled` 처리 줄 아래에:
```ts
  if (whiteboardEnabled !== undefined) updates.whiteboardEnabled = whiteboardEnabled;
  if (exposedToUxisworks !== undefined) updates.exposedToUxisworks = exposedToUxisworks;
```

- [ ] **Step 3: `ProposalDetailHeader` 타입에 필드 추가**

`types.ts`의 `ProposalDetailHeader`에서 `whiteboardEnabled` 아래:
```ts
  whiteboardEnabled: boolean;
  exposedToUxisworks: boolean;
```

- [ ] **Step 4: detail server가 값을 반환하도록 추가**

`get-proposal-detail.server.ts`의 반환 객체 `proposal` 안 `whiteboardEnabled` 아래:
```ts
      whiteboardEnabled: proposal.whiteboardEnabled,
      exposedToUxisworks: proposal.exposedToUxisworks,
```

- [ ] **Step 5: 타입체크**

Run: `npx tsc --noEmit`
Expected: 신규 에러 없음.

- [ ] **Step 6: 커밋**

```bash
git add src/entities/proposal
git commit -m "feat(proposal): 노출 토글 검증·저장·detail 연결"
```

---

### Task 3: 노출 토글 UI (설정 Switch) + 리스트 배지

**Files:**
- Modify: `src/features/edit-proposal-settings/ui/proposal-settings.tsx:46-64`(props), `:327`(화이트보드 카드 아래 새 카드)
- Modify: `src/pages/proposal-detail/ui/proposal-detail-page.tsx:130-139`(prop 전달)
- Modify: `src/pages/proposals-list/ui/proposals-list-page.tsx:212-223`(상태 셀 배지)

**Interfaces:**
- Consumes: `ProposalDetailHeader.exposedToUxisworks` (Task 2), 리스트의 `p.exposedToUxisworks`(Task 1으로 `Proposal`에 존재).

- [ ] **Step 1: 설정 컴포넌트 props에 추가**

`proposal-settings.tsx` 함수 인자(구조분해)와 타입에 `whiteboardEnabled` 옆으로 추가:
```ts
  visibility,
  hasPassword,
  whiteboardEnabled,
  exposedToUxisworks,
}: {
  ...
  whiteboardEnabled: boolean;
  exposedToUxisworks: boolean;
}) {
```

- [ ] **Step 2: 화이트보드 카드 아래 노출 카드 추가**

`proposal-settings.tsx`의 화이트보드 `</Card>`(현재 327줄) 다음에 동일 패턴으로:
```tsx
      {/* 유시스웍스 노출 */}
      <Card>
        <CardHeader>
          <CardTitle>유시스웍스 노출</CardTitle>
          <CardDescription>
            켜면 이 시안을 유시스웍스(포트폴리오/갤러리)에 노출합니다. 공개 링크 접근과는 별개입니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <label className="flex w-fit cursor-pointer items-center gap-3">
            <Switch
              checked={exposedToUxisworks}
              disabled={pending}
              onCheckedChange={(checked) => change({ exposedToUxisworks: checked })}
            />
            <span className="text-sm font-medium">{exposedToUxisworks ? "노출" : "노출 안 함"}</span>
          </label>
        </CardContent>
      </Card>
```

- [ ] **Step 3: detail 페이지에서 prop 전달**

`proposal-detail-page.tsx`의 `<ProposalSettings ...>`에 `whiteboardEnabled` 줄 아래:
```tsx
                whiteboardEnabled={proposal.whiteboardEnabled}
                exposedToUxisworks={proposal.exposedToUxisworks}
```

- [ ] **Step 4: 리스트 상태 셀에 노출 배지 추가**

`proposals-list-page.tsx`의 상태 셀 배지 묶음(비번 배지 아래)에 추가:
```tsx
                      {hasPassword && (
                        <Badge variant="purple" size="md">
                          비번
                        </Badge>
                      )}
                      {p.exposedToUxisworks && (
                        <Badge variant="success" size="md">
                          노출
                        </Badge>
                      )}
```

- [ ] **Step 5: 타입체크 + 빌드 확인**

Run: `npx tsc --noEmit`
Expected: 신규 에러 없음. (설정/리스트 모두 `exposedToUxisworks` 타입 일치.)

- [ ] **Step 6: 커밋**

```bash
git add src/features/edit-proposal-settings src/pages/proposal-detail src/pages/proposals-list
git commit -m "feat(proposal): 설정 노출 토글 + 리스트 노출 배지"
```

---

### Task 4: 태깅 진행률 순수 함수 (TDD)

**Files:**
- Create: `src/entities/proposal/lib/tagging-progress.ts`
- Test: `tests/proposals/tagging-progress.test.ts`

**Interfaces:**
- Produces: `taggingPercent(taggedGroups: number, totalGroups: number): number` — 0~100 정수. `totalGroups <= 0`이면 0.

- [ ] **Step 1: 실패 테스트 작성**

`tests/proposals/tagging-progress.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { taggingPercent } from "@/entities/proposal/lib/tagging-progress";

describe("taggingPercent", () => {
  it("0/6 → 0", () => expect(taggingPercent(0, 6)).toBe(0));
  it("3/6 → 50", () => expect(taggingPercent(3, 6)).toBe(50));
  it("6/6 → 100", () => expect(taggingPercent(6, 6)).toBe(100));
  it("1/6 → 17 (반올림)", () => expect(taggingPercent(1, 6)).toBe(17));
  it("2/6 → 33 (반올림)", () => expect(taggingPercent(2, 6)).toBe(33));
  it("총 구분 0이면 0 (0으로 나누기 방지)", () => expect(taggingPercent(0, 0)).toBe(0));
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm run test -- tagging-progress`
Expected: FAIL — 모듈/함수 없음.

- [ ] **Step 3: 최소 구현**

`src/entities/proposal/lib/tagging-progress.ts`:
```ts
// 태깅 완성도 = 태그가 1개 이상 선택된 구분 수 / 전체 구분 수 × 100 (0~100 정수).
// 전체 구분이 0이면 0으로 나누기를 피해 0을 반환한다.
export function taggingPercent(taggedGroups: number, totalGroups: number): number {
  if (totalGroups <= 0) return 0;
  return Math.round((taggedGroups / totalGroups) * 100);
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm run test -- tagging-progress`
Expected: PASS (6개).

- [ ] **Step 5: 커밋**

```bash
git add src/entities/proposal/lib/tagging-progress.ts tests/proposals/tagging-progress.test.ts
git commit -m "feat(proposal): 태깅 완성도 % 계산 함수 + 테스트"
```

---

### Task 5: ProgressRing 컴포넌트 + 색 구간 함수 (색 TDD)

**Files:**
- Create: `src/shared/ui/progress-ring/progress-color.ts`
- Create: `src/shared/ui/progress-ring/progress-ring.tsx`
- Create: `src/shared/ui/progress-ring/index.ts`
- Test: `tests/ui/progress-color.test.ts`

**Interfaces:**
- Produces: `progressRingColor(value: number): string` — CSS color 문자열(테마 변수). `ProgressRing` (default export 아님; named) props `{ value: number; size?: number }`.

- [ ] **Step 1: 색 함수 실패 테스트 작성**

`tests/ui/progress-color.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { progressRingColor } from "@/shared/ui/progress-ring/progress-color";

describe("progressRingColor (4단계 구간)", () => {
  it("0% → 회색", () => expect(progressRingColor(0)).toBe("var(--color-muted-foreground)"));
  it("1~33% → 빨강", () => {
    expect(progressRingColor(1)).toBe("var(--color-error)");
    expect(progressRingColor(33)).toBe("var(--color-error)");
  });
  it("34~66% → 주황", () => {
    expect(progressRingColor(34)).toBe("var(--color-accent-orange)");
    expect(progressRingColor(66)).toBe("var(--color-accent-orange)");
  });
  it("67~99% → 파랑", () => {
    expect(progressRingColor(67)).toBe("var(--color-info)");
    expect(progressRingColor(99)).toBe("var(--color-info)");
  });
  it("100% → 초록", () => expect(progressRingColor(100)).toBe("var(--color-success)"));
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm run test -- progress-color`
Expected: FAIL — 모듈/함수 없음.

- [ ] **Step 3: 색 함수 구현**

`src/shared/ui/progress-ring/progress-color.ts`:
```ts
// 진행률 4단계 색 구간(테마 변수). 0은 회색, 100은 초록.
export function progressRingColor(value: number): string {
  if (value <= 0) return "var(--color-muted-foreground)";
  if (value <= 33) return "var(--color-error)";
  if (value <= 66) return "var(--color-accent-orange)";
  if (value <= 99) return "var(--color-info)";
  return "var(--color-success)";
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm run test -- progress-color`
Expected: PASS.

- [ ] **Step 5: ProgressRing 컴포넌트 작성**

`src/shared/ui/progress-ring/progress-ring.tsx`:
```tsx
import { progressRingColor } from "./progress-color";

// 태깅 완성도용 SVG 도넛. value(0~100)와 색 구간 + 중앙 % 숫자.
// stroke는 CSS 변수를 쓰므로 presentation 속성이 아닌 style로 지정한다.
export function ProgressRing({ value, size = 36 }: { value: number; size?: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - clamped / 100);
  const color = progressRingColor(clamped);
  const center = size / 2;

  return (
    <span
      className="inline-flex items-center gap-2"
      role="img"
      aria-label={`태깅 완성도 ${clamped}%`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          style={{ stroke: "var(--color-muted)" }}
          strokeWidth={stroke}
        />
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          style={{ stroke: color }}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </svg>
      <span className="text-xs tabular-nums" style={{ color }}>
        {clamped}%
      </span>
    </span>
  );
}
```

- [ ] **Step 6: barrel export**

`src/shared/ui/progress-ring/index.ts`:
```ts
export { ProgressRing } from "./progress-ring";
export { progressRingColor } from "./progress-color";
```

- [ ] **Step 7: 타입체크**

Run: `npx tsc --noEmit`
Expected: 신규 에러 없음.

- [ ] **Step 8: 커밋**

```bash
git add src/shared/ui/progress-ring tests/ui/progress-color.test.ts
git commit -m "feat(ui): 태깅 완성도 ProgressRing + 색 구간 함수"
```

---

### Task 6: 목록 쿼리 태깅 집계 + `ProposalListItem` 타입

**Files:**
- Modify: `src/entities/proposal/model/types.ts` (`ProposalListItem` 추가)
- Modify: `src/entities/proposal/api/get-proposals.server.ts`
- Modify: `src/entities/proposal/api/get-proposals.ts` (반환 타입)
- Modify: `src/entities/proposal/index.ts` (타입 export)

**Interfaces:**
- Consumes: `taggingPercent` (Task 4); 스키마 `proposalTags`, `tagOptions`, `tagGroups`.
- Produces: `ProposalListItem = Proposal & { taggingProgress: number }`; `getProposals`(server·client) → `Paginated<ProposalListItem>`.

- [ ] **Step 1: 타입 추가**

`types.ts`의 `Proposal` re-export 아래:
```ts
// 목록 행 = 시안 + 태깅 완성도(0~100). 서버에서 구분 커버리지로 계산해 내려준다.
export type ProposalListItem = Proposal & { taggingProgress: number };
```

- [ ] **Step 2: index.ts에서 export**

`src/entities/proposal/index.ts`의 export type 목록에 `ProposalListItem` 추가:
```ts
  ProposalDetailHeader,
  ProposalDetail,
  ProposalListItem,
```

- [ ] **Step 3: 서버 쿼리 수정**

`get-proposals.server.ts`를 아래로 교체(집계 LEFT JOIN + 진행률 매핑):
```ts
import "server-only";
import { desc, eq, getTableColumns, ilike, or, sql } from "drizzle-orm";
import { db } from "@/shared/db";
import { proposals, proposalTags, tagGroups, tagOptions } from "@drizzle/schema";
import { requireEditor } from "@/shared/auth/guards.server";
import { taggingPercent } from "../lib/tagging-progress";
import { PROPOSALS_PAGE_SIZE, type Paginated, type ProposalListItem } from "../model/types";

export async function getProposals(
  page = 1,
  pageSize = PROPOSALS_PAGE_SIZE,
  search = "",
): Promise<Paginated<ProposalListItem>> {
  await requireEditor();

  const safePage = Math.max(1, Math.trunc(page));
  const safeSize = Math.min(100, Math.max(1, Math.trunc(pageSize)));

  // 제목·참여자·공개 도메인을 대소문자 무시(ILIKE)로 부분 검색. 값은 바인딩되어
  // 안전하며, LIKE 메타문자(% _ \)만 이스케이프해 와일드카드 주입을 막는다.
  const term = search.trim();
  const where = term
    ? or(
        ilike(proposals.title, `%${escapeLike(term)}%`),
        ilike(proposals.participants, `%${escapeLike(term)}%`),
        ilike(proposals.domain, `%${escapeLike(term)}%`),
      )
    : undefined;

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(proposals)
    .where(where);

  // 전체 구분 수(분모). 태그 구분이 없으면 0 → 진행률 0.
  const [{ totalGroups }] = await db
    .select({ totalGroups: sql<number>`count(*)::int` })
    .from(tagGroups);

  // 시안별로 태그가 1개 이상 달린 구분 수를 집계(LEFT JOIN → 태그 없으면 0).
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
    .orderBy(desc(proposals.updatedAt))
    .limit(safeSize)
    .offset((safePage - 1) * safeSize);

  const items: ProposalListItem[] = rows.map(({ taggedGroups, ...p }) => ({
    ...p,
    taggingProgress: taggingPercent(taggedGroups, totalGroups),
  }));

  return { items, total, page: safePage, pageSize: safeSize };
}

// ILIKE 패턴에서 와일드카드(%/_)와 이스케이프 문자(\)를 리터럴로 처리한다.
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}
```

- [ ] **Step 4: 클라이언트 호출 반환 타입 변경**

`get-proposals.ts`:
```ts
import { http } from "@/shared/api/http";
import { type Paginated, type ProposalListItem } from "../model/types";

export function getProposals(page = 1, search = ""): Promise<Paginated<ProposalListItem>> {
  const qs = new URLSearchParams({ page: String(page) });
  const term = search.trim();
  if (term) qs.set("q", term);
  return http<Paginated<ProposalListItem>>(`/api/proposals?${qs}`);
}
```

- [ ] **Step 5: 타입체크**

Run: `npx tsc --noEmit`
Expected: 신규 에러 없음. (리스트 페이지는 아직 `taggingProgress`를 안 쓰지만 `Proposal` 필드 접근은 그대로 유효.)

- [ ] **Step 6: 커밋**

```bash
git add src/entities/proposal
git commit -m "feat(proposal): 목록 쿼리에 태깅 완성도 집계 추가"
```

---

### Task 7: 리스트 태깅 컬럼 렌더

**Files:**
- Modify: `src/pages/proposals-list/ui/proposals-list-page.tsx`

**Interfaces:**
- Consumes: `ProgressRing` (Task 5), `p.taggingProgress` (Task 6).

- [ ] **Step 1: import 추가**

상단 import에 추가:
```ts
import { ProgressRing } from "@/shared/ui/progress-ring";
```

- [ ] **Step 2: 헤더에 "태깅" 컬럼 추가**

상태 헤더 줄(현재 110줄) 아래에:
```tsx
              <TableHead className={headCell}>상태</TableHead>
              <TableHead className={headCell}>태깅</TableHead>
```

- [ ] **Step 3: 스켈레톤 행에 셀 1개 추가**

스켈레톤 상태 셀(`<Skeleton className="h-5 w-12 rounded-full" />` 셀) 아래에:
```tsx
                  <TableCell className={bodyCell}>
                    <Skeleton className="size-9 rounded-full" />
                  </TableCell>
```

- [ ] **Step 4: 에러/빈 상태 colSpan 8 → 9**

`colSpan={8}` 2곳(에러 행, 빈 상태 행)을 모두 `colSpan={9}`로 변경.

- [ ] **Step 5: 데이터 행에 태깅 셀 추가**

상태 셀(`</TableCell>`, 비번/노출 배지 묶음 닫힌 직후) 다음에:
```tsx
                  <TableCell className={bodyCell}>
                    <ProgressRing value={p.taggingProgress} />
                  </TableCell>
```

- [ ] **Step 6: 타입체크 + 테스트 + 린트**

Run: `npx tsc --noEmit && npm run test && npm run lint`
Expected: 신규 타입 에러 없음. 신규 테스트 전부 PASS(기존 `locate.test.ts` 2건 실패는 무관). lint 신규 에러 없음(기존 2건 무관).

- [ ] **Step 7: 커밋**

```bash
git add src/pages/proposals-list
git commit -m "feat(proposal): 시안 리스트에 태깅 완성도 컬럼"
```

---

## 검증(수동 E2E — 마이그레이션 적용 후 사용자 확인)

1. `npm run db:migrate`로 0017 적용.
2. 시안 상세 → 설정 탭 → "유시스웍스 노출" 토글 ON → 리스트 상태 컬럼에 "노출" 배지 표시, OFF 시 사라짐.
3. 한 시안의 태그를 0개/일부 구분/전체 구분으로 바꿔가며 리스트 "태깅" 컬럼의 % 숫자와 원형차트 색이 4단계 구간(0 회색 / 빨강 / 주황 / 파랑 / 100 초록)에 맞게 변하는지 확인.

---

## Self-Review

- **Spec 커버리지:** 기능1(노출 토글) = Task 1·2·3 / 기능2(태깅 완성도 컬럼) = Task 4·5·6·7. 스펙의 영향 범위 표 9개 파일이 모두 어느 Task엔가 매핑됨. ✓
- **Placeholder:** 모든 코드 블록은 실제 코드. TBD/TODO 없음. ✓
- **타입 일관성:** `exposedToUxisworks`(boolean) 동일 표기 schema→zod→mutation→types→detail→props→배지. `taggingPercent(taggedGroups, totalGroups)`/`ProposalListItem.taggingProgress`/`progressRingColor(value)` 시그니처가 Task 4·5·6·7에서 일치. `getProposals` 반환 `Paginated<ProposalListItem>`로 server/client 동일. ✓
