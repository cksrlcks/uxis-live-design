# Phase 4 — 멀티 안(variant) + 안별 히스토리 + 비교 뷰 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 하나의 시안 아래에 가변 개수의 "안(variant)"을 두고, 각 안이 독립적인 버전 히스토리를 가지며, 공개 뷰어에서 안 목록·안별 URL·나란히 비교로 볼 수 있게 한다.

**Architecture:** 기존 `시안 → 버전 → 페이지` 사이에 `안(proposal_variants)` 레벨을 신설해 `시안 → 안 → 버전 → 페이지` 3단 계층으로 만든다. `proposal_versions`를 안에 종속시키고, "현재 버전"을 안 레벨로 옮긴다. `label`(표시·수정 가능)과 `slug`(URL용·불변)를 분리한다. 권한(공개/비번)은 시안 단위로 유지한다.

**Tech Stack:** Next.js(App Router, async params/searchParams) · Drizzle ORM(Postgres) · Supabase Storage(signed URL) · Vitest · nuqs · Tailwind.

**Spec:** `docs/superpowers/specs/2026-06-16-phase4-variants-design.md`

**Branch:** `feat/phase4-variants` (이미 생성됨). 커밋마다 `npx tsc --noEmit` + `npm test` 게이트. 브라우저 E2E는 마지막 수동 체크리스트로 확인(기존 phased 방침).

---

## File Structure

**신규 생성**
- `lib/proposals/variant-slug.ts` — slug 자동 부여 + 기본 label 헬퍼(순수)
- `tests/proposals/variant-slug.test.ts` — 위 헬퍼 단위 테스트
- `app/api/proposals/[id]/variants/route.ts` — 안 추가(POST)
- `app/api/proposals/[id]/variants/[variantId]/route.ts` — 안 수정/삭제(PATCH/DELETE)
- `app/api/proposals/[id]/variants/[variantId]/versions/route.ts` — 새 버전(POST) *(이동)*
- `app/api/proposals/[id]/variants/[variantId]/versions/[versionId]/pages/route.ts` — 업로드 확정(POST) *(이동)*
- `app/api/proposals/[id]/variants/[variantId]/restore/route.ts` — 복원(POST) *(이동)*
- `components/proposals/add-variant-form.tsx` — 안 추가 업로더
- `components/proposals/variant-tabs.tsx` — 에디터 안 전환/추가/이름수정/삭제/순서
- `components/preview/variant-list.tsx` — 뷰어 안 목록 그리드
- `components/preview/compare-view.tsx` — 뷰어 나란히 비교
- `components/preview/variant-viewer-nav.tsx` — 뷰어 상단 안 전환/목록/비교 링크

**수정**
- `drizzle/schema.ts` — `proposalVariants` 추가, `proposalVersions.proposalId→variantId`, `proposals.currentVersionId` 제거
- `drizzle/migrations/0003_*.sql` (+ meta) — 신규 마이그레이션(데이터 이전 포함, 수동 SQL)
- `app/api/proposals/route.ts` — 생성 시 첫 안 + v1
- `app/api/proposals/[id]/route.ts` — GET은 안 목록 반환, DELETE는 variant join
- `components/proposals/proposal-create-form.tsx` — confirm 엔드포인트 variant 스코프
- `components/proposals/add-version-form.tsx` — variantId 받기 + variant 엔드포인트
- `components/proposals/version-actions.tsx` — RestoreButton variantId 받기
- `app/(dashboard)/dashboard/proposals/[id]/page.tsx` — 안 탭 중심 재구성
- `app/p/[publicId]/page.tsx` — 안 목록/`?v=`/`?compare=1` 분기
- `scripts/check-proposals.mts` — RLS 체크 목록에 `proposal_variants` 추가

**삭제 (이동됨)**
- `app/api/proposals/[id]/versions/route.ts`
- `app/api/proposals/[id]/versions/[vid]/pages/route.ts`
- `app/api/proposals/[id]/restore/route.ts`

---

## Task 1: slug/label 헬퍼 (TDD, 순수 로직)

**Files:**
- Create: `lib/proposals/variant-slug.ts`
- Test: `tests/proposals/variant-slug.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/proposals/variant-slug.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { nextVariantSlug, defaultVariantLabel } from "@/lib/proposals/variant-slug";

describe("nextVariantSlug", () => {
  it("returns 'a' when nothing is used", () => {
    expect(nextVariantSlug([])).toBe("a");
  });
  it("returns the first unused lowercase letter", () => {
    expect(nextVariantSlug(["a"])).toBe("b");
    expect(nextVariantSlug(["a", "b", "d"])).toBe("c");
  });
  it("falls back to a 4-char id once a..z are all taken", () => {
    const used = "abcdefghijklmnopqrstuvwxyz".split("");
    const slug = nextVariantSlug(used);
    expect(slug).toHaveLength(4);
    expect(used).not.toContain(slug);
  });
  it("fallback never collides with an existing slug", () => {
    const used = "abcdefghijklmnopqrstuvwxyz".split("");
    for (let i = 0; i < 50; i++) {
      const slug = nextVariantSlug(used);
      expect(used).not.toContain(slug);
    }
  });
});

describe("defaultVariantLabel", () => {
  it("maps 0-based index to A, B, ... Z", () => {
    expect(defaultVariantLabel(0)).toBe("A");
    expect(defaultVariantLabel(1)).toBe("B");
    expect(defaultVariantLabel(25)).toBe("Z");
  });
  it("falls back to '안 N' past 26", () => {
    expect(defaultVariantLabel(26)).toBe("안 27");
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/proposals/variant-slug.test.ts`
Expected: FAIL — `Cannot find module '@/lib/proposals/variant-slug'`

- [ ] **Step 3: 최소 구현**

`lib/proposals/variant-slug.ts`:
```ts
import { generatePublicId } from "@/lib/proposals/public-id";

const VARIANT_SLUG_LETTERS = "abcdefghijklmnopqrstuvwxyz";

// Stable, immutable URL key for a new variant within one proposal.
// Prefers the first unused a..z letter; falls back to a short random id once all 26 are taken.
export function nextVariantSlug(used: Iterable<string>): string {
  const taken = new Set(used);
  for (const c of VARIANT_SLUG_LETTERS) {
    if (!taken.has(c)) return c;
  }
  let cand = generatePublicId(4);
  while (taken.has(cand)) cand = generatePublicId(4);
  return cand;
}

// Default display label for the Nth (0-based) variant: A, B, ... Z, then "안 27", ...
export function defaultVariantLabel(index: number): string {
  if (index < 26) return String.fromCharCode(65 + index);
  return `안 ${index + 1}`;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/proposals/variant-slug.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: 커밋**

```bash
git add lib/proposals/variant-slug.ts tests/proposals/variant-slug.test.ts
git commit -m "feat: variant slug/label helpers (Phase 4)"
```

---

## Task 2: 스키마 + 마이그레이션

**Files:**
- Modify: `drizzle/schema.ts`
- Create: `drizzle/migrations/0003_*.sql` (db:generate 후 본문 교체)
- Modify: `scripts/check-proposals.mts:3`

> ⚠️ 이 태스크는 DB를 변경한다. 적용 전 `.env.local`의 DB가 개발용인지 확인할 것. 실데이터가 거의 없는 빌드 단계라 파괴적 변경을 허용한다(spec §4).

- [ ] **Step 1: `drizzle/schema.ts` 수정 — `proposals`에서 `currentVersionId` 제거**

`proposals` 정의에서 아래 줄을 **삭제**:
```ts
  currentVersionId: uuid("current_version_id"), // FK added via SQL (circular)
```

- [ ] **Step 2: `proposalVersions`를 안에 종속하도록 수정**

`proposalVersions` 정의를 다음으로 **교체**:
```ts
export const proposalVersions = pgTable("proposal_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  variantId: uuid("variant_id").notNull(),
  versionNo: integer("version_no").notNull(),
  note: text("note"),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("proposal_versions_variant_version_unique").on(t.variantId, t.versionNo),
]);
```

- [ ] **Step 3: `proposalVariants` 추가 + 타입 export**

`proposalVersions` 정의 **바로 위**에 추가:
```ts
export const proposalVariants = pgTable("proposal_variants", {
  id: uuid("id").primaryKey().defaultRandom(),
  proposalId: uuid("proposal_id").notNull(),
  label: text("label").notNull(),
  slug: text("slug").notNull(),                  // URL용 고정 키
  sortOrder: integer("sort_order").notNull(),
  currentVersionId: uuid("current_version_id"),  // FK added via SQL (circular)
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("proposal_variants_proposal_slug_unique").on(t.proposalId, t.slug),
]);
```

파일 하단 타입 export 블록에 추가:
```ts
export type ProposalVariant = typeof proposalVariants.$inferSelect;
```

- [ ] **Step 4: 마이그레이션 생성**

Run: `npm run db:generate`
Expected: `drizzle/migrations/0003_<random>.sql` 와 `meta/0003_snapshot.json`, `_journal.json` 갱신. (생성된 `.sql` 본문은 데이터 이전이 없는 파괴적 SQL이므로 다음 스텝에서 교체한다. 스냅샷/journal은 그대로 둔다 — `drizzle/README.md` 컨벤션.)

- [ ] **Step 5: 생성된 `0003_*.sql` 본문을 아래로 전체 교체**

```sql
-- 1. 신규 테이블 proposal_variants (current_version_id FK는 versions 재구성 후 추가 — 순환 FK)
CREATE TABLE "proposal_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"label" text NOT NULL,
	"slug" text NOT NULL,
	"sort_order" integer NOT NULL,
	"current_version_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "proposal_variants_proposal_slug_unique" UNIQUE("proposal_id","slug")
);
--> statement-breakpoint
ALTER TABLE "proposal_variants" ADD CONSTRAINT "proposal_variants_proposal_id_proposals_fk" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "proposal_variants" ADD CONSTRAINT "proposal_variants_created_by_profiles_fk" FOREIGN KEY ("created_by") REFERENCES "profiles"("id") ON DELETE set null;
--> statement-breakpoint
-- 2. proposal_versions에 variant_id 추가(우선 NULL 허용)
ALTER TABLE "proposal_versions" ADD COLUMN "variant_id" uuid;
--> statement-breakpoint
-- 3. 기존 시안마다 안 1개 생성(label "A"/slug "a"), 기존 current_version_id 승계
INSERT INTO "proposal_variants" ("proposal_id", "label", "slug", "sort_order", "current_version_id", "created_by")
SELECT "id", 'A', 'a', 0, "current_version_id", "owner_id" FROM "proposals";
--> statement-breakpoint
-- 4. 기존 버전을 각 시안의 단일 안으로 재귀속
UPDATE "proposal_versions" v
SET "variant_id" = pv."id"
FROM "proposal_variants" pv
WHERE pv."proposal_id" = v."proposal_id";
--> statement-breakpoint
-- 5. variant_id 확정: NOT NULL + FK, 옛 proposal_id/unique 제거, 새 unique 추가
ALTER TABLE "proposal_versions" ALTER COLUMN "variant_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "proposal_versions" DROP CONSTRAINT "proposal_versions_proposal_version_unique";
--> statement-breakpoint
ALTER TABLE "proposal_versions" DROP CONSTRAINT "proposal_versions_proposal_id_proposals_fk";
--> statement-breakpoint
ALTER TABLE "proposal_versions" DROP COLUMN "proposal_id";
--> statement-breakpoint
ALTER TABLE "proposal_versions" ADD CONSTRAINT "proposal_versions_variant_id_variants_fk" FOREIGN KEY ("variant_id") REFERENCES "proposal_variants"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "proposal_versions" ADD CONSTRAINT "proposal_versions_variant_version_unique" UNIQUE("variant_id","version_no");
--> statement-breakpoint
-- 6. versions가 존재하므로 이제 variants.current_version_id 순환 FK 추가
ALTER TABLE "proposal_variants" ADD CONSTRAINT "proposal_variants_current_version_id_versions_fk" FOREIGN KEY ("current_version_id") REFERENCES "proposal_versions"("id") ON DELETE set null;
--> statement-breakpoint
-- 7. proposals.current_version_id 제거(안 레벨로 이동)
ALTER TABLE "proposals" DROP CONSTRAINT "proposals_current_version_id_versions_fk";
--> statement-breakpoint
ALTER TABLE "proposals" DROP COLUMN "current_version_id";
--> statement-breakpoint
-- 8. 신규 테이블 RLS deny 백스톱(기존 테이블과 동일)
ALTER TABLE "proposal_variants" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "proposal_variants" FORCE ROW LEVEL SECURITY;
```

- [ ] **Step 6: 마이그레이션 적용**

Run: `npm run db:migrate`
Expected: 에러 없이 완료. 실패 시 SQL 순서를 위 본문과 대조.

- [ ] **Step 7: `scripts/check-proposals.mts` RLS 목록에 신규 테이블 추가**

3번째 줄을 다음으로 교체:
```ts
for (const rel of ["proposals", "proposal_variants", "proposal_versions", "proposal_pages"]) {
```

- [ ] **Step 8: 검증 — 타입체크 + RLS 확인**

Run: `npx tsc --noEmit`
Expected: 이 시점엔 라우트/페이지들이 아직 옛 필드를 참조해 **여러 에러가 난다(정상)**. Task 3~12에서 모두 해소된다. 단, `drizzle/schema.ts` 자체의 문법 에러가 없는지 확인.

Run: `npx tsx --env-file=.env.local scripts/check-proposals.mts`
Expected: 4개 테이블 모두 `relrowsecurity: true, relforcerowsecurity: true`.

- [ ] **Step 9: 커밋**

```bash
git add drizzle/schema.ts drizzle/migrations scripts/check-proposals.mts
git commit -m "feat: add proposal_variants level + migrate existing proposals (Phase 4)"
```

---

## Task 3: `/api/proposals` 생성·조회·삭제 수정

**Files:**
- Modify: `app/api/proposals/route.ts`
- Modify: `app/api/proposals/[id]/route.ts`

- [ ] **Step 1: `POST /api/proposals` — 시안 + 첫 안 + v1 생성**

`app/api/proposals/route.ts`의 import에 `proposalVariants` 추가:
```ts
import { proposals, proposalVariants, proposalVersions } from "@/drizzle/schema";
```

생성 블록(현재 53~56행, `const proposalId = randomUUID();` ~ `proposalVersions` insert)을 다음으로 교체:
```ts
  const proposalId = randomUUID();
  const variantId = randomUUID();
  const versionId = randomUUID();
  await db.insert(proposals).values({ id: proposalId, publicId, title, ownerId: editor.id });
  await db.insert(proposalVariants).values({
    id: variantId, proposalId, label: "A", slug: "a", sortOrder: 0, createdBy: editor.id,
  });
  await db.insert(proposalVersions).values({ id: versionId, variantId, versionNo: 1, createdBy: editor.id });
```

업로드 경로(`pagePath(proposalId, versionId, ...)`)는 그대로 둔다. 반환 JSON에 `variantId` 추가:
```ts
  return NextResponse.json({ proposalId, publicId, variantId, versionId, uploads });
```

- [ ] **Step 2: `GET /api/proposals/[id]` — 안 목록 + 버전 반환**

`app/api/proposals/[id]/route.ts` import 교체:
```ts
import { asc, eq, inArray } from "drizzle-orm";
import { proposals, proposalVariants, proposalVersions, proposalPages } from "@/drizzle/schema";
```

GET 본문의 versions 조회(현재 18~20행)를 다음으로 교체:
```ts
  const variants = await db.select().from(proposalVariants)
    .where(eq(proposalVariants.proposalId, id)).orderBy(asc(proposalVariants.sortOrder));
  const variantIds = variants.map((v) => v.id);
  const versions = variantIds.length
    ? await db.select().from(proposalVersions)
        .where(inArray(proposalVersions.variantId, variantIds)).orderBy(asc(proposalVersions.versionNo))
    : [];
  return NextResponse.json({ proposal: rows[0], variants, versions });
```

- [ ] **Step 3: `DELETE /api/proposals/[id]` — pages 경로 수집을 variant join으로**

DELETE 본문의 pages 조회(현재 68~70행)를 다음으로 교체:
```ts
  const pages = await db.select({ path: proposalPages.storagePath }).from(proposalPages)
    .innerJoin(proposalVersions, eq(proposalPages.versionId, proposalVersions.id))
    .innerJoin(proposalVariants, eq(proposalVersions.variantId, proposalVariants.id))
    .where(eq(proposalVariants.proposalId, id));
```

- [ ] **Step 4: 타입체크**

Run: `npx tsc --noEmit`
Expected: 이 두 파일 관련 에러 해소(나머지 옮길 라우트/페이지 에러는 남아 있음).

- [ ] **Step 5: 커밋**

```bash
git add app/api/proposals/route.ts app/api/proposals/[id]/route.ts
git commit -m "feat: proposals create/get/delete handle variant level (Phase 4)"
```

---

## Task 4: 안 추가 라우트 `POST /api/proposals/[id]/variants`

**Files:**
- Create: `app/api/proposals/[id]/variants/route.ts`

- [ ] **Step 1: 라우트 작성**

`app/api/proposals/[id]/variants/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { proposals, proposalVariants, proposalVersions } from "@/drizzle/schema";
import { requireEditor } from "@/lib/auth/session";
import { extForContentType, pagePath, MAX_PAGE_BYTES } from "@/lib/proposals/constants";
import { createUploadUrl } from "@/lib/proposals/storage";
import { nextVariantSlug, defaultVariantLabel } from "@/lib/proposals/variant-slug";

type FileSpec = { contentType: string; size: number };

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let editor;
  try {
    editor = await requireEditor();
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const { id } = await params;
  const proposal = await db.select({ id: proposals.id }).from(proposals).where(eq(proposals.id, id)).limit(1);
  if (proposal.length === 0) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const body = await req.json();
  const files: FileSpec[] = Array.isArray(body.files) ? body.files : [];
  if (files.length === 0) return NextResponse.json({ error: "NO_FILES" }, { status: 400 });
  for (const f of files) {
    if (!extForContentType(String(f.contentType))) return NextResponse.json({ error: "INVALID_TYPE" }, { status: 400 });
    if (Number(f.size) > MAX_PAGE_BYTES) return NextResponse.json({ error: "FILE_TOO_LARGE" }, { status: 400 });
  }

  const existing = await db.select({ slug: proposalVariants.slug }).from(proposalVariants)
    .where(eq(proposalVariants.proposalId, id));
  const slug = nextVariantSlug(existing.map((e) => e.slug));
  const label = defaultVariantLabel(existing.length);

  const variantId = randomUUID();
  const versionId = randomUUID();
  await db.insert(proposalVariants).values({
    id: variantId, proposalId: id, label, slug, sortOrder: existing.length, createdBy: editor.id,
  });
  await db.insert(proposalVersions).values({ id: versionId, variantId, versionNo: 1, createdBy: editor.id });

  const uploads = [];
  for (let i = 0; i < files.length; i++) {
    const ext = extForContentType(String(files[i].contentType))!;
    const pageId = randomUUID();
    const path = pagePath(id, versionId, pageId, ext);
    const signed = await createUploadUrl(path);
    uploads.push({ pageId, path, token: signed.token, signedUrl: signed.signedUrl, pageOrder: i });
  }

  return NextResponse.json({ variantId, versionId, slug, label, uploads });
}
```

- [ ] **Step 2: 타입체크 + 커밋**

Run: `npx tsc --noEmit` (이 파일 관련 에러 없음 확인)
```bash
git add app/api/proposals/[id]/variants/route.ts
git commit -m "feat: add-variant route with first version + upload urls (Phase 4)"
```

---

## Task 5: 안 수정/삭제 라우트 `PATCH·DELETE /variants/[variantId]`

**Files:**
- Create: `app/api/proposals/[id]/variants/[variantId]/route.ts`

- [ ] **Step 1: 라우트 작성**

`app/api/proposals/[id]/variants/[variantId]/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { proposalVariants, proposalVersions, proposalPages } from "@/drizzle/schema";
import { requireEditor } from "@/lib/auth/session";
import { removeObjects } from "@/lib/proposals/storage";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; variantId: string }> },
) {
  try {
    await requireEditor();
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const { id, variantId } = await params;
  const body = await req.json();

  const updates: Partial<typeof proposalVariants.$inferInsert> = {};
  if (typeof body.label === "string") {
    const l = body.label.trim();
    if (!l) return NextResponse.json({ error: "LABEL_REQUIRED" }, { status: 400 });
    updates.label = l;
  }
  if (typeof body.sortOrder === "number" && Number.isInteger(body.sortOrder)) {
    updates.sortOrder = body.sortOrder;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "NO_CHANGES" }, { status: 400 });
  }
  await db.update(proposalVariants).set(updates)
    .where(and(eq(proposalVariants.id, variantId), eq(proposalVariants.proposalId, id)));
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; variantId: string }> },
) {
  try {
    await requireEditor();
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const { id, variantId } = await params;

  const all = await db.select({ id: proposalVariants.id }).from(proposalVariants)
    .where(eq(proposalVariants.proposalId, id));
  if (all.length <= 1) return NextResponse.json({ error: "LAST_VARIANT" }, { status: 409 });
  if (!all.some((v) => v.id === variantId)) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const pages = await db.select({ path: proposalPages.storagePath }).from(proposalPages)
    .innerJoin(proposalVersions, eq(proposalPages.versionId, proposalVersions.id))
    .where(eq(proposalVersions.variantId, variantId));
  await removeObjects([...new Set(pages.map((p) => p.path))]); // best-effort before row delete
  await db.delete(proposalVariants)
    .where(and(eq(proposalVariants.id, variantId), eq(proposalVariants.proposalId, id))); // cascade: versions + pages

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: 타입체크 + 커밋**

Run: `npx tsc --noEmit`
```bash
git add app/api/proposals/[id]/variants/[variantId]/route.ts
git commit -m "feat: variant rename/reorder + delete (last-variant guarded) (Phase 4)"
```

---

## Task 6: 새 버전 라우트 이동 → `/variants/[variantId]/versions`

**Files:**
- Create: `app/api/proposals/[id]/variants/[variantId]/versions/route.ts`
- Delete: `app/api/proposals/[id]/versions/route.ts`

- [ ] **Step 1: 새 위치에 라우트 작성**

`app/api/proposals/[id]/variants/[variantId]/versions/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { proposalVariants, proposalVersions } from "@/drizzle/schema";
import { requireEditor } from "@/lib/auth/session";
import { extForContentType, pagePath, MAX_PAGE_BYTES } from "@/lib/proposals/constants";
import { createUploadUrl } from "@/lib/proposals/storage";

type FileSpec = { contentType: string; size: number };

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; variantId: string }> },
) {
  let editor;
  try {
    editor = await requireEditor();
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const { id, variantId } = await params;
  const variant = await db.select({ id: proposalVariants.id }).from(proposalVariants)
    .where(and(eq(proposalVariants.id, variantId), eq(proposalVariants.proposalId, id))).limit(1);
  if (variant.length === 0) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const body = await req.json();
  const note = body.note ? String(body.note).trim() : null;
  const files: FileSpec[] = Array.isArray(body.files) ? body.files : [];
  if (files.length === 0) return NextResponse.json({ error: "NO_FILES" }, { status: 400 });
  for (const f of files) {
    if (!extForContentType(String(f.contentType))) return NextResponse.json({ error: "INVALID_TYPE" }, { status: 400 });
    if (Number(f.size) > MAX_PAGE_BYTES) return NextResponse.json({ error: "FILE_TOO_LARGE" }, { status: 400 });
  }

  const last = await db.select({ v: proposalVersions.versionNo }).from(proposalVersions)
    .where(eq(proposalVersions.variantId, variantId)).orderBy(desc(proposalVersions.versionNo)).limit(1);
  const nextNo = (last[0]?.v ?? 0) + 1;

  const versionId = randomUUID();
  await db.insert(proposalVersions).values({ id: versionId, variantId, versionNo: nextNo, note, createdBy: editor.id });

  const uploads = [];
  for (let i = 0; i < files.length; i++) {
    const ext = extForContentType(String(files[i].contentType))!;
    const pageId = randomUUID();
    const path = pagePath(id, versionId, pageId, ext);
    const signed = await createUploadUrl(path);
    uploads.push({ pageId, path, token: signed.token, signedUrl: signed.signedUrl, pageOrder: i });
  }

  return NextResponse.json({ versionId, versionNo: nextNo, uploads });
}
```

- [ ] **Step 2: 옛 라우트 삭제**

```bash
git rm app/api/proposals/[id]/versions/route.ts
```

- [ ] **Step 3: 타입체크 + 커밋**

Run: `npx tsc --noEmit`
```bash
git add app/api/proposals/[id]/variants/[variantId]/versions/route.ts
git commit -m "feat: move new-version route under variant scope (Phase 4)"
```

---

## Task 7: 업로드 확정 라우트 이동 + 안 current 갱신

**Files:**
- Create: `app/api/proposals/[id]/variants/[variantId]/versions/[versionId]/pages/route.ts`
- Delete: `app/api/proposals/[id]/versions/[vid]/pages/route.ts`

- [ ] **Step 1: 새 위치에 작성 (current를 안 레벨에 기록)**

`app/api/proposals/[id]/variants/[variantId]/versions/[versionId]/pages/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { proposals, proposalVariants, proposalVersions, proposalPages } from "@/drizzle/schema";
import { requireEditor } from "@/lib/auth/session";
import { listObjectNames } from "@/lib/proposals/storage";

type PageInput = { pageId: string; pageOrder: number; path: string; width: number; height: number };

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; variantId: string; versionId: string }> },
) {
  try {
    await requireEditor();
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const { id, variantId, versionId } = await params;
  const ver = await db.select({ id: proposalVersions.id }).from(proposalVersions)
    .innerJoin(proposalVariants, eq(proposalVersions.variantId, proposalVariants.id))
    .where(and(
      eq(proposalVersions.id, versionId),
      eq(proposalVariants.id, variantId),
      eq(proposalVariants.proposalId, id),
    )).limit(1);
  if (ver.length === 0) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const body = await req.json();
  const pages: PageInput[] = Array.isArray(body.pages) ? body.pages : [];
  if (pages.length === 0) return NextResponse.json({ error: "NO_PAGES" }, { status: 400 });

  // Verify every page references a real uploaded object under this version's folder
  // (path scheme unchanged: {proposalId}/{versionId}/{pageId}).
  const prefix = `${id}/${versionId}`;
  const existing = await listObjectNames(prefix);
  for (const p of pages) {
    const name = String(p.path).startsWith(`${prefix}/`) ? String(p.path).slice(prefix.length + 1) : "";
    if (!name || name.includes("/") || !existing.has(name)) {
      return NextResponse.json({ error: "OBJECT_MISSING", path: p.path }, { status: 400 });
    }
  }

  await db.insert(proposalPages).values(
    pages.map((p) => ({
      id: String(p.pageId),
      versionId,
      pageOrder: Number(p.pageOrder),
      storagePath: String(p.path),
      width: Number(p.width),
      height: Number(p.height),
    })),
  );
  await db.update(proposalVariants).set({ currentVersionId: versionId }).where(eq(proposalVariants.id, variantId));
  await db.update(proposals).set({ updatedAt: new Date() }).where(eq(proposals.id, id));

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: 옛 라우트 + 빈 폴더 삭제**

```bash
git rm app/api/proposals/[id]/versions/[vid]/pages/route.ts
```
(이로써 `app/api/proposals/[id]/versions/` 트리는 비게 된다. 남은 빈 디렉터리는 git이 추적하지 않으므로 무시 가능.)

- [ ] **Step 3: 타입체크 + 커밋**

Run: `npx tsc --noEmit`
```bash
git add app/api/proposals/[id]/variants/[variantId]/versions/[versionId]/pages/route.ts
git commit -m "feat: move pages-confirm route under variant; set variant.current (Phase 4)"
```

---

## Task 8: 복원 라우트 이동 → `/variants/[variantId]/restore`

**Files:**
- Create: `app/api/proposals/[id]/variants/[variantId]/restore/route.ts`
- Delete: `app/api/proposals/[id]/restore/route.ts`

- [ ] **Step 1: 새 위치에 작성 (안 스코프 비파괴 복원)**

`app/api/proposals/[id]/variants/[variantId]/restore/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { proposals, proposalVariants, proposalVersions, proposalPages } from "@/drizzle/schema";
import { requireEditor } from "@/lib/auth/session";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; variantId: string }> },
) {
  let editor;
  try {
    editor = await requireEditor();
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const { id, variantId } = await params;
  const body = await req.json();
  const versionId = String(body.versionId ?? "");

  // Source version must belong to this variant, which must belong to this proposal.
  const src = await db.select({ id: proposalVersions.id, versionNo: proposalVersions.versionNo })
    .from(proposalVersions)
    .innerJoin(proposalVariants, eq(proposalVersions.variantId, proposalVariants.id))
    .where(and(
      eq(proposalVersions.id, versionId),
      eq(proposalVariants.id, variantId),
      eq(proposalVariants.proposalId, id),
    )).limit(1);
  if (src.length === 0) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const srcPages = await db.select().from(proposalPages)
    .where(eq(proposalPages.versionId, versionId)).orderBy(asc(proposalPages.pageOrder));

  const last = await db.select({ v: proposalVersions.versionNo }).from(proposalVersions)
    .where(eq(proposalVersions.variantId, variantId)).orderBy(desc(proposalVersions.versionNo)).limit(1);
  const nextNo = (last[0]?.v ?? 0) + 1;

  const newVid = randomUUID();
  await db.insert(proposalVersions).values({
    id: newVid, variantId, versionNo: nextNo, note: `v${src[0].versionNo}에서 복원`, createdBy: editor.id,
  });
  if (srcPages.length > 0) {
    // Reuse the same storage objects (no re-upload) — copy only the rows.
    await db.insert(proposalPages).values(
      srcPages.map((p) => ({
        id: randomUUID(),
        versionId: newVid,
        pageOrder: p.pageOrder,
        storagePath: p.storagePath,
        width: p.width,
        height: p.height,
      })),
    );
  }
  await db.update(proposalVariants).set({ currentVersionId: newVid }).where(eq(proposalVariants.id, variantId));
  await db.update(proposals).set({ updatedAt: new Date() }).where(eq(proposals.id, id));

  return NextResponse.json({ ok: true, versionId: newVid, versionNo: nextNo });
}
```

- [ ] **Step 2: 옛 라우트 삭제**

```bash
git rm app/api/proposals/[id]/restore/route.ts
```

- [ ] **Step 3: 타입체크 + 커밋**

Run: `npx tsc --noEmit`
```bash
git add app/api/proposals/[id]/variants/[variantId]/restore/route.ts
git commit -m "feat: move restore route under variant scope (Phase 4)"
```

---

## Task 9: 클라이언트 업로드 폼들 — variant 스코프로 조정 + 안 추가 폼

**Files:**
- Modify: `components/proposals/proposal-create-form.tsx:33-35`
- Modify: `components/proposals/add-version-form.tsx`
- Modify: `components/proposals/version-actions.tsx`
- Create: `components/proposals/add-variant-form.tsx`

- [ ] **Step 1: `proposal-create-form.tsx` — confirm 엔드포인트에 variantId 사용**

33행 `const { proposalId, versionId, uploads } = await res.json();` 를 교체:
```ts
      const { proposalId, variantId, versionId, uploads } = await res.json();
```
35행 confirm fetch URL을 교체:
```ts
      const confirm = await fetch(`/api/proposals/${proposalId}/variants/${variantId}/versions/${versionId}/pages`, {
```

- [ ] **Step 2: `add-version-form.tsx` — variantId prop + variant 엔드포인트**

함수 시그니처와 두 fetch URL을 교체. 10행:
```ts
export function AddVersionForm({ proposalId, variantId }: { proposalId: string; variantId: string }) {
```
26행 fetch URL:
```ts
      const res = await fetch(`/api/proposals/${proposalId}/variants/${variantId}/versions`, {
```
34행 confirm fetch URL:
```ts
      const confirm = await fetch(`/api/proposals/${proposalId}/variants/${variantId}/versions/${versionId}/pages`, {
```

- [ ] **Step 3: `version-actions.tsx` — RestoreButton에 variantId 추가**

전체를 교체:
```tsx
"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";

export function RestoreButton({ proposalId, variantId, versionId, isCurrent }: {
  proposalId: string; variantId: string; versionId: string; isCurrent: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (isCurrent) return <span className="text-xs text-muted-foreground">현재 버전</span>;
  return (
    <Button size="sm" variant="outline" disabled={pending} onClick={() =>
      start(async () => {
        const res = await fetch(`/api/proposals/${proposalId}/variants/${variantId}/restore`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ versionId }),
        });
        if (res.ok) router.refresh();
      })
    }>복원</Button>
  );
}
```

- [ ] **Step 4: `add-variant-form.tsx` 신규 — 안 추가 업로더**

`components/proposals/add-variant-form.tsx`:
```tsx
"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ALLOWED_IMAGE_TYPES } from "@/lib/proposals/constants";
import { measureAll, uploadAll } from "@/lib/proposals/upload-client";

export function AddVariantForm({ proposalId, onDone }: { proposalId: string; onDone?: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const files = Array.from((form.elements.namedItem("files") as HTMLInputElement).files ?? []);
    if (files.length === 0) { setError("이미지를 1개 이상 선택하세요."); return; }

    setBusy(true);
    try {
      const measured = await measureAll(files);
      const res = await fetch(`/api/proposals/${proposalId}/variants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: files.map((f) => ({ contentType: f.type, size: f.size })) }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "안 추가 실패");
      const { variantId, versionId, uploads } = await res.json();
      const pages = await uploadAll(uploads, measured);
      const confirm = await fetch(`/api/proposals/${proposalId}/variants/${variantId}/versions/${versionId}/pages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pages }),
      });
      if (!confirm.ok) throw new Error((await confirm.json()).error ?? "페이지 저장 실패");
      form.reset();
      onDone?.();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-[8px] border border-border p-4">
      <div className="space-y-2">
        <Label htmlFor="variant-files">새 안 이미지 (여러 장 = 페이지)</Label>
        <Input id="variant-files" name="files" type="file" multiple accept={ALLOWED_IMAGE_TYPES.join(",")} required />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={busy}>{busy ? "업로드 중…" : "안 추가"}</Button>
    </form>
  );
}
```

- [ ] **Step 5: 타입체크 + 커밋**

Run: `npx tsc --noEmit`
Expected: 에디터 페이지가 아직 옛 props로 `AddVersionForm`/`RestoreButton`을 호출해 에러가 남아 있을 수 있음(Task 10에서 해소). 이 4개 컴포넌트 자체 에러는 없어야 함.
```bash
git add components/proposals/proposal-create-form.tsx components/proposals/add-version-form.tsx components/proposals/version-actions.tsx components/proposals/add-variant-form.tsx
git commit -m "feat: client upload forms target variant-scoped endpoints + add-variant form (Phase 4)"
```

---

## Task 10: 에디터 상세 페이지 — 안 탭 중심 재구성

**Files:**
- Create: `components/proposals/variant-tabs.tsx`
- Modify: `app/(dashboard)/dashboard/proposals/[id]/page.tsx`

- [ ] **Step 1: `variant-tabs.tsx` — 전환·추가·이름수정·삭제·순서**

`components/proposals/variant-tabs.tsx`:
```tsx
"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AddVariantForm } from "./add-variant-form";

type VariantTab = { id: string; label: string; slug: string };

export function VariantTabs({ proposalId, variants, activeVariantId }: {
  proposalId: string; variants: VariantTab[]; activeVariantId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();

  const active = variants.find((v) => v.id === activeVariantId) ?? variants[0];

  function selectVariant(id: string) {
    const next = new URLSearchParams(params);
    next.set("variant", id);
    router.push(`${pathname}?${next.toString()}`);
  }

  function patch(id: string, payload: Record<string, unknown>) {
    return fetch(`/api/proposals/${proposalId}/variants/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  function rename(form: HTMLFormElement) {
    const label = (form.elements.namedItem("label") as HTMLInputElement).value.trim();
    if (!label) return;
    start(async () => {
      const res = await patch(active.id, { label });
      if (res.ok) { setEditing(false); router.refresh(); }
    });
  }

  function move(dir: -1 | 1) {
    const idx = variants.findIndex((v) => v.id === active.id);
    const swapWith = variants[idx + dir];
    if (!swapWith) return;
    start(async () => {
      await Promise.all([
        patch(active.id, { sortOrder: idx + dir }),
        patch(swapWith.id, { sortOrder: idx }),
      ]);
      router.refresh();
    });
  }

  function remove() {
    if (variants.length <= 1) return;
    if (!confirm(`"${active.label}" 안을 삭제할까요? 이 안의 모든 버전이 삭제됩니다.`)) return;
    start(async () => {
      const res = await fetch(`/api/proposals/${proposalId}/variants/${active.id}`, { method: "DELETE" });
      if (res.ok) {
        const rest = variants.filter((v) => v.id !== active.id)[0];
        if (rest) selectVariant(rest.id);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {variants.map((v) => (
          <Button key={v.id} size="sm" variant={v.id === active.id ? "default" : "outline"}
            onClick={() => selectVariant(v.id)}>
            {v.label}
          </Button>
        ))}
        <Button size="sm" variant="outline" onClick={() => setAdding((s) => !s)}>＋ 안 추가</Button>
      </div>

      {adding && <AddVariantForm proposalId={proposalId} onDone={() => setAdding(false)} />}

      <div className="flex flex-wrap items-center gap-2">
        {editing ? (
          <form onSubmit={(e) => { e.preventDefault(); rename(e.currentTarget); }} className="flex items-center gap-2">
            <Input name="label" defaultValue={active.label} className="h-8 w-40" autoFocus />
            <Button size="sm" type="submit" disabled={pending}>저장</Button>
            <Button size="sm" type="button" variant="outline" onClick={() => setEditing(false)}>취소</Button>
          </form>
        ) : (
          <>
            <span className="text-sm text-muted-foreground">현재 안: <strong>{active.label}</strong> ({active.slug})</span>
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>이름 변경</Button>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => move(-1)}>◀ 앞으로</Button>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => move(1)}>뒤로 ▶</Button>
            <Button size="sm" variant="outline" disabled={pending || variants.length <= 1} onClick={remove}>안 삭제</Button>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 에디터 상세 페이지 재구성**

`app/(dashboard)/dashboard/proposals/[id]/page.tsx` 전체를 교체:
```tsx
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { proposals, proposalVariants, proposalVersions, proposalPages } from "@/drizzle/schema";
import { createReadUrl } from "@/lib/proposals/storage";
import { ProposalPreview } from "@/components/preview/proposal-preview";
import { AddVersionForm } from "@/components/proposals/add-version-form";
import { RestoreButton } from "@/components/proposals/version-actions";
import { ProposalSettings } from "@/components/proposals/proposal-settings";
import { VariantTabs } from "@/components/proposals/variant-tabs";
import { Badge } from "@/components/ui/badge";

export default async function ProposalDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ variant?: string }>;
}) {
  const { id } = await params;
  const { variant: wantedVariantId } = await searchParams;

  const rows = await db.select().from(proposals).where(eq(proposals.id, id)).limit(1);
  const proposal = rows[0];
  if (!proposal) notFound();

  const variants = await db.select().from(proposalVariants)
    .where(eq(proposalVariants.proposalId, id)).orderBy(asc(proposalVariants.sortOrder));
  if (variants.length === 0) notFound(); // 마이그레이션 후엔 항상 ≥1

  const active = variants.find((v) => v.id === wantedVariantId) ?? variants[0];

  const versions = await db.select().from(proposalVersions)
    .where(eq(proposalVersions.variantId, active.id)).orderBy(asc(proposalVersions.versionNo));

  const currentPages = active.currentVersionId
    ? await db.select().from(proposalPages)
        .where(eq(proposalPages.versionId, active.currentVersionId)).orderBy(asc(proposalPages.pageOrder))
    : [];
  const previews = await Promise.all(
    currentPages.map(async (pg) => ({
      id: pg.id, url: await createReadUrl(pg.storagePath), width: pg.width, height: pg.height,
    })),
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{proposal.title}</h1>
        <p className="mt-1 font-mono text-xs text-muted-foreground">/p/{proposal.publicId}</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">설정</h2>
        <ProposalSettings proposalId={proposal.id} visibility={proposal.visibility} hasPassword={!!proposal.accessPasswordHash} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">안</h2>
        <VariantTabs proposalId={proposal.id}
          variants={variants.map((v) => ({ id: v.id, label: v.label, slug: v.slug }))}
          activeVariantId={active.id} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">버전 히스토리 — {active.label}</h2>
        <ul className="space-y-2">
          {versions.map((v) => (
            <li key={v.id} className="flex items-center justify-between rounded-[8px] border border-border px-4 py-2">
              <span className="text-sm">
                v{v.versionNo}{v.note ? ` — ${v.note}` : ""}
                {v.id === active.currentVersionId && <Badge className="ml-2" variant="outline">current</Badge>}
              </span>
              <RestoreButton proposalId={proposal.id} variantId={active.id} versionId={v.id} isCurrent={v.id === active.currentVersionId} />
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">새 버전 — {active.label}</h2>
        <AddVersionForm proposalId={proposal.id} variantId={active.id} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">현재 버전 미리보기 — {active.label}</h2>
        <div className="h-[80vh] overflow-hidden rounded-[8px] border border-border">
          <ProposalPreview pages={previews} />
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 3: 타입체크 + 커밋**

Run: `npx tsc --noEmit`
Expected: 에디터 트리 에러 해소. 남는 에러는 공개 뷰어(`app/p/[publicId]/page.tsx`)의 `proposal.currentVersionId` 참조뿐(Task 12에서 해소).
```bash
git add components/proposals/variant-tabs.tsx "app/(dashboard)/dashboard/proposals/[id]/page.tsx"
git commit -m "feat: editor detail page organized around variant tabs (Phase 4)"
```

---

## Task 11: 공개 뷰어 컴포넌트 (목록 · 비교 · 상단 네비)

**Files:**
- Create: `components/preview/variant-list.tsx`
- Create: `components/preview/compare-view.tsx`
- Create: `components/preview/variant-viewer-nav.tsx`

- [ ] **Step 1: 안 목록 그리드**

`components/preview/variant-list.tsx`:
```tsx
import type { PreviewPage } from "@/lib/preview/types";

export type VariantCard = { slug: string; label: string; thumb: PreviewPage | null; pageCount: number };

export function VariantList({ publicId, items }: { publicId: string; items: VariantCard[] }) {
  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="mb-6 text-xl font-semibold tracking-tight">안 목록</h1>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => (
          <a key={it.slug} href={`/p/${publicId}?v=${it.slug}`}
            className="group block overflow-hidden rounded-[8px] border border-border transition hover:border-foreground">
            <div className="flex aspect-[4/3] items-center justify-center bg-muted">
              {it.thumb
                /* eslint-disable-next-line @next/next/no-img-element */
                ? <img src={it.thumb.url} alt={it.label} className="h-full w-full object-contain" />
                : <span className="text-sm text-muted-foreground">미리보기 없음</span>}
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="font-medium">{it.label}</span>
              <span className="text-xs text-muted-foreground">{it.pageCount}p</span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 나란히 비교**

`components/preview/compare-view.tsx`:
```tsx
import type { PreviewPage } from "@/lib/preview/types";

export type CompareColumn = { slug: string; label: string; pages: PreviewPage[] };

export function CompareView({ columns }: { columns: CompareColumn[] }) {
  return (
    <div className="flex h-full w-full gap-4 overflow-x-auto p-4">
      {columns.map((col) => (
        <div key={col.slug} className="flex h-full min-w-[280px] flex-1 flex-col">
          <div className="mb-2 shrink-0 text-center text-sm font-medium">{col.label}</div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-[8px] border border-border p-2">
            {col.pages.length === 0
              ? <p className="py-8 text-center text-xs text-muted-foreground">미리보기 없음</p>
              : col.pages.map((pg) => (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img key={pg.id} src={pg.url} alt="" className="w-full" />
                ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: 뷰어 상단 네비**

`components/preview/variant-viewer-nav.tsx`:
```tsx
import { Badge } from "@/components/ui/badge";

type NavItem = { slug: string; label: string };

export function VariantViewerNav({ publicId, items, activeSlug }: {
  publicId: string; items: NavItem[]; activeSlug: string;
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border p-2">
      <a href={`/p/${publicId}`} className="text-sm underline">목록</a>
      <span className="text-muted-foreground">·</span>
      {items.map((it) => (
        <a key={it.slug} href={`/p/${publicId}?v=${it.slug}`}>
          <Badge variant={it.slug === activeSlug ? "default" : "outline"}>{it.label}</Badge>
        </a>
      ))}
      <span className="text-muted-foreground">·</span>
      <a href={`/p/${publicId}?compare=1`} className="text-sm underline">나란히 보기</a>
    </div>
  );
}
```

- [ ] **Step 4: 타입체크 + 커밋**

Run: `npx tsc --noEmit`
Expected: 이 세 컴포넌트 자체 에러 없음(아직 뷰어 페이지에서 미사용).
```bash
git add components/preview/variant-list.tsx components/preview/compare-view.tsx components/preview/variant-viewer-nav.tsx
git commit -m "feat: public viewer components — variant list, compare, nav (Phase 4)"
```

---

## Task 12: 공개 뷰어 페이지 — 목록 / `?v=` / `?compare=1`

**Files:**
- Modify: `app/p/[publicId]/page.tsx`

- [ ] **Step 1: 페이지 재작성**

`app/p/[publicId]/page.tsx` 전체를 교체 (접근 게이트 로직은 동일, allow 이후만 분기):
```tsx
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { proposals, proposalVariants, proposalPages } from "@/drizzle/schema";
import type { ProposalVariant } from "@/drizzle/schema";
import { getProfile } from "@/lib/auth/session";
import { isEditor, type Role } from "@/lib/auth/roles";
import { decideAccess } from "@/lib/proposals/access";
import { verifyUnlockToken, unlockCookieName } from "@/lib/access/cookie";
import { createReadUrl } from "@/lib/proposals/storage";
import type { PreviewPage } from "@/lib/preview/types";
import { ProposalPreview } from "@/components/preview/proposal-preview";
import { VariantList } from "@/components/preview/variant-list";
import { CompareView } from "@/components/preview/compare-view";
import { VariantViewerNav } from "@/components/preview/variant-viewer-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { unlock } from "./actions";

async function loadPages(versionId: string | null): Promise<PreviewPage[]> {
  if (!versionId) return [];
  const pages = await db.select().from(proposalPages)
    .where(eq(proposalPages.versionId, versionId)).orderBy(asc(proposalPages.pageOrder));
  return Promise.all(pages.map(async (pg) => ({
    id: pg.id, url: await createReadUrl(pg.storagePath), width: pg.width, height: pg.height,
  })));
}

export default async function PublicViewerPage({
  params,
  searchParams,
}: {
  params: Promise<{ publicId: string }>;
  searchParams: Promise<{ error?: string; v?: string; compare?: string }>;
}) {
  const { publicId } = await params;
  const { error, v, compare } = await searchParams;

  const rows = await db.select().from(proposals).where(eq(proposals.publicId, publicId)).limit(1);
  const proposal = rows[0];
  if (!proposal) notFound();

  const profile = await getProfile();
  const editor = isEditor(profile?.role as Role | undefined);

  const cookieStore = await cookies();
  const token = cookieStore.get(unlockCookieName(publicId))?.value ?? "";
  // Server component renders once per request; reading the request-time clock here is intentional.
  // eslint-disable-next-line react-hooks/purity
  const nowSec = Math.floor(Date.now() / 1000);
  const hasValidUnlock = !!token &&
    verifyUnlockToken(token, publicId, nowSec, process.env.ACCESS_TOKEN_SECRET!);

  const decision = decideAccess({
    visibility: proposal.visibility,
    hasPassword: !!proposal.accessPasswordHash,
    isEditor: editor,
    hasValidUnlock,
  });

  if (decision === "forbidden") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
        <h1 className="text-xl font-semibold">비공개 시안</h1>
        <p className="text-sm text-muted-foreground">이 시안은 비공개입니다. 편집자 로그인이 필요합니다.</p>
        <a href="/login" className="text-sm underline">로그인</a>
      </div>
    );
  }

  if (decision === "need-password") {
    const unlockWithId = unlock.bind(null, publicId);
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-sm p-8">
          <h1 className="text-xl font-semibold tracking-tight">{proposal.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">비밀번호가 필요한 시안입니다.</p>
          <form action={unlockWithId} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">비밀번호</Label>
              <Input id="password" name="password" type="password" required />
            </div>
            {error && <p className="text-sm text-destructive">비밀번호가 올바르지 않습니다.</p>}
            <Button type="submit" className="w-full">열기</Button>
          </form>
        </Card>
      </div>
    );
  }

  // decision === "allow"
  const variants: ProposalVariant[] = await db.select().from(proposalVariants)
    .where(eq(proposalVariants.proposalId, proposal.id)).orderBy(asc(proposalVariants.sortOrder));
  const navItems = variants.map((vr) => ({ slug: vr.slug, label: vr.label }));

  // 나란히 비교
  if (compare) {
    const columns = await Promise.all(
      variants.map(async (vr) => ({ slug: vr.slug, label: vr.label, pages: await loadPages(vr.currentVersionId) })),
    );
    return (
      <div className="flex h-screen w-screen flex-col">
        <VariantViewerNav publicId={publicId} items={navItems} activeSlug="" />
        <div className="min-h-0 flex-1"><CompareView columns={columns} /></div>
      </div>
    );
  }

  // 특정 안 (?v=slug)
  if (v) {
    const variant = variants.find((vr) => vr.slug === v);
    if (!variant) notFound();
    const previews = await loadPages(variant.currentVersionId);
    return (
      <div className="flex h-screen w-screen flex-col">
        <VariantViewerNav publicId={publicId} items={navItems} activeSlug={variant.slug} />
        <div className="min-h-0 flex-1"><ProposalPreview pages={previews} /></div>
      </div>
    );
  }

  // 기본: 안 목록
  const items = await Promise.all(
    variants.map(async (vr) => {
      const pages = await loadPages(vr.currentVersionId);
      return { slug: vr.slug, label: vr.label, thumb: pages[0] ?? null, pageCount: pages.length };
    }),
  );
  return <VariantList publicId={publicId} items={items} />;
}
```

- [ ] **Step 2: 전체 타입체크 — 이제 깨끗해야 함**

Run: `npx tsc --noEmit`
Expected: **에러 0건**. 남아 있으면 해당 파일을 위 태스크 코드와 대조해 수정.

- [ ] **Step 3: 기존 테스트 전체 통과 확인**

Run: `npm test`
Expected: 기존 + 신규(variant-slug) 테스트 전부 PASS.

- [ ] **Step 4: 커밋**

```bash
git add app/p/[publicId]/page.tsx
git commit -m "feat: public viewer — variant list / ?v= / ?compare (Phase 4)"
```

---

## Task 13: 통합 검증 + 수동 체크리스트 + 머지

**Files:** (없음 — 검증/머지)

- [ ] **Step 1: 정적 게이트 재확인**

```bash
npx tsc --noEmit && npm test && npm run lint
```
Expected: 타입 0 에러, 테스트 전부 PASS, lint 통과(기존 수준).

- [ ] **Step 2: 개발 서버 수동 검증 (브라우저)**

Run: `npm run dev` 후 편집자로 로그인하여 확인:
- [ ] 새 시안 생성 → 에디터에 안 "A" 1개, v1, 미리보기 정상
- [ ] "＋ 안 추가"로 다른 이미지 업로드 → 안 "B" 생성, 탭 전환됨
- [ ] 안 "A" 이름을 "1안"으로 변경 → 라벨만 바뀌고 탭/URL 유지
- [ ] 안 "B"에 "새 버전" 업로드 → v2 생성, current=v2, "복원"으로 v1 복원 시 v3 생김(비파괴)
- [ ] "◀ 앞으로/뒤로 ▶"로 순서 변경 반영
- [ ] 안 1개만 남기면 "안 삭제" 비활성(409 방지), 2개 이상이면 삭제 동작
- [ ] 공개로 전환 후 `/p/{publicId}` → **안 목록** 그리드(썸네일) 표시
- [ ] 안 카드 클릭 → `?v=slug`로 해당 안 현재 버전 렌더, 상단 네비로 전환
- [ ] `?compare=1` → 모든 안 현재 버전 컬럼 비교
- [ ] 라벨 변경 후에도 이전 `?v=slug` 링크 유효
- [ ] 비번 시안: unlock 후 위 흐름 동일 / 클라이언트에 히스토리 비노출
- [ ] 기존(마이그레이션된) 시안 열람·편집 정상

> 문제 발견 시: superpowers:systematic-debugging로 원인 파악 → 해당 태스크 코드 수정 → 재커밋.

- [ ] **Step 3: master로 fast-forward 머지**

```bash
npx tsc --noEmit && npm test
git checkout master
git merge --ff-only feat/phase4-variants
```
Expected: ff-merge 성공. (충돌/비-ff면 멈추고 사용자에게 보고.)

- [ ] **Step 4: 메모리 갱신 안내**

`phased-build-workflow` 메모리의 진행 상태에 "Phase 4(멀티 안) 완료"를 반영하도록 사용자에게 제안(자동 수정 금지, 확인 후).

---

## Self-Review (작성자 확인 완료)

- **Spec 커버리지**: 안 CRUD(Task 4·5·10), 안별 히스토리/복원(Task 6·7·8·10), 뷰어 목록/`?v=`/`?compare`(Task 11·12), label/slug 분리(Task 1·2), 권한 시안 단위 유지(Task 12 게이트 보존), 마이그레이션(Task 2), 마지막 안 삭제 불가(Task 5·10), 테스트(Task 1) — 모두 태스크 존재.
- **Placeholder 스캔**: TBD/TODO 없음. 모든 코드 블록은 실제 내용.
- **타입 일관성**: 경로 파라미터 `id`/`variantId`/`versionId` 일관, 클라 폼 엔드포인트 ↔ 라우트 일치, `currentVersionId`는 안 레벨로만 참조, `proposalVersions.variantId` 통일.
