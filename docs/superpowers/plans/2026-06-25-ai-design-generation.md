# AI 시안 생성 (AI Design Generation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관리자 전용 "AI 시안 생성" 스튜디오 메뉴 — 기초정보(회사명·페이지유형·태그·추가요청)를 받아, 태그가 일치하는 기존 시안 이미지(최대 10장)를 참고로 Claude(Sonnet 4.6, vision)가 완결형 HTML 시안을 생성하고, 작업중→완료 상태를 거쳐 raw HTML 뷰어로 열어보고 삭제할 수 있게 한다.

**Architecture:** 생성 요청은 `ai_designs` 행을 `working`으로 INSERT 후 **Vercel Workflow를 트리거**(durable, 자동 재시도)하고 즉시 반환. 워크플로우 step들이 참고 이미지 추출 → Claude 호출 → 행 갱신을 수행한다. UI는 `ai_designs` 행을 폴링(단일 진실원천). 기존 React 캔버스 뷰어와 별개의 admin-gated `text/html` 라우트로 결과를 연다.

**Tech Stack:** Next.js 16.2.9 (App Router), React 19, Drizzle ORM + postgres-js (Supabase), `@tanstack/react-query` v5 + `nuqs`, Base UI(`@base-ui/react`) + shadcn 래퍼(`@/shared/ui/*`), `sonner` 토스트, `lucide-react`, zod v4, vitest v4. **신규**: `@anthropic-ai/sdk`(Claude), `workflow`(Vercel Workflows).

설계 출처: `docs/superpowers/specs/2026-06-25-ai-design-generation-design.md`.

## Global Constraints

이 섹션의 규칙은 **모든 태스크에 암묵적으로 포함**된다.

- **Node ≥ 22** (`package.json` engines). DB 작업은 Node 22+ 필요.
- **Drizzle는 schema-first**: `drizzle/schema.ts`는 컬럼만 정의. **FK / `ON DELETE` / RLS는 손으로 SQL 마이그레이션에 추가** (레포 관례 — `drizzle/migrations/0015_proposal_tags.sql` 스타일 그대로). **마이그레이션 SQL은 직접 작성하고 `drizzle/migrations/meta/_journal.json`에 항목을 수동 추가**한다 — `npm run db:generate`는 **절대 금지**(드리프트: drizzle 스냅샷이 0008에서 멈춤).
- **enum은 PG enum 금지** → `check()` 제약(`sql\`${t.col} in ('a','b')\``).
- **import alias**: `@/*` → `./src/*`, `@drizzle/*` → `./drizzle/*`.
- **서버 함수**: `.server.ts` 파일은 최상단에 `import "server-only";`, 진입 시 권한 가드(`requireAdmin`)를 먼저 호출.
- **API 라우트**: thin. `try { return Response.json(await fn(...), {status}) } catch (e) { return toErrorResponse(e) }`. 동적 params는 **Promise** (`{ params }: { params: Promise<{ id: string }> }` → `const { id } = await params;`).
- **에러 코드**: 서버 함수는 `throw new Error("CODE")`. 매핑(`src/shared/api/to-error-response.ts`): `FORBIDDEN`→403, `NOT_FOUND`→404, `RATE_LIMITED`→429, ZodError→400, 그 외→500.
- **Base UI `Button`은 기본 `type="button"`** — 폼 제출 버튼엔 `type="submit"` 또는 `onClick` 명시 (메모리: base-ui-button-submit-type).
- **Claude 모델**: `process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6"`. `thinking: { type: "adaptive" }`(`budget_tokens` 금지), **스트리밍 + `.finalMessage()`**, vision은 `{ type: "image", source: { type: "url", url } }` 블록.
- **테스트**: vitest. 파일은 `tests/**/*.test.ts(x)`. 실행 `npm test`. 모킹은 `vi.mock` + 체인은 `vi.hoisted`(기존 `tests/features/auth/update-name.server.test.ts` 패턴).
- **검증 명령**: `npm test`, `npm run lint`, `npm run format:check`.
- **무관 기존 실패**(메모리 repo-verification-gotchas): lint 2건, `format:check` 전역 실패, `locate.test.ts` 2건은 **내 변경과 무관** — 내 탓으로 오인하지 말 것. 내 새 파일에 대해서만 lint/format을 통과시킨다.
- **시크릿 커밋 금지**: `ANTHROPIC_API_KEY`는 `.env.local`에만, `.env.example`엔 placeholder.

---

## Task 1: DB 스키마 + 마이그레이션 0019 (`ai_designs`, `ai_design_tags`)

**Files:**
- Modify: `drizzle/schema.ts` (테이블 2개 + 타입 추가)
- Create: `drizzle/migrations/0019_ai_designs.sql` (**손으로 직접 작성** — `db:generate` 금지)
- Modify: `drizzle/migrations/meta/_journal.json` (idx 19 항목 추가)

> ⚠️ **이 레포는 마이그레이션을 수동 작성한다.** drizzle 스냅샷이 0008에서 멈춰 있어 `npm run db:generate`는 드리프트 SQL을 뱉는다. 0009~0018처럼 **SQL 파일을 직접 쓰고 `_journal.json`에 항목을 추가**한 뒤 `db:migrate`로 적용한다. `db:generate`는 절대 실행하지 않는다.

**Interfaces:**
- Produces: 테이블 `aiDesigns`(`id,title,company,pageType,extraNotes,status,html,errorMessage,model,createdBy,createdAt,updatedAt`), `aiDesignTags`(`aiDesignId,optionId`); 타입 `AiDesign = typeof aiDesigns.$inferSelect`.

- [ ] **Step 1: 스키마에 테이블 추가**

`drizzle/schema.ts` 맨 아래에 추가 (import 라인은 이미 `pgTable, uuid, text, timestamp, integer, unique, check, index, real, boolean, jsonb, primaryKey`와 `sql`를 포함하므로 변경 불필요):

```typescript
// === AI 시안 생성 (AI Design Generation) ===
export const aiDesigns = pgTable(
  "ai_designs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(), // 제목
    company: text("company"), // 회사명(선택)
    pageType: text("page_type").notNull(), // 'main' | 'dashboard' | 'subpage'
    extraNotes: text("extra_notes"), // 자유 추가 요청
    status: text("status").notNull().default("working"), // 'working' | 'done' | 'failed'
    html: text("html"), // 완료 시 채워짐
    errorMessage: text("error_message"),
    model: text("model"), // 사용 모델 id 기록
    createdBy: uuid("created_by"), // FK → profiles (SQL, set null)
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("ai_designs_page_type_check", sql`${t.pageType} in ('main', 'dashboard', 'subpage')`),
    check("ai_designs_status_check", sql`${t.status} in ('working', 'done', 'failed')`),
  ],
);

export type AiDesign = typeof aiDesigns.$inferSelect;

export const aiDesignTags = pgTable(
  "ai_design_tags",
  {
    aiDesignId: uuid("ai_design_id").notNull(), // FK → ai_designs (SQL, cascade)
    optionId: uuid("option_id").notNull(), // FK → tag_options (SQL, cascade)
  },
  (t) => [primaryKey({ columns: [t.aiDesignId, t.optionId] })],
);

export type AiDesignTag = typeof aiDesignTags.$inferSelect;
```

- [ ] **Step 2: 마이그레이션 SQL 직접 작성**

`drizzle/migrations/0019_ai_designs.sql` 파일을 **손으로 생성**(`db:generate` 사용 금지). 내용 전체(`0015_proposal_tags.sql` 스타일, `--> statement-breakpoint`로 구분):

```sql
CREATE TABLE "ai_designs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"company" text,
	"page_type" text NOT NULL,
	"extra_notes" text,
	"status" text DEFAULT 'working' NOT NULL,
	"html" text,
	"error_message" text,
	"model" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_designs_page_type_check" CHECK ("page_type" in ('main', 'dashboard', 'subpage')),
	CONSTRAINT "ai_designs_status_check" CHECK ("status" in ('working', 'done', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "ai_design_tags" (
	"ai_design_id" uuid NOT NULL,
	"option_id" uuid NOT NULL,
	CONSTRAINT "ai_design_tags_pk" PRIMARY KEY("ai_design_id","option_id")
);
--> statement-breakpoint
ALTER TABLE "ai_design_tags" ADD CONSTRAINT "ai_design_tags_ai_design_id_ai_designs_fk" FOREIGN KEY ("ai_design_id") REFERENCES "ai_designs"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "ai_design_tags" ADD CONSTRAINT "ai_design_tags_option_id_tag_options_fk" FOREIGN KEY ("option_id") REFERENCES "tag_options"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "ai_designs" ADD CONSTRAINT "ai_designs_created_by_profiles_fk" FOREIGN KEY ("created_by") REFERENCES "profiles"("id") ON DELETE set null;
--> statement-breakpoint
ALTER TABLE "ai_designs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "ai_designs" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "ai_design_tags" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "ai_design_tags" FORCE ROW LEVEL SECURITY;
```

> 이 테이블들은 관리자 전용 서버 함수로만 접근하므로 정책 없이 FORCE RLS면 외부 직접 접근이 차단된다(기존 테이블과 동일 패턴).

- [ ] **Step 3: journal에 항목 추가**

`drizzle/migrations/meta/_journal.json`의 `entries` 배열 끝(idx 18 다음)에 추가. `when`은 0018의 `1783200000000`에서 증가시킨 값:

```json
    ,{
      "idx": 19,
      "version": "7",
      "when": 1783300000000,
      "tag": "0019_ai_designs",
      "breakpoints": true
    }
```

(즉 마지막 항목 뒤에 콤마+객체를 넣어 유효한 JSON 배열을 유지한다. 들여쓰기는 기존 항목과 동일하게.)

- [ ] **Step 4: 마이그레이션 적용**

Run: `npm run db:migrate`
Expected: `0019_ai_designs` 적용 성공. (Node ≥ 22, `DATABASE_URL`은 `.env.local`. drizzle-kit는 journal + sql 파일로 미적용 마이그레이션을 적용한다 — 스냅샷 불필요.)

- [ ] **Step 5: 타입체크**

Run: `npx tsc --noEmit`
Expected: 새 스키마/타입으로 인한 에러 없음(기존 무관 에러는 무시).

- [ ] **Step 6: 커밋**

```bash
git add drizzle/schema.ts drizzle/migrations/0019_ai_designs.sql drizzle/migrations/meta/_journal.json
git commit -m "feat(ai-design): add ai_designs + ai_design_tags tables (migration 0019)"
```

---

## Task 2: 모델 타입 + zod 스키마 + 상수

**Files:**
- Create: `src/entities/ai-design/model/constants.ts`
- Create: `src/entities/ai-design/model/types.ts`
- Create: `src/entities/ai-design/model/schemas.ts`
- Test: `tests/entities/ai-design/schemas.test.ts`

**Interfaces:**
- Consumes: 없음.
- Produces:
  - `PAGE_TYPES = ["main","dashboard","subpage"] as const`; `PageType`.
  - `AI_DESIGN_MODEL: string` (env 기본 `claude-sonnet-4-6`).
  - `MODAL_TAG_GROUP_CODES: string[]` (모달 노출 그룹 화이트리스트).
  - `AI_DESIGN_STATUSES`, `AiDesignStatus`.
  - `GenerationInput` 타입.
  - `AiDesignListItem` DTO 타입.
  - `createAiDesignSchema` (zod) + `CreateAiDesignInput`.

- [ ] **Step 1: 상수 파일 작성**

`src/entities/ai-design/model/constants.ts`:

```typescript
export const PAGE_TYPES = ["main", "dashboard", "subpage"] as const;
export type PageType = (typeof PAGE_TYPES)[number];

export const AI_DESIGN_STATUSES = ["working", "done", "failed"] as const;
export type AiDesignStatus = (typeof AI_DESIGN_STATUSES)[number];

// env로 교체 가능. 기본은 사용자가 선택한 Sonnet 4.6.
export const AI_DESIGN_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

// 모달에 노출할 태그 그룹 코드 화이트리스트(생성에 유용한 것만).
// 시드(0016_seed_tags.sql)의 실제 group.code와 일치해야 한다 — 구현 시 확인하고,
// taxonomy에 없는 코드는 무시되며(아래 모달 로직), 하나도 없으면 전체 그룹을 노출한다.
export const MODAL_TAG_GROUP_CODES = ["field", "style", "target", "structure"];
```

- [ ] **Step 2: 타입 파일 작성**

`src/entities/ai-design/model/types.ts`:

```typescript
import type { PageType, AiDesignStatus } from "./constants";

// 생성 step에 넘기는 입력(직렬화 가능해야 함 — workflow step 경계를 넘음).
export type GenerationInput = {
  title: string;
  company: string | null;
  pageType: PageType;
  tagLabels: string[];
  extraNotes: string | null;
};

// 목록 행 DTO(클라이언트로 반환; 내부 컬럼 일부 제외).
export type AiDesignListItem = {
  id: string;
  title: string;
  company: string | null;
  pageType: PageType;
  status: AiDesignStatus;
  hasHtml: boolean;
  errorMessage: string | null;
  createdAt: string; // ISO
  updatedAt: string; // ISO
};
```

- [ ] **Step 3: zod 스키마 작성**

`src/entities/ai-design/model/schemas.ts` (기존 `src/entities/tag/model/schemas.ts` 스타일):

```typescript
import { z } from "zod";
import { PAGE_TYPES } from "./constants";

export const createAiDesignSchema = z.object({
  title: z.string().trim().min(1, "제목을 입력하세요").max(100),
  company: z.string().trim().max(100).nullable().optional(),
  pageType: z.enum(PAGE_TYPES),
  optionIds: z.array(z.uuid()).max(50).default([]),
  extraNotes: z.string().trim().max(2000).nullable().optional(),
});

export type CreateAiDesignInput = z.infer<typeof createAiDesignSchema>;
```

- [ ] **Step 4: 실패하는 테스트 작성**

`tests/entities/ai-design/schemas.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { createAiDesignSchema } from "@/entities/ai-design/model/schemas";

describe("createAiDesignSchema", () => {
  it("최소 유효 입력을 통과시킨다", () => {
    const parsed = createAiDesignSchema.parse({ title: "ACME", pageType: "main" });
    expect(parsed.title).toBe("ACME");
    expect(parsed.optionIds).toEqual([]);
  });

  it("title 공백을 trim하고 빈 title을 거부한다", () => {
    expect(() => createAiDesignSchema.parse({ title: "   ", pageType: "main" })).toThrow();
  });

  it("잘못된 pageType을 거부한다", () => {
    expect(() => createAiDesignSchema.parse({ title: "A", pageType: "landing" })).toThrow();
  });

  it("optionIds는 uuid 배열이어야 한다", () => {
    expect(() => createAiDesignSchema.parse({ title: "A", pageType: "main", optionIds: ["nope"] })).toThrow();
  });
});
```

- [ ] **Step 5: 테스트 실행(실패 확인)**

Run: `npx vitest run tests/entities/ai-design/schemas.test.ts`
Expected: FAIL — 파일/모듈 미존재 또는 import 실패.

- [ ] **Step 6: 테스트 통과 확인**

Steps 1-3을 작성했으면 다시:
Run: `npx vitest run tests/entities/ai-design/schemas.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 7: 커밋**

```bash
git add src/entities/ai-design/model tests/entities/ai-design/schemas.test.ts
git commit -m "feat(ai-design): model types, zod schema, constants"
```

---

## Task 3: 태그 매칭 참고 이미지 쿼리

**Files:**
- Create: `src/entities/ai-design/api/get-tag-matched-images.server.ts`
- Create: `src/entities/ai-design/lib/pick-cover-paths.ts` (순수 함수 — 테스트 대상)
- Test: `tests/entities/ai-design/pick-cover-paths.test.ts`

**Interfaces:**
- Consumes: `publicUrl`(`@/shared/lib/proposals/constants`), 스키마 `proposalTags/proposalVariants/proposalPages`.
- Produces: `getTagMatchedImages(optionIds: string[], limit?: number): Promise<{ proposalId: string; url: string }[]>`; `pickCoverPaths(...)`.

- [ ] **Step 1: 순수 커버 선택 헬퍼의 실패 테스트 작성**

`tests/entities/ai-design/pick-cover-paths.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { pickCoverPaths } from "@/entities/ai-design/lib/pick-cover-paths";

describe("pickCoverPaths", () => {
  const matched = [
    { proposalId: "p1", matches: 3 },
    { proposalId: "p2", matches: 1 },
  ];
  const variants = [
    { proposalId: "p1", currentVersionId: "v1", sortOrder: 0 },
    { proposalId: "p1", currentVersionId: "v2", sortOrder: 1 },
    { proposalId: "p2", currentVersionId: null, sortOrder: 0 },
  ];
  const pages = [
    { versionId: "v1", storagePath: "p1/v1/a.png", pageOrder: 1 },
    { versionId: "v1", storagePath: "p1/v1/b.png", pageOrder: 0 },
  ];

  it("매칭수 순서를 보존하고 각 시안의 첫 안의 첫 페이지(pageOrder 최소)를 고른다", () => {
    expect(pickCoverPaths(matched, variants, pages)).toEqual([{ proposalId: "p1", storagePath: "p1/v1/b.png" }]);
    // p2는 currentVersionId 없음 → 제외
  });

  it("후보가 없으면 빈 배열", () => {
    expect(pickCoverPaths([], [], [])).toEqual([]);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/entities/ai-design/pick-cover-paths.test.ts`
Expected: FAIL (모듈 없음).

- [ ] **Step 3: 순수 헬퍼 구현**

`src/entities/ai-design/lib/pick-cover-paths.ts`:

```typescript
type Matched = { proposalId: string; matches: number };
type Variant = { proposalId: string; currentVersionId: string | null; sortOrder: number };
type Page = { versionId: string; storagePath: string; pageOrder: number };

// matched(매칭수 desc 정렬됨)의 순서를 보존하며, 각 시안에서 sortOrder가 빠른 안의
// currentVersion 첫 페이지(pageOrder 최소)를 커버로 고른다. 이미지가 없는 시안은 건너뛴다.
export function pickCoverPaths(
  matched: Matched[],
  variants: Variant[],
  pages: Page[],
): { proposalId: string; storagePath: string }[] {
  const versionsByProposal = new Map<string, string[]>();
  for (const v of [...variants].sort((a, b) => a.sortOrder - b.sortOrder)) {
    if (!v.currentVersionId) continue;
    const list = versionsByProposal.get(v.proposalId) ?? [];
    list.push(v.currentVersionId);
    versionsByProposal.set(v.proposalId, list);
  }

  const firstPathByVersion = new Map<string, string>();
  for (const p of [...pages].sort((a, b) => a.pageOrder - b.pageOrder)) {
    if (!firstPathByVersion.has(p.versionId)) firstPathByVersion.set(p.versionId, p.storagePath);
  }

  const out: { proposalId: string; storagePath: string }[] = [];
  for (const m of matched) {
    for (const versionId of versionsByProposal.get(m.proposalId) ?? []) {
      const path = firstPathByVersion.get(versionId);
      if (path) {
        out.push({ proposalId: m.proposalId, storagePath: path });
        break;
      }
    }
  }
  return out;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/entities/ai-design/pick-cover-paths.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: 서버 쿼리 구현(헬퍼 사용)**

`src/entities/ai-design/api/get-tag-matched-images.server.ts`:

```typescript
import "server-only";
import { asc, desc, inArray, sql } from "drizzle-orm";
import { db } from "@/shared/db";
import { proposalTags, proposalVariants, proposalPages } from "@drizzle/schema";
import { publicUrl } from "@/shared/lib/proposals/constants";
import { pickCoverPaths } from "../lib/pick-cover-paths";

// 선택 태그(optionIds)로 전체 시안에서 느슨 매칭 + 매칭수 정렬 → 각 시안 커버 1장.
// 항상 결과가 나오도록 한다(0건 허용). 최대 limit개.
export async function getTagMatchedImages(
  optionIds: string[],
  limit = 10,
): Promise<{ proposalId: string; url: string }[]> {
  if (optionIds.length === 0) return [];

  const matched = await db
    .select({ proposalId: proposalTags.proposalId, matches: sql<number>`count(*)::int` })
    .from(proposalTags)
    .where(inArray(proposalTags.optionId, optionIds))
    .groupBy(proposalTags.proposalId)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);

  const proposalIds = matched.map((m) => m.proposalId);
  if (proposalIds.length === 0) return [];

  const variants = await db
    .select({
      proposalId: proposalVariants.proposalId,
      currentVersionId: proposalVariants.currentVersionId,
      sortOrder: proposalVariants.sortOrder,
    })
    .from(proposalVariants)
    .where(inArray(proposalVariants.proposalId, proposalIds));

  const versionIds = variants.map((v) => v.currentVersionId).filter((x): x is string => !!x);
  if (versionIds.length === 0) return [];

  const pages = await db
    .select({
      versionId: proposalPages.versionId,
      storagePath: proposalPages.storagePath,
      pageOrder: proposalPages.pageOrder,
    })
    .from(proposalPages)
    .where(inArray(proposalPages.versionId, versionIds))
    .orderBy(asc(proposalPages.pageOrder));

  return pickCoverPaths(matched, variants, pages).map((c) => ({
    proposalId: c.proposalId,
    url: publicUrl(c.storagePath),
  }));
}
```

- [ ] **Step 6: 타입체크 + 커밋**

Run: `npx tsc --noEmit` (새 파일 관련 에러 없음 확인)

```bash
git add src/entities/ai-design/api/get-tag-matched-images.server.ts src/entities/ai-design/lib/pick-cover-paths.ts tests/entities/ai-design/pick-cover-paths.test.ts
git commit -m "feat(ai-design): tag-matched reference image query"
```

---

## Task 4: Claude 호출 (`@anthropic-ai/sdk` 설치 + env + generate-html)

**Files:**
- Modify: `package.json` (의존성 `@anthropic-ai/sdk` 추가 — `npm i`로)
- Modify: `.env.example` (placeholder)
- Create: `src/entities/ai-design/api/generate-html.server.ts`
- Create: `src/entities/ai-design/lib/strip-code-fence.ts` (순수)
- Test: `tests/entities/ai-design/strip-code-fence.test.ts`
- Test: `tests/entities/ai-design/generate-html.server.test.ts`

**Interfaces:**
- Consumes: `GenerationInput`(model/types), `AI_DESIGN_MODEL`(model/constants).
- Produces: `generateHtml(input: GenerationInput, imageUrls: string[]): Promise<string>`; `stripCodeFence(s: string): string`.

- [ ] **Step 1: SDK 설치**

Run: `npm i @anthropic-ai/sdk`
Expected: `package.json` dependencies에 `@anthropic-ai/sdk` 추가, lockfile 갱신. (SDK는 `ANTHROPIC_API_KEY` env를 자동 인식.)

- [ ] **Step 2: `.env.example`에 placeholder 추가**

`.env.example` 끝에 추가(실제 키는 `.env.local`에만 — 커밋 금지):

```
# Anthropic (AI 시안 생성). 서버 전용 시크릿 — 클라이언트에 노출 금지.
ANTHROPIC_API_KEY="sk-ant-..."
# 사용할 Claude 모델(기본 claude-sonnet-4-6). 비우면 코드 기본값 사용.
ANTHROPIC_MODEL="claude-sonnet-4-6"
```

또한 `.env.local`에 실제 키를 추가(없으면 생성 step이 실패한다). **이 파일은 절대 커밋하지 않는다.**

- [ ] **Step 3: strip-code-fence 실패 테스트**

`tests/entities/ai-design/strip-code-fence.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { stripCodeFence } from "@/entities/ai-design/lib/strip-code-fence";

describe("stripCodeFence", () => {
  it("```html 펜스를 제거한다", () => {
    expect(stripCodeFence("```html\n<h1>hi</h1>\n```")).toBe("<h1>hi</h1>");
  });
  it("언어 없는 펜스도 제거한다", () => {
    expect(stripCodeFence("```\n<p>x</p>\n```")).toBe("<p>x</p>");
  });
  it("펜스가 없으면 trim만 한다", () => {
    expect(stripCodeFence("  <html></html>  ")).toBe("<html></html>");
  });
});
```

- [ ] **Step 4: 실패 확인**

Run: `npx vitest run tests/entities/ai-design/strip-code-fence.test.ts`
Expected: FAIL (모듈 없음).

- [ ] **Step 5: strip-code-fence 구현**

`src/entities/ai-design/lib/strip-code-fence.ts`:

```typescript
// Claude가 ```html ... ``` 코드펜스로 감싸 응답하는 경우 본문만 추출. 펜스가 없으면 trim.
export function stripCodeFence(s: string): string {
  const trimmed = s.trim();
  const fence = /^```[a-zA-Z]*\n([\s\S]*?)\n?```$/;
  const m = trimmed.match(fence);
  return (m ? m[1] : trimmed).trim();
}
```

- [ ] **Step 6: strip-code-fence 통과 확인**

Run: `npx vitest run tests/entities/ai-design/strip-code-fence.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: generate-html 구현**

`src/entities/ai-design/api/generate-html.server.ts`:

```typescript
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { AI_DESIGN_MODEL } from "../model/constants";
import type { GenerationInput } from "../model/types";
import { stripCodeFence } from "../lib/strip-code-fence";

const PAGE_TYPE_LABEL: Record<GenerationInput["pageType"], string> = {
  main: "메인/랜딩 페이지",
  dashboard: "대시보드(좌측 사이드바 + 상단 KPI 카드 + 차트/표)",
  subpage: "서브페이지(헤더 + 본문 + 사이드)",
};

const SYSTEM_PROMPT = [
  "당신은 시니어 웹 디자이너 겸 프론트엔드 개발자입니다.",
  "요구사항과 참고 이미지(기존 시안)를 분석해, 하나의 완결형 HTML 문서를 생성합니다.",
  "규칙:",
  "- 출력은 '<!DOCTYPE html>'로 시작하는 단일 HTML 문서 문자열만. 설명/마크다운/코드펜스 금지.",
  "- CSS는 <style>에 인라인. 외부 스크립트/네트워크/폰트 CDN 의존을 최소화.",
  "- 참고 이미지의 레이아웃/톤/구성요소를 참고하되 그대로 베끼지 말고 요구사항에 맞게 재구성.",
  "- 한국어 콘텐츠. 실제같은 더미 텍스트 사용.",
].join("\n");

function buildUserText(input: GenerationInput): string {
  const lines = [
    `회사/제목: ${input.title}${input.company ? ` (${input.company})` : ""}`,
    `페이지 유형: ${PAGE_TYPE_LABEL[input.pageType]}`,
  ];
  if (input.tagLabels.length) lines.push(`태그/방향성: ${input.tagLabels.join(", ")}`);
  if (input.extraNotes) lines.push(`추가 요청사항: ${input.extraNotes}`);
  lines.push("", "위 요구사항과 첨부된 참고 시안 이미지를 바탕으로 HTML 시안을 생성하세요.");
  return lines.join("\n");
}

const client = new Anthropic();

// Claude(Sonnet 4.6, vision, streaming)로 HTML 시안 생성. 실패 시 throw(워크플로우가 잡아 failed 처리).
export async function generateHtml(input: GenerationInput, imageUrls: string[]): Promise<string> {
  const content: Anthropic.ContentBlockParam[] = [
    ...imageUrls.map(
      (url): Anthropic.ContentBlockParam => ({ type: "image", source: { type: "url", url } }),
    ),
    { type: "text", text: buildUserText(input) },
  ];

  const stream = client.messages.stream({
    model: AI_DESIGN_MODEL,
    max_tokens: 64000,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content }],
  });

  const message = await stream.finalMessage();
  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  const html = stripCodeFence(text);
  if (!html) throw new Error("EMPTY_GENERATION");
  return html;
}
```

> 타입 주의: `@anthropic-ai/sdk`는 `thinking: { type: "adaptive" }`와 `output_config: { effort }`를 지원한다(현재 SDK). 만약 설치된 버전이 `output_config`를 타입에서 누락하면 SDK를 최신으로 올리거나(`npm i @anthropic-ai/sdk@latest`) 해당 줄을 제거(effort 기본값 사용)한다. `messages.stream`은 `messages.create`와 동일 파라미터를 받는다.

- [ ] **Step 8: generate-html 테스트(SDK 모킹)**

`tests/entities/ai-design/generate-html.server.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const finalMessage = vi.fn();
const streamFn = vi.fn(() => ({ finalMessage }));
// @anthropic-ai/sdk default export = class Anthropic; new Anthropic() → { messages: { stream } }
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { stream: streamFn };
  },
}));

import { generateHtml } from "@/entities/ai-design/api/generate-html.server";

beforeEach(() => vi.clearAllMocks());

describe("generateHtml", () => {
  it("코드펜스를 벗긴 HTML 텍스트를 반환한다", async () => {
    finalMessage.mockResolvedValue({
      content: [{ type: "text", text: "```html\n<!DOCTYPE html><html></html>\n```" }],
    });
    const html = await generateHtml(
      { title: "ACME", company: null, pageType: "main", tagLabels: ["미니멀"], extraNotes: null },
      ["https://x/img.png"],
    );
    expect(html).toBe("<!DOCTYPE html><html></html>");
    // 이미지 블록 + 텍스트 블록이 전달됐는지
    const arg = streamFn.mock.calls[0][0];
    expect(arg.messages[0].content[0]).toMatchObject({ type: "image", source: { type: "url" } });
    expect(arg.model).toBeTruthy();
  });

  it("빈 응답이면 EMPTY_GENERATION을 던진다", async () => {
    finalMessage.mockResolvedValue({ content: [{ type: "text", text: "   " }] });
    await expect(
      generateHtml({ title: "A", company: null, pageType: "main", tagLabels: [], extraNotes: null }, []),
    ).rejects.toThrow("EMPTY_GENERATION");
  });
});
```

- [ ] **Step 9: 테스트 실행**

Run: `npx vitest run tests/entities/ai-design/generate-html.server.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 10: 커밋** (`.env.local`은 절대 add 하지 않는다)

```bash
git add package.json package-lock.json .env.example src/entities/ai-design/api/generate-html.server.ts src/entities/ai-design/lib/strip-code-fence.ts tests/entities/ai-design/strip-code-fence.test.ts tests/entities/ai-design/generate-html.server.test.ts
git commit -m "feat(ai-design): Claude HTML generation (Sonnet 4.6, vision, streaming)"
```

---

## Task 5: 생성 mutation 서버 함수 (resolveReferences / markDone / markFailed)

**Files:**
- Create: `src/entities/ai-design/api/generation-mutations.server.ts`
- Test: `tests/entities/ai-design/generation-mutations.server.test.ts`

**Interfaces:**
- Consumes: `getTagMatchedImages`, 스키마 `aiDesigns/aiDesignTags/tagOptions`, `GenerationInput`.
- Produces:
  - `resolveReferences(id): Promise<{ input: GenerationInput; imageUrls: string[] }>`
  - `markDone(id: string, html: string): Promise<void>`
  - `markFailed(id: string, message: string): Promise<void>`

- [ ] **Step 1: 구현**

`src/entities/ai-design/api/generation-mutations.server.ts`:

```typescript
import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { aiDesigns, aiDesignTags, tagOptions } from "@drizzle/schema";
import { getTagMatchedImages } from "./get-tag-matched-images.server";
import type { GenerationInput } from "../model/types";
import type { PageType } from "../model/constants";

export async function resolveReferences(
  id: string,
): Promise<{ input: GenerationInput; imageUrls: string[] }> {
  const [row] = await db.select().from(aiDesigns).where(eq(aiDesigns.id, id)).limit(1);
  if (!row) throw new Error("NOT_FOUND");

  const tagRows = await db
    .select({ optionId: aiDesignTags.optionId, label: tagOptions.label })
    .from(aiDesignTags)
    .innerJoin(tagOptions, eq(tagOptions.id, aiDesignTags.optionId))
    .where(eq(aiDesignTags.aiDesignId, id));

  const images = await getTagMatchedImages(tagRows.map((t) => t.optionId));

  return {
    input: {
      title: row.title,
      company: row.company,
      pageType: row.pageType as PageType,
      tagLabels: tagRows.map((t) => t.label),
      extraNotes: row.extraNotes,
    },
    imageUrls: images.map((i) => i.url),
  };
}

export async function markDone(id: string, html: string): Promise<void> {
  await db
    .update(aiDesigns)
    .set({ html, status: "done", errorMessage: null, updatedAt: new Date() })
    .where(eq(aiDesigns.id, id));
}

export async function markFailed(id: string, message: string): Promise<void> {
  await db
    .update(aiDesigns)
    .set({ status: "failed", errorMessage: message.slice(0, 500), updatedAt: new Date() })
    .where(eq(aiDesigns.id, id));
}
```

- [ ] **Step 2: 테스트(db + getTagMatchedImages 모킹)**

`tests/entities/ai-design/generation-mutations.server.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/entities/ai-design/api/get-tag-matched-images.server", () => ({
  getTagMatchedImages: vi.fn(async () => [{ proposalId: "p1", url: "https://x/a.png" }]),
}));

// db.update(...).set(...).where(...) 체인
const { update, set, where, selectChain } = vi.hoisted(() => {
  const where = vi.fn(async () => undefined);
  const set = vi.fn(() => ({ where }));
  const update = vi.fn(() => ({ set }));
  const selectChain = vi.fn();
  return { update, set, where, selectChain };
});
vi.mock("@/shared/db", () => ({ db: { update, select: selectChain } }));

import { markDone, markFailed, resolveReferences } from "@/entities/ai-design/api/generation-mutations.server";

beforeEach(() => vi.clearAllMocks());

describe("generation mutations", () => {
  it("markDone: status=done, html 설정", async () => {
    await markDone("d1", "<html></html>");
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ status: "done", html: "<html></html>" }));
    expect(where).toHaveBeenCalled();
  });

  it("markFailed: status=failed, 메시지 500자 제한", async () => {
    await markFailed("d1", "x".repeat(600));
    const arg = set.mock.calls[0][0];
    expect(arg.status).toBe("failed");
    expect(arg.errorMessage.length).toBe(500);
  });

  it("resolveReferences: 행이 없으면 NOT_FOUND", async () => {
    // 1st select() → ai_designs row (빈 결과)
    selectChain.mockReturnValueOnce({
      from: () => ({ where: () => ({ limit: async () => [] }) }),
    });
    await expect(resolveReferences("missing")).rejects.toThrow("NOT_FOUND");
  });
});
```

- [ ] **Step 3: 실행**

Run: `npx vitest run tests/entities/ai-design/generation-mutations.server.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 4: 커밋**

```bash
git add src/entities/ai-design/api/generation-mutations.server.ts tests/entities/ai-design/generation-mutations.server.test.ts
git commit -m "feat(ai-design): generation mutations (resolveReferences/markDone/markFailed)"
```

---

## Task 6: Vercel Workflows 설정 + 워크플로우/스텝 파일

**Files:**
- Modify: `package.json` (`workflow` 추가 — `npm i`로)
- Modify: `next.config.ts` (`withWorkflow` 래핑)
- Modify: `tsconfig.json` (`plugins`)
- Modify: `proxy.ts` (matcher에 `.well-known/workflow/` 제외) — 기존 matcher가 있으면
- Create: `vercel.json` (step 함수 maxDuration) — 또는 기존 편집
- Create: `src/entities/ai-design/workflow/steps.ts`
- Create: `src/entities/ai-design/workflow/generate-ai-design.workflow.ts`

**Interfaces:**
- Consumes: `generateHtml`, `resolveReferences/markDone/markFailed`.
- Produces: `generateAiDesignWorkflow(id: string)` (`'use workflow'`).

> ⚠️ **설치 직후 공식 문서로 검증**: `workflow` 패키지의 정확한 설정(`withWorkflow` import 경로, proxy matcher, step 타임아웃/maxDuration 설정)을 https://workflow-sdk.dev/docs/getting-started/next 와 https://vercel.com/docs/workflows 에서 재확인한다. 아래는 2026-06 기준 문서 코드.

- [ ] **Step 1: 패키지 설치**

Run: `npm i workflow`
Expected: `package.json`에 `workflow` 추가.

- [ ] **Step 2: `next.config.ts` 래핑**

`next.config.ts`를 다음으로 교체:

```typescript
import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withWorkflow(nextConfig);
```

- [ ] **Step 3: `tsconfig.json` 플러그인 추가**

`tsconfig.json`의 `compilerOptions.plugins` 배열에 추가(없으면 배열 생성):

```json
"plugins": [{ "name": "workflow" }]
```

- [ ] **Step 4: proxy matcher 제외**

`proxy.ts`(루트 미들웨어)에 `config.matcher`가 있으면 `.well-known/workflow/`를 제외 경로에 추가. 예(기존 matcher 패턴에 맞춰):

```typescript
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.well-known/workflow/).*)"],
};
```

> `proxy.ts`의 실제 matcher 형태를 먼저 읽고 거기에 `.well-known/workflow/` 제외만 더한다. matcher가 없으면 이 단계는 생략 가능(문서로 확인).

- [ ] **Step 5: `vercel.json` 함수 maxDuration**

`vercel.json`(없으면 생성):

```json
{
  "functions": {
    "app/**": { "maxDuration": 300 }
  }
}
```

> 생성되는 step 라우트의 정확한 경로/설정 방법을 문서로 확인하고, 필요하면 글롭을 조정하거나 프로젝트 설정에서 maxDuration을 올린다(Fluid compute면 더 길게 가능). Claude 생성 step이 300초를 넘길 가능성이 있으면 상향.

- [ ] **Step 6: 스텝 파일 작성**

`src/entities/ai-design/workflow/steps.ts`:

```typescript
import { generateHtml } from "../api/generate-html.server";
import { resolveReferences, markDone, markFailed } from "../api/generation-mutations.server";
import type { GenerationInput } from "../model/types";

export async function resolveAiDesignReferences(id: string) {
  "use step";
  return resolveReferences(id);
}

export async function generateAiDesignHtml(input: GenerationInput, imageUrls: string[]) {
  "use step";
  return generateHtml(input, imageUrls);
}

export async function markAiDesignDone(id: string, html: string) {
  "use step";
  await markDone(id, html);
}

export async function markAiDesignFailed(id: string, message: string) {
  "use step";
  await markFailed(id, message);
}
```

- [ ] **Step 7: 워크플로우 오케스트레이터 작성**

`src/entities/ai-design/workflow/generate-ai-design.workflow.ts`:

```typescript
import {
  resolveAiDesignReferences,
  generateAiDesignHtml,
  markAiDesignDone,
  markAiDesignFailed,
} from "./steps";

// durable 워크플로우: 참고 이미지 추출 → Claude 생성 → 행 갱신. 실패 시 failed 표기.
export async function generateAiDesignWorkflow(id: string) {
  "use workflow";

  try {
    const { input, imageUrls } = await resolveAiDesignReferences(id);
    const html = await generateAiDesignHtml(input, imageUrls);
    await markAiDesignDone(id, html);
  } catch (err) {
    await markAiDesignFailed(id, err instanceof Error ? err.message : "생성 실패");
  }
}
```

- [ ] **Step 8: 빌드 확인**

Run: `npx tsc --noEmit` 그리고 `npm run build`
Expected: 빌드 성공. (`withWorkflow`가 step/workflow 라우트를 컴파일.) 빌드가 워크플로우 관련으로 실패하면 Step 1-5 설정을 문서와 대조해 수정.

- [ ] **Step 9: 커밋**

```bash
git add package.json package-lock.json next.config.ts tsconfig.json proxy.ts vercel.json src/entities/ai-design/workflow/
git commit -m "feat(ai-design): Vercel Workflows setup + generate workflow & steps"
```

---

## Task 7: CRUD 서버 함수 (create/list/delete/get-html/retry) + 엔티티 배럴

**Files:**
- Create: `src/entities/ai-design/api/create-ai-design.server.ts`
- Create: `src/entities/ai-design/api/list-ai-designs.server.ts`
- Create: `src/entities/ai-design/api/delete-ai-design.server.ts`
- Create: `src/entities/ai-design/api/get-ai-design-html.server.ts`
- Create: `src/entities/ai-design/api/retry-ai-design.server.ts`
- Create: `src/entities/ai-design/index.ts` (배럴)
- Test: `tests/entities/ai-design/create-ai-design.server.test.ts`

**Interfaces:**
- Consumes: `requireAdmin`, `db`, 스키마, `createAiDesignSchema`, `AI_DESIGN_MODEL`, `start`(`workflow/api`), `generateAiDesignWorkflow`.
- Produces:
  - `createAiDesign(input): Promise<{ id: string }>`
  - `listAiDesigns(): Promise<AiDesignListItem[]>`
  - `deleteAiDesign(id): Promise<void>`
  - `getAiDesignHtml(id): Promise<string>`
  - `retryAiDesign(id): Promise<void>`

- [ ] **Step 1: create 구현**

`src/entities/ai-design/api/create-ai-design.server.ts`:

```typescript
import "server-only";
import { randomUUID } from "node:crypto";
import { start } from "workflow/api";
import { db } from "@/shared/db";
import { aiDesigns, aiDesignTags } from "@drizzle/schema";
import { requireAdmin } from "@/shared/auth/guards.server";
import { createAiDesignSchema } from "../model/schemas";
import { AI_DESIGN_MODEL } from "../model/constants";
import { generateAiDesignWorkflow } from "../workflow/generate-ai-design.workflow";

export async function createAiDesign(input: unknown): Promise<{ id: string }> {
  const admin = await requireAdmin();
  const data = createAiDesignSchema.parse(input);

  const id = randomUUID();
  await db.insert(aiDesigns).values({
    id,
    title: data.title,
    company: data.company ?? null,
    pageType: data.pageType,
    extraNotes: data.extraNotes ?? null,
    status: "working",
    model: AI_DESIGN_MODEL,
    createdBy: admin.id,
  });

  if (data.optionIds.length > 0) {
    await db.insert(aiDesignTags).values(data.optionIds.map((optionId) => ({ aiDesignId: id, optionId })));
  }

  // durable 워크플로우 트리거(fire-and-forget; run id 미반환). 행이 진실원천.
  await start(generateAiDesignWorkflow, [id]);

  return { id };
}
```

- [ ] **Step 2: list 구현**

`src/entities/ai-design/api/list-ai-designs.server.ts`:

```typescript
import "server-only";
import { desc } from "drizzle-orm";
import { db } from "@/shared/db";
import { aiDesigns } from "@drizzle/schema";
import { requireAdmin } from "@/shared/auth/guards.server";
import type { AiDesignListItem } from "../model/types";
import type { PageType, AiDesignStatus } from "../model/constants";

export async function listAiDesigns(): Promise<AiDesignListItem[]> {
  await requireAdmin();
  const rows = await db.select().from(aiDesigns).orderBy(desc(aiDesigns.createdAt));
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    company: r.company,
    pageType: r.pageType as PageType,
    status: r.status as AiDesignStatus,
    hasHtml: !!r.html,
    errorMessage: r.errorMessage,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}
```

- [ ] **Step 3: delete 구현**

`src/entities/ai-design/api/delete-ai-design.server.ts`:

```typescript
import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { aiDesigns } from "@drizzle/schema";
import { requireAdmin } from "@/shared/auth/guards.server";

// ai_design_tags는 FK ON DELETE CASCADE로 함께 삭제된다.
export async function deleteAiDesign(id: string): Promise<void> {
  await requireAdmin();
  await db.delete(aiDesigns).where(eq(aiDesigns.id, id));
}
```

- [ ] **Step 4: get-html 구현**

`src/entities/ai-design/api/get-ai-design-html.server.ts`:

```typescript
import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { aiDesigns } from "@drizzle/schema";
import { requireAdmin } from "@/shared/auth/guards.server";

// raw 뷰어용. 행이 없으면 NOT_FOUND, 아직 생성 전이면 NOT_FOUND(뷰어는 done일 때만 연다).
export async function getAiDesignHtml(id: string): Promise<string> {
  await requireAdmin();
  const [row] = await db.select({ html: aiDesigns.html }).from(aiDesigns).where(eq(aiDesigns.id, id)).limit(1);
  if (!row || !row.html) throw new Error("NOT_FOUND");
  return row.html;
}
```

- [ ] **Step 5: retry 구현**

`src/entities/ai-design/api/retry-ai-design.server.ts`:

```typescript
import "server-only";
import { eq } from "drizzle-orm";
import { start } from "workflow/api";
import { db } from "@/shared/db";
import { aiDesigns } from "@drizzle/schema";
import { requireAdmin } from "@/shared/auth/guards.server";
import { generateAiDesignWorkflow } from "../workflow/generate-ai-design.workflow";

// failed/멈춘 행을 다시 working으로 되돌리고 워크플로우 재트리거.
export async function retryAiDesign(id: string): Promise<void> {
  await requireAdmin();
  const [row] = await db.select({ id: aiDesigns.id }).from(aiDesigns).where(eq(aiDesigns.id, id)).limit(1);
  if (!row) throw new Error("NOT_FOUND");
  await db
    .update(aiDesigns)
    .set({ status: "working", errorMessage: null, html: null, updatedAt: new Date() })
    .where(eq(aiDesigns.id, id));
  await start(generateAiDesignWorkflow, [id]);
}
```

- [ ] **Step 6: 배럴 export**

`src/entities/ai-design/index.ts` (이 시점엔 타입/상수만 export. `aiDesignQueries`는 Task 9에서 추가):

```typescript
export type { AiDesignListItem, GenerationInput } from "./model/types";
export { PAGE_TYPES, AI_DESIGN_STATUSES, MODAL_TAG_GROUP_CODES } from "./model/constants";
export type { PageType, AiDesignStatus } from "./model/constants";
```

- [ ] **Step 7: create 테스트(guards/db/start/workflow 모킹)**

`tests/entities/ai-design/create-ai-design.server.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/shared/auth/guards.server", () => ({
  requireAdmin: vi.fn(async () => ({ id: "admin-1" })),
}));
const start = vi.fn(async () => undefined);
vi.mock("workflow/api", () => ({ start }));
vi.mock("@/entities/ai-design/workflow/generate-ai-design.workflow", () => ({
  generateAiDesignWorkflow: vi.fn(),
}));

const { insert, values } = vi.hoisted(() => {
  const values = vi.fn(async () => undefined);
  const insert = vi.fn(() => ({ values }));
  return { insert, values };
});
vi.mock("@/shared/db", () => ({ db: { insert } }));

import { createAiDesign } from "@/entities/ai-design/api/create-ai-design.server";

beforeEach(() => vi.clearAllMocks());

describe("createAiDesign", () => {
  it("행을 working으로 삽입하고 태그를 넣고 워크플로우를 트리거한다", async () => {
    const res = await createAiDesign({
      title: "ACME",
      pageType: "dashboard",
      optionIds: ["11111111-1111-1111-1111-111111111111"],
      extraNotes: "모던하게",
    });
    expect(res.id).toBeTruthy();
    // ai_designs insert
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({ title: "ACME", pageType: "dashboard", status: "working", createdBy: "admin-1" }),
    );
    // 워크플로우 트리거됨
    expect(start).toHaveBeenCalledTimes(1);
    expect(start.mock.calls[0][1]).toEqual([res.id]);
  });

  it("잘못된 입력은 zod에서 막히고 삽입/트리거가 없다", async () => {
    await expect(createAiDesign({ title: "", pageType: "main" })).rejects.toBeTruthy();
    expect(insert).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 8: 실행**

Run: `npx vitest run tests/entities/ai-design/create-ai-design.server.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 9: 커밋**

```bash
git add src/entities/ai-design/api src/entities/ai-design/index.ts tests/entities/ai-design/create-ai-design.server.test.ts
git commit -m "feat(ai-design): CRUD server functions + retry + entity barrel"
```

---

## Task 8: API 라우트 (POST/GET 목록, DELETE, retry, raw 뷰어)

**Files:**
- Create: `app/api/admin/ai-designs/route.ts` (POST 생성 + GET 목록)
- Create: `app/api/admin/ai-designs/[id]/route.ts` (DELETE)
- Create: `app/api/admin/ai-designs/[id]/retry/route.ts` (POST 재시도)
- Create: `app/studio/ai-designs/[id]/raw/route.ts` (GET text/html)

**Interfaces:**
- Consumes: Task 7 서버 함수들, `toErrorResponse`.
- Produces: HTTP 엔드포인트. (얇은 라우트 — 단위 테스트 없음; Task 7 테스트로 커버.)

- [ ] **Step 1: 목록/생성 라우트**

`app/api/admin/ai-designs/route.ts`:

```typescript
import { NextRequest } from "next/server";
import { createAiDesign } from "@/entities/ai-design/api/create-ai-design.server";
import { listAiDesigns } from "@/entities/ai-design/api/list-ai-designs.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

export async function GET() {
  try {
    return Response.json(await listAiDesigns());
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    return Response.json(await createAiDesign(await req.json()), { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
```

- [ ] **Step 2: DELETE 라우트**

`app/api/admin/ai-designs/[id]/route.ts`:

```typescript
import { NextRequest } from "next/server";
import { deleteAiDesign } from "@/entities/ai-design/api/delete-ai-design.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await deleteAiDesign(id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
```

- [ ] **Step 3: retry 라우트**

`app/api/admin/ai-designs/[id]/retry/route.ts`:

```typescript
import { NextRequest } from "next/server";
import { retryAiDesign } from "@/entities/ai-design/api/retry-ai-design.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await retryAiDesign(id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
```

- [ ] **Step 4: raw HTML 뷰어 라우트**

`app/studio/ai-designs/[id]/raw/route.ts`:

```typescript
import { NextRequest } from "next/server";
import { getAiDesignHtml } from "@/entities/ai-design/api/get-ai-design-html.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const html = await getAiDesignHtml(id);
    return new Response(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        // 생성 HTML에 스크립트가 끼어도 외부 호출/탈취를 제한(인라인 스타일은 허용).
        "content-security-policy":
          "default-src 'none'; img-src 'self' data: https:; style-src 'unsafe-inline'; font-src data:; base-uri 'none'",
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
```

> CSP가 시안 표시를 깨면(예: 외부 폰트가 정말 필요) 정책을 완화한다. 시안 목업은 보통 정적이라 위 정책으로 충분.

- [ ] **Step 5: 타입체크 + 커밋**

Run: `npx tsc --noEmit`

```bash
git add app/api/admin/ai-designs app/studio/ai-designs/\[id\]/raw
git commit -m "feat(ai-design): API routes (create/list/delete/retry) + raw HTML viewer"
```

---

## Task 9: 클라이언트 데이터 계층 (fetch 함수 + query/mutation 훅)

**Files:**
- Create: `src/entities/ai-design/api/ai-design.api.ts` (fetch 함수들)
- Create: `src/entities/ai-design/api/ai-design.query.ts` (query 팩토리)
- Create: `src/entities/ai-design/api/use-ai-design-mutations.ts` (mutation 훅)
- Modify: `src/entities/ai-design/index.ts` (export 연결)

**Interfaces:**
- Consumes: `http`(`@/shared/api/http`), `AiDesignListItem`, `CreateAiDesignInput`.
- Produces: `aiDesignQueries.list()`(폴링 옵션 포함); `useCreateAiDesign`, `useDeleteAiDesign`, `useRetryAiDesign`.

- [ ] **Step 1: fetch 함수**

`src/entities/ai-design/api/ai-design.api.ts`:

```typescript
import { http } from "@/shared/api/http";
import type { AiDesignListItem } from "../model/types";

export function fetchAiDesigns(): Promise<AiDesignListItem[]> {
  return http<AiDesignListItem[]>("/api/admin/ai-designs");
}

export function createAiDesignReq(body: {
  title: string;
  company?: string | null;
  pageType: string;
  optionIds: string[];
  extraNotes?: string | null;
}): Promise<{ id: string }> {
  return http<{ id: string }>("/api/admin/ai-designs", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function deleteAiDesignReq(id: string): Promise<void> {
  return http<void>(`/api/admin/ai-designs/${id}`, { method: "DELETE" });
}

export function retryAiDesignReq(id: string): Promise<void> {
  return http<void>(`/api/admin/ai-designs/${id}/retry`, { method: "POST" });
}
```

- [ ] **Step 2: query 팩토리 (working이 있으면 폴링)**

`src/entities/ai-design/api/ai-design.query.ts` (기존 `tag.query.ts`의 `queryOptions` 패턴):

```typescript
import { queryOptions } from "@tanstack/react-query";
import { fetchAiDesigns } from "./ai-design.api";
import type { AiDesignListItem } from "../model/types";

export const aiDesignQueries = {
  all: () => ["ai-designs"] as const,
  list: () =>
    queryOptions({
      queryKey: [...aiDesignQueries.all(), "list"],
      queryFn: fetchAiDesigns,
      // 'working' 행이 하나라도 있으면 3초마다 폴링, 전부 끝나면 폴링 중단.
      refetchInterval: (query) => {
        const data = query.state.data as AiDesignListItem[] | undefined;
        return data?.some((d) => d.status === "working") ? 3000 : false;
      },
    }),
};
```

- [ ] **Step 3: mutation 훅 (기존 `use-tag-taxonomy-mutations` 패턴)**

`src/entities/ai-design/api/use-ai-design-mutations.ts`:

```typescript
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createAiDesignReq, deleteAiDesignReq, retryAiDesignReq } from "./ai-design.api";
import { aiDesignQueries } from "./ai-design.query";

export function useCreateAiDesign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createAiDesignReq,
    onSuccess: () => qc.invalidateQueries({ queryKey: aiDesignQueries.all() }),
  });
}

export function useDeleteAiDesign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteAiDesignReq,
    onSuccess: () => qc.invalidateQueries({ queryKey: aiDesignQueries.all() }),
  });
}

export function useRetryAiDesign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: retryAiDesignReq,
    onSuccess: () => qc.invalidateQueries({ queryKey: aiDesignQueries.all() }),
  });
}
```

- [ ] **Step 4: 배럴에 query export 추가**

`src/entities/ai-design/index.ts` 끝에 추가:

```typescript
export { aiDesignQueries } from "./api/ai-design.query";
```

- [ ] **Step 5: 타입체크 + 커밋**

Run: `npx tsc --noEmit`

```bash
git add src/entities/ai-design/api/ai-design.api.ts src/entities/ai-design/api/ai-design.query.ts src/entities/ai-design/api/use-ai-design-mutations.ts src/entities/ai-design/index.ts
git commit -m "feat(ai-design): client data layer (fetch fns, query factory, mutations)"
```

---

## Task 10: 메뉴 + 관리자 페이지 라우트 + 페이지 모듈 셸

**Files:**
- Modify: `src/widgets/studio-shell/model/nav-config.ts` (메뉴 1줄)
- Modify: `tests/widgets/studio-shell/nav-config.test.ts` (admin 노출 검증 추가)
- Create: `app/studio/ai-designs/page.tsx` (서버 가드)
- Create: `src/pages/ai-designs/index.ts`
- Create: `src/pages/ai-designs/ui/ai-designs-page.tsx` (셸 — Task 11/12에서 채움)

**Interfaces:**
- Consumes: `getProfile`, `isAdmin`, `Role`, `Sparkles`(lucide), `PageHeader`.
- Produces: `/studio/ai-designs` 라우트(admin 전용), 사이드바 메뉴, `AiDesignsPage`.

- [ ] **Step 1: nav-config 테스트 먼저(실패) — admin 노출 케이스 추가**

`tests/widgets/studio-shell/nav-config.test.ts`의 `describe` 안에 추가:

```typescript
  it("AI 시안 생성: editor는 숨김, admin은 봄(adminOnly)", () => {
    expect(visibleNavItems("editor").map((i) => i.label)).not.toContain("AI 시안 생성");
    expect(visibleNavItems("admin").map((i) => i.label)).toContain("AI 시안 생성");
  });
  it("matchNav: /studio/ai-designs 및 하위 경로", () => {
    expect(matchNav("/studio/ai-designs")?.label).toBe("AI 시안 생성");
    expect(matchNav("/studio/ai-designs/abc/raw")?.label).toBe("AI 시안 생성");
  });
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/widgets/studio-shell/nav-config.test.ts`
Expected: FAIL (메뉴 항목 미존재).

- [ ] **Step 3: nav-config에 메뉴 추가**

`src/widgets/studio-shell/model/nav-config.ts`:
- import 라인에 `Sparkles` 추가: `import { Layers, Users, Tags, Sparkles } from "lucide-react";`
- `NAV_ITEMS` 배열에 추가(관리자 항목들 근처):

```typescript
  { href: "/studio/ai-designs", label: "AI 시안 생성", icon: Sparkles, adminOnly: true },
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/widgets/studio-shell/nav-config.test.ts`
Expected: PASS (기존 + 신규 케이스).

- [ ] **Step 5: 페이지 셸 작성**

`src/pages/ai-designs/ui/ai-designs-page.tsx`:

```tsx
"use client";

import { PageHeader } from "@/widgets/studio-shell";

export function AiDesignsPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="AI 시안 생성" description="요구사항을 입력하면 AI가 참고 시안을 바탕으로 HTML 시안을 생성합니다." />
      {/* Task 11(모달) / Task 12(목록)에서 채운다 */}
    </div>
  );
}
```

`src/pages/ai-designs/index.ts`:

```typescript
export { AiDesignsPage } from "./ui/ai-designs-page";
```

- [ ] **Step 6: 라우트 페이지(서버 admin 가드) 작성**

`app/studio/ai-designs/page.tsx` (`app/studio/tags/page.tsx`와 동일 패턴):

```tsx
import { redirect } from "next/navigation";
import { getProfile } from "@/shared/auth/guards.server";
import { isAdmin, type Role } from "@/shared/auth/roles";
import { AiDesignsPage } from "@/pages/ai-designs";

export default async function Page() {
  const profile = await getProfile();
  if (!profile || !isAdmin(profile.role as Role)) redirect("/studio");
  return <AiDesignsPage />;
}
```

- [ ] **Step 7: 타입체크 + 커밋**

Run: `npx tsc --noEmit`

```bash
git add src/widgets/studio-shell/model/nav-config.ts tests/widgets/studio-shell/nav-config.test.ts app/studio/ai-designs/page.tsx src/pages/ai-designs
git commit -m "feat(ai-design): admin-only studio menu + page route + shell"
```

---

## Task 11: 페이지 유형 시각 카드 (인라인 SVG 썸네일)

**Files:**
- Create: `src/pages/ai-designs/ui/page-type-cards.tsx`

**Interfaces:**
- Consumes: `PAGE_TYPES`/`PageType`, `cn`(`@/shared/lib/utils`).
- Produces: `<PageTypeCards value onChange />` — 3개 카드(메인/대시보드/서브페이지) + 예시 와이어프레임 썸네일, 선택 강조.

- [ ] **Step 1: 컴포넌트 작성**

`src/pages/ai-designs/ui/page-type-cards.tsx`:

```tsx
"use client";

import { cn } from "@/shared/lib/utils";
import { PAGE_TYPES, type PageType } from "@/entities/ai-design";

const META: Record<PageType, { label: string; desc: string; thumb: React.ReactNode }> = {
  main: {
    label: "메인",
    desc: "랜딩 · 히어로 + 섹션",
    thumb: (
      <svg viewBox="0 0 120 80" className="h-full w-full" role="img" aria-label="메인 페이지 와이어프레임">
        <rect x="0" y="0" width="120" height="80" rx="4" className="fill-muted" />
        <rect x="10" y="8" width="100" height="22" rx="2" className="fill-primary/30" />
        <rect x="40" y="14" width="40" height="4" rx="2" className="fill-primary/60" />
        <rect x="50" y="22" width="20" height="4" rx="2" className="fill-foreground/30" />
        <rect x="10" y="36" width="30" height="20" rx="2" className="fill-foreground/15" />
        <rect x="45" y="36" width="30" height="20" rx="2" className="fill-foreground/15" />
        <rect x="80" y="36" width="30" height="20" rx="2" className="fill-foreground/15" />
        <rect x="35" y="64" width="50" height="6" rx="3" className="fill-primary/50" />
      </svg>
    ),
  },
  dashboard: {
    label: "대시보드",
    desc: "사이드바 + KPI/차트",
    thumb: (
      <svg viewBox="0 0 120 80" className="h-full w-full" role="img" aria-label="대시보드 와이어프레임">
        <rect x="0" y="0" width="120" height="80" rx="4" className="fill-muted" />
        <rect x="0" y="0" width="26" height="80" rx="4" className="fill-foreground/20" />
        <rect x="6" y="10" width="14" height="3" rx="1.5" className="fill-foreground/40" />
        <rect x="6" y="18" width="14" height="3" rx="1.5" className="fill-foreground/40" />
        <rect x="6" y="26" width="14" height="3" rx="1.5" className="fill-foreground/40" />
        <rect x="32" y="8" width="24" height="16" rx="2" className="fill-primary/30" />
        <rect x="60" y="8" width="24" height="16" rx="2" className="fill-primary/30" />
        <rect x="88" y="8" width="24" height="16" rx="2" className="fill-primary/30" />
        <rect x="32" y="30" width="80" height="42" rx="2" className="fill-foreground/15" />
        <polyline points="36,66 52,52 68,60 84,42 104,48" className="fill-none stroke-primary/70" strokeWidth="2" />
      </svg>
    ),
  },
  subpage: {
    label: "서브페이지",
    desc: "헤더 + 본문 + 사이드",
    thumb: (
      <svg viewBox="0 0 120 80" className="h-full w-full" role="img" aria-label="서브페이지 와이어프레임">
        <rect x="0" y="0" width="120" height="80" rx="4" className="fill-muted" />
        <rect x="0" y="0" width="120" height="14" rx="4" className="fill-foreground/20" />
        <rect x="8" y="5" width="24" height="4" rx="2" className="fill-foreground/45" />
        <rect x="10" y="22" width="64" height="5" rx="2" className="fill-foreground/40" />
        <rect x="10" y="32" width="64" height="3" rx="1.5" className="fill-foreground/20" />
        <rect x="10" y="38" width="64" height="3" rx="1.5" className="fill-foreground/20" />
        <rect x="10" y="44" width="48" height="3" rx="1.5" className="fill-foreground/20" />
        <rect x="82" y="22" width="30" height="48" rx="2" className="fill-primary/25" />
      </svg>
    ),
  },
};

export function PageTypeCards({
  value,
  onChange,
}: {
  value: PageType | null;
  onChange: (v: PageType) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {PAGE_TYPES.map((pt) => {
        const m = META[pt];
        const active = value === pt;
        return (
          <button
            key={pt}
            type="button"
            onClick={() => onChange(pt)}
            aria-pressed={active}
            className={cn(
              "flex flex-col gap-2 rounded-lg border p-2 text-left transition-all",
              active ? "border-primary ring-2 ring-primary/40" : "border-border hover:bg-muted",
            )}
          >
            <div className="aspect-[3/2] w-full overflow-hidden rounded-md">{m.thumb}</div>
            <div>
              <div className="text-sm font-medium">{m.label}</div>
              <div className="text-muted-foreground text-xs">{m.desc}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: 타입체크 + 커밋**

Run: `npx tsc --noEmit`

```bash
git add src/pages/ai-designs/ui/page-type-cards.tsx
git commit -m "feat(ai-design): page-type selection cards with inline SVG thumbnails"
```

---

## Task 12: 생성하기 모달

**Files:**
- Create: `src/pages/ai-designs/ui/create-ai-design-modal.tsx`

**Interfaces:**
- Consumes: `Dialog*`/`Button`/`Input`/`Label`(`@/shared/ui/*`), `Textarea`? (없으면 `<textarea>` 스타일), `toast`(sonner), `useCreateAiDesign`, `tagQueries`(`@/entities/tag`), `PageTypeCards`, `MODAL_TAG_GROUP_CODES`, `PAGE_TYPES`/`PageType`.
- Produces: `<CreateAiDesignModal open onOpenChange />` — 폼 제출 시 `useCreateAiDesign`.

> **사전 확인**: `@/shared/ui` 목록에 `textarea`가 없다(있는 것: button, dialog, input, label, select, ...). 본문은 `<textarea>`에 Input과 동일 톤의 Tailwind 클래스를 직접 부여한다. 태그 옵션 형태(`tagQueries.taxonomy()` 반환)는 `src/entities/tag/model/types.ts`의 `Taxonomy`를 읽어 `group.code`, `group.label`, `group.options[].id/label`가 맞는지 확인 후 사용한다.

- [ ] **Step 1: 모달 작성** (기존 `group-dialog.tsx` 패턴 미러링)

`src/pages/ai-designs/ui/create-ai-design-modal.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { cn } from "@/shared/lib/utils";
import { tagQueries } from "@/entities/tag";
import { MODAL_TAG_GROUP_CODES, type PageType } from "@/entities/ai-design";
import { useCreateAiDesign } from "@/entities/ai-design/api/use-ai-design-mutations";
import { PageTypeCards } from "./page-type-cards";

export function CreateAiDesignModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const create = useCreateAiDesign();
  const { data: taxonomy } = useQuery(tagQueries.taxonomy());

  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [pageType, setPageType] = useState<PageType | null>(null);
  const [optionIds, setOptionIds] = useState<string[]>([]);
  const [extraNotes, setExtraNotes] = useState("");

  // 화이트리스트 그룹만 노출. 매칭되는 코드가 없으면(시드 코드 불일치) 전체 그룹을 노출.
  const allGroups = taxonomy ?? [];
  const whitelisted = allGroups.filter((g) => MODAL_TAG_GROUP_CODES.includes(g.code));
  const shownGroups = whitelisted.length > 0 ? whitelisted : allGroups;

  function toggleOption(id: string) {
    setOptionIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function reset() {
    setTitle("");
    setCompany("");
    setPageType(null);
    setOptionIds([]);
    setExtraNotes("");
  }

  function submit() {
    if (!title.trim()) return toast.error("제목(회사명)을 입력하세요");
    if (!pageType) return toast.error("페이지 유형을 선택하세요");
    create.mutate(
      {
        title: title.trim(),
        company: company.trim() || null,
        pageType,
        optionIds,
        extraNotes: extraNotes.trim() || null,
      },
      {
        onSuccess: () => {
          toast.success("생성을 시작했습니다. 완료되면 목록에 표시됩니다.");
          onOpenChange(false);
          reset();
        },
        onError: () => toast.error("생성 요청에 실패했습니다"),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>AI 시안 생성</DialogTitle>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <Label htmlFor="ai-title">제목(회사명)</Label>
            <Input id="ai-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ACME Inc." />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ai-company">회사명(선택, 제목과 다를 때)</Label>
            <Input id="ai-company" value={company} onChange={(e) => setCompany(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>페이지 유형</Label>
            <PageTypeCards value={pageType} onChange={setPageType} />
          </div>

          {shownGroups.length > 0 && (
            <div className="space-y-2">
              <Label>참고 태그(선택)</Label>
              {shownGroups.map((g) => (
                <div key={g.id} className="space-y-1">
                  <p className="text-muted-foreground text-xs">{g.label}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {g.options.map((o) => {
                      const active = optionIds.includes(o.id);
                      return (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() => toggleOption(o.id)}
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-xs transition-colors",
                            active
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border hover:bg-muted",
                          )}
                        >
                          {o.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="ai-notes">추가 요청사항(선택)</Label>
            <textarea
              id="ai-notes"
              value={extraNotes}
              onChange={(e) => setExtraNotes(e.target.value)}
              rows={3}
              placeholder="예: 모던하고 미니멀하게, 파란 계열 톤"
              className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-3"
            />
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>취소</DialogClose>
          <Button type="button" onClick={submit} disabled={create.isPending}>
            {create.isPending ? "요청 중…" : "생성하기"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음. `g.options`/`g.code`/`g.label` 타입이 안 맞으면 `Taxonomy` 타입(`src/entities/tag/model/types.ts`)에 맞게 필드명 조정.

- [ ] **Step 3: 커밋**

```bash
git add src/pages/ai-designs/ui/create-ai-design-modal.tsx
git commit -m "feat(ai-design): create modal (title/page-type cards/tags/notes)"
```

---

## Task 13: 목록 화면 (조회 + 폴링 + 액션) — 페이지 완성

**Files:**
- Modify: `src/pages/ai-designs/ui/ai-designs-page.tsx`

**Interfaces:**
- Consumes: `aiDesignQueries.list()`, `useDeleteAiDesign`/`useRetryAiDesign`, `PageHeader`, `Button`, `Badge`(`@/shared/ui/badge`), `Skeleton`, lucide 아이콘, `CreateAiDesignModal`.
- Produces: 완성된 `AiDesignsPage` — 헤더 + "생성하기" 버튼 + 상태별 행(뷰어 열기/재시도/삭제) + working 폴링.

- [ ] **Step 1: 페이지 본문 작성**

`src/pages/ai-designs/ui/ai-designs-page.tsx`를 다음으로 교체:

```tsx
"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, ExternalLink, RotateCw, Trash2, Loader2 } from "lucide-react";
import { PageHeader } from "@/widgets/studio-shell";
import { Button, buttonVariants } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Skeleton } from "@/shared/ui/skeleton";
import { cn } from "@/shared/lib/utils";
import { aiDesignQueries } from "@/entities/ai-design";
import { useDeleteAiDesign, useRetryAiDesign } from "@/entities/ai-design/api/use-ai-design-mutations";
import { CreateAiDesignModal } from "./create-ai-design-modal";

const PAGE_TYPE_LABEL: Record<string, string> = { main: "메인", dashboard: "대시보드", subpage: "서브페이지" };

export function AiDesignsPage() {
  const { data, isPending, isError } = useQuery(aiDesignQueries.list());
  const del = useDeleteAiDesign();
  const retry = useRetryAiDesign();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="AI 시안 생성"
        description="요구사항을 입력하면 AI가 참고 시안을 바탕으로 HTML 시안을 생성합니다."
        actions={
          <Button type="button" onClick={() => setCreateOpen(true)}>
            <Plus />
            생성하기
          </Button>
        }
      />

      {isPending && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      )}
      {isError && <p className="text-destructive text-sm">목록을 불러오지 못했습니다.</p>}
      {data && data.length === 0 && (
        <p className="text-muted-foreground text-sm">아직 생성한 시안이 없습니다. '생성하기'로 시작하세요.</p>
      )}

      {data && data.length > 0 && (
        <ul className="divide-border divide-y rounded-lg border">
          {data.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{d.title}</span>
                  <Badge variant="outline">{PAGE_TYPE_LABEL[d.pageType] ?? d.pageType}</Badge>
                  {d.status === "working" && (
                    <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                      <Loader2 className="size-3 animate-spin" /> 작업중
                    </span>
                  )}
                  {d.status === "failed" && <span className="text-destructive text-xs">실패</span>}
                </div>
                <div className="text-muted-foreground mt-0.5 text-xs">
                  {new Date(d.createdAt).toLocaleString("ko-KR")}
                  {d.status === "failed" && d.errorMessage ? ` · ${d.errorMessage}` : ""}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {d.status === "done" && d.hasHtml && (
                  <a
                    href={`/studio/ai-designs/${d.id}/raw`}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                  >
                    <ExternalLink />
                    뷰어 열기
                  </a>
                )}
                {d.status === "failed" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={retry.isPending}
                    onClick={() =>
                      retry.mutate(d.id, {
                        onSuccess: () => toast.success("다시 생성을 시작했습니다"),
                        onError: () => toast.error("재시도에 실패했습니다"),
                      })
                    }
                  >
                    <RotateCw />
                    재시도
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={del.isPending}
                  aria-label="삭제"
                  onClick={() => {
                    if (!confirm("이 시안을 삭제할까요?")) return;
                    del.mutate(d.id, {
                      onSuccess: () => toast.success("삭제했습니다"),
                      onError: () => toast.error("삭제에 실패했습니다"),
                    });
                  }}
                >
                  <Trash2 />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <CreateAiDesignModal open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
```

> "뷰어 열기"는 새 탭 링크라 `Button`(Base UI, `render` prop 방식) 대신 `buttonVariants`를 입힌 `<a>`로 작성했다(타입/동작 단순). 삭제/재시도/생성은 `<Button>` 사용.

- [ ] **Step 2: 타입체크 + 린트(새 파일)**

Run: `npx tsc --noEmit` 그리고 `npx eslint src/pages/ai-designs src/entities/ai-design`
Expected: 새 코드에 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add src/pages/ai-designs/ui/ai-designs-page.tsx
git commit -m "feat(ai-design): list page with status polling, viewer/retry/delete actions"
```

---

## Task 14: 통합 검증 + 수동 E2E

**Files:** (코드 변경 없음 — 검증)

- [ ] **Step 1: 전체 테스트**

Run: `npm test`
Expected: 신규 테스트 모두 통과. 기존 무관 실패(`locate.test.ts` 2건 등)는 그대로 — 내 변경과 무관함을 확인.

- [ ] **Step 2: 빌드**

Run: `npm run build`
Expected: 성공. 워크플로우 라우트 컴파일 확인.

- [ ] **Step 3: 로컬 실행 + 수동 E2E**

Run: `npm run dev` (env에 `ANTHROPIC_API_KEY`, `DATABASE_URL` 등 설정 + 관리자 계정 필요 — DB가 비어있으면 부트스트랩 관리자/시안 시드 필요, 메모리 phase1b-db-reconciliation 참고)

확인:
1. admin으로 로그인 → 사이드바에 "AI 시안 생성" 보임. editor/pending은 안 보임.
2. 비관리자가 `/studio/ai-designs` 직접 접근 → `/studio`로 redirect.
3. "생성하기" → 모달: 제목 입력, 페이지 유형 카드(썸네일 보임) 선택, 태그 칩 선택, 추가요청 입력 → 제출.
4. 목록에 새 행이 "작업중"으로 뜨고 3초 폴링. (Vercel 배포 환경에서 워크플로우가 도는지; 로컬 dev에서 workflow SDK 동작 방식은 §Task 6 문서 확인.)
5. 완료 후 "뷰어 열기" → 새 탭에 raw HTML 렌더.
6. 실패 시 "재시도" → 다시 작업중.
7. "삭제" → 목록에서 제거.

- [ ] **Step 4: Vercel 워크플로우 검증(배포 후)**

배포 후 Vercel 대시보드 → Observability → Workflows에서 run이 기록되는지, step별 성공/재시도/실패가 보이는지 확인. Claude 생성 step이 함수 maxDuration 안에서 완료되는지(필요시 maxDuration 상향).

- [ ] **Step 5: 최종 정리 커밋(있으면)**

```bash
git status
# 잔여 변경이 있으면 의미 단위로 커밋
```

---

## 완료 후

구현이 끝나고 모든 테스트/빌드가 통과하면 `superpowers:finishing-a-development-branch` 스킬로 머지/PR을 진행한다. (Anthropic 키·Vercel Workflows 설정 등 배포 환경 구성은 PR 설명에 체크리스트로 남길 것.)
