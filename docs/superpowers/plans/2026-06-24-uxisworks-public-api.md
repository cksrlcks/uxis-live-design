# 유시스웍스 공개 API 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 노출(`exposed_to_uxisworks`) 시안의 포트폴리오용 정보를 유시스웍스가 읽어가는 무인증 읽기전용 공개 API(`/api/public/*`)를 만든다.

**Architecture:** 기존 `/api/plugin/*`(외부 표면) 분리 패턴을 따라 새 읽기전용 네임스페이스 `/api/public/*`를 둔다. 인가는 권한이 아니라 데이터 필터(`exposed_to_uxisworks = true`)다. FSD 컨벤션대로 서버 전용 쿼리 함수(`*.server.ts`)를 entity에 두고, route handler는 얇게 감싼다. 순수 변환 로직(파라미터 클램프, 태그 그룹핑)만 분리해 단위 테스트하고, DB 쿼리·라우트·proxy는 타입체크 + 수동 E2E로 검증한다(레포 기존 컨벤션 = 순수 로직만 vitest).

**Tech Stack:** Next.js 16 App Router(route handlers), drizzle-orm(postgres-js), Supabase Storage(public 버킷), zod(미사용 — 입력은 쿼리스트링뿐), vitest.

## Global Constraints

- Node `>=22.0.0`.
- 응답 식별자는 `publicId`·`domain`만. 내부 UUID(`id`/`variantId`/`versionId`/`pageId`)는 **응답에 넣지 않는다**.
- 노출 필드: 제목·태그·작성일·최종버전 이미지. **제외**: `participants`, `figmaUrl`.
- "최종버전" = 각 안의 `currentVersionId`가 가리키는 버전.
- 모든 공개 쿼리는 `eq(proposals.exposedToUxisworks, true)` 필터를 건다. `requireEditor()` 호출 금지.
- 이미지 URL은 `publicUrl(storagePath)` (`@/shared/lib/proposals/constants`) 재사용.
- 캐시 헤더(`Cache-Control` 등) 추가 금지.
- 작성일은 응답에서 ISO 문자열(`Date.prototype.toISOString()`).
- 페이지네이션: `page>=1`, `pageSize` 1~100 클램프, 기본 `page=1`/`pageSize=20`.
- 정렬: 목록은 `createdAt desc, id desc`. 안은 `sortOrder asc`. 페이지는 `pageOrder asc`.

> **검증 주의(기존 무관 실패):** `npm run lint`에 기존 실패 2건, `npm run format:check` 전역 실패, `tests/.../locate.test.ts` 2건 기존 실패가 있다. 내 변경과 무관하니 새로 생긴 실패만 본다([[repo-verification-gotchas]]).

---

### Task 1: 공개 응답 타입 + 목록 파라미터 클램프 헬퍼

**Files:**
- Create: `src/entities/tag/model/public-types.ts`
- Create: `src/entities/proposal/model/public-types.ts`
- Create: `src/entities/proposal/lib/public-list-params.ts`
- Test: `tests/entities/proposal/public-list-params.test.ts`

**Interfaces:**
- Produces: `PublicTag`(tag entity), `PublicPage`/`PublicProposalSummary`/`PublicVariant`/`PublicProposalDetail`(proposal entity), `clampListParams(page, pageSize) => { page, pageSize }`.

- [ ] **Step 1: 태그 공개 타입 작성**

`src/entities/tag/model/public-types.ts`:

```ts
// 유시스웍스 공개 API용 태그 DTO. 안정 키(code)와 표시 라벨(label)을 함께 노출해
// 소비 측이 필터링·표시 모두 가능하게 한다.
export type PublicTag = {
  group: string; // tag_groups.code
  groupLabel: string; // tag_groups.label
  code: string; // tag_options.code
  label: string; // tag_options.label
};
```

- [ ] **Step 2: 시안 공개 타입 작성**

`src/entities/proposal/model/public-types.ts`:

```ts
import type { PublicTag } from "@/entities/tag/model/public-types";

// 공개 이미지 한 장: 영구 public URL + 원본 픽셀 크기. 배열 순서 = 표시 순서.
export type PublicPage = { url: string; width: number; height: number };

// 목록 요약 행: 커버 1장 + 태그 + 작성일(ISO).
export type PublicProposalSummary = {
  publicId: string;
  domain: string | null;
  title: string;
  createdAt: string; // ISO
  cover: PublicPage | null;
  tags: PublicTag[];
};

// 상세의 안 한 개: 최종버전 메타 + 그 버전의 페이지들.
export type PublicVariant = {
  slug: string;
  label: string;
  version: { versionNo: number; note: string | null } | null;
  pages: PublicPage[];
};

// 상세 전체.
export type PublicProposalDetail = {
  publicId: string;
  domain: string | null;
  title: string;
  createdAt: string; // ISO
  tags: PublicTag[];
  variants: PublicVariant[];
};
```

- [ ] **Step 3: 실패하는 테스트 작성**

`tests/entities/proposal/public-list-params.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { clampListParams } from "@/entities/proposal/lib/public-list-params";

describe("clampListParams", () => {
  it("정상값은 그대로", () => {
    expect(clampListParams(1, 20)).toEqual({ page: 1, pageSize: 20 });
    expect(clampListParams(3, 50)).toEqual({ page: 3, pageSize: 50 });
  });
  it("page<1은 1로 보정", () => {
    expect(clampListParams(0, 20)).toEqual({ page: 1, pageSize: 20 });
    expect(clampListParams(-5, 20)).toEqual({ page: 1, pageSize: 20 });
  });
  it("pageSize는 1~100 클램프", () => {
    expect(clampListParams(2, 0)).toEqual({ page: 2, pageSize: 1 });
    expect(clampListParams(2, -3)).toEqual({ page: 2, pageSize: 1 });
    expect(clampListParams(2, 1000)).toEqual({ page: 2, pageSize: 100 });
  });
  it("소수는 버림", () => {
    expect(clampListParams(2.7, 20.9)).toEqual({ page: 2, pageSize: 20 });
  });
  it("NaN/비유한은 기본값으로 떨어진다", () => {
    // Number.isFinite(NaN/Infinity) === false → page=1, pageSize=20 기본값 적용 후 클램프.
    expect(clampListParams(NaN, NaN)).toEqual({ page: 1, pageSize: 20 });
    expect(clampListParams(Infinity, Infinity)).toEqual({ page: 1, pageSize: 20 });
  });
});
```

- [ ] **Step 4: 테스트 실패 확인**

Run: `npx vitest run tests/entities/proposal/public-list-params.test.ts`
Expected: FAIL — `clampListParams` 모듈 없음.

- [ ] **Step 5: 클램프 헬퍼 구현**

`src/entities/proposal/lib/public-list-params.ts`:

```ts
// 목록 쿼리 파라미터를 안전 범위로 보정한다. page>=1, pageSize 1~100.
// 비유한(NaN/Infinity)·미지정은 기본값(page=1, pageSize=20)으로 떨어진 뒤 클램프된다.
export function clampListParams(
  page: number,
  pageSize: number,
): { page: number; pageSize: number } {
  const p = Number.isFinite(page) ? Math.trunc(page) : 1;
  const s = Number.isFinite(pageSize) ? Math.trunc(pageSize) : 20;
  return { page: Math.max(1, p), pageSize: Math.min(100, Math.max(1, s)) };
}
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `npx vitest run tests/entities/proposal/public-list-params.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 7: 커밋**

```bash
git add src/entities/tag/model/public-types.ts src/entities/proposal/model/public-types.ts src/entities/proposal/lib/public-list-params.ts tests/entities/proposal/public-list-params.test.ts
git commit -m "feat(public-api): 공개 응답 타입 + 목록 파라미터 클램프"
```

---

### Task 2: 태그 배치 조회 + 그룹핑 헬퍼

**Files:**
- Create: `src/entities/tag/lib/group-public-tags.ts`
- Test: `tests/entities/tag/group-public-tags.test.ts`
- Create: `src/entities/tag/api/get-public-tags-by-proposal.server.ts`

**Interfaces:**
- Consumes: `PublicTag`(Task 1).
- Produces: `PublicTagRow` 타입, `groupPublicTags(rows) => Map<string, PublicTag[]>`, `getPublicTagsByProposal(proposalIds) => Promise<Map<string, PublicTag[]>>`.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/entities/tag/group-public-tags.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { groupPublicTags, type PublicTagRow } from "@/entities/tag/lib/group-public-tags";

const row = (proposalId: string, code: string): PublicTagRow => ({
  proposalId,
  group: "industry",
  groupLabel: "산업",
  code,
  label: code.toUpperCase(),
});

describe("groupPublicTags", () => {
  it("빈 입력은 빈 Map", () => {
    expect(groupPublicTags([]).size).toBe(0);
  });
  it("같은 시안의 행을 한 키로 입력 순서대로 묶는다", () => {
    const m = groupPublicTags([row("p1", "fintech"), row("p1", "edu")]);
    expect(m.get("p1")).toEqual([
      { group: "industry", groupLabel: "산업", code: "fintech", label: "FINTECH" },
      { group: "industry", groupLabel: "산업", code: "edu", label: "EDU" },
    ]);
  });
  it("서로 다른 시안은 다른 키", () => {
    const m = groupPublicTags([row("p1", "fintech"), row("p2", "edu")]);
    expect(m.size).toBe(2);
    expect(m.get("p1")).toHaveLength(1);
    expect(m.get("p2")).toHaveLength(1);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/entities/tag/group-public-tags.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 그룹핑 헬퍼 구현**

`src/entities/tag/lib/group-public-tags.ts`:

```ts
import type { PublicTag } from "../model/public-types";

// DB 조인 행. 입력은 group/option sortOrder로 이미 정렬돼 있다고 가정한다.
export type PublicTagRow = {
  proposalId: string;
  group: string;
  groupLabel: string;
  code: string;
  label: string;
};

// proposalId별로 PublicTag[]로 묶는다(입력 순서 보존).
export function groupPublicTags(rows: PublicTagRow[]): Map<string, PublicTag[]> {
  const byProposal = new Map<string, PublicTag[]>();
  for (const r of rows) {
    const list = byProposal.get(r.proposalId) ?? [];
    list.push({ group: r.group, groupLabel: r.groupLabel, code: r.code, label: r.label });
    byProposal.set(r.proposalId, list);
  }
  return byProposal;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/entities/tag/group-public-tags.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: 태그 배치 조회 쿼리 구현**

`src/entities/tag/api/get-public-tags-by-proposal.server.ts`:

```ts
import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/shared/db";
import { proposalTags, tagOptions, tagGroups } from "@drizzle/schema";
import { groupPublicTags, type PublicTagRow } from "../lib/group-public-tags";
import type { PublicTag } from "../model/public-types";

// 여러 시안의 태그를 한 쿼리로 모아 proposalId별 PublicTag[]로 반환(N+1 없음).
// group sortOrder → option sortOrder로 정렬한다.
export async function getPublicTagsByProposal(
  proposalIds: string[],
): Promise<Map<string, PublicTag[]>> {
  if (proposalIds.length === 0) return new Map();

  const rows: PublicTagRow[] = await db
    .select({
      proposalId: proposalTags.proposalId,
      group: tagGroups.code,
      groupLabel: tagGroups.label,
      code: tagOptions.code,
      label: tagOptions.label,
    })
    .from(proposalTags)
    .innerJoin(tagOptions, eq(tagOptions.id, proposalTags.optionId))
    .innerJoin(tagGroups, eq(tagGroups.id, tagOptions.groupId))
    .where(inArray(proposalTags.proposalId, proposalIds))
    .orderBy(asc(tagGroups.sortOrder), asc(tagOptions.sortOrder));

  return groupPublicTags(rows);
}
```

- [ ] **Step 6: 타입체크**

Run: `npx tsc --noEmit`
Expected: 이 파일 관련 신규 에러 없음.

- [ ] **Step 7: 커밋**

```bash
git add src/entities/tag/lib/group-public-tags.ts tests/entities/tag/group-public-tags.test.ts src/entities/tag/api/get-public-tags-by-proposal.server.ts
git commit -m "feat(public-api): 시안 태그 배치 조회 + 그룹핑 헬퍼"
```

---

### Task 3: 목록 쿼리 `getPublicProposals`

**Files:**
- Create: `src/entities/proposal/api/get-public-proposals.server.ts`

**Interfaces:**
- Consumes: `clampListParams`(Task 1), `getPublicTagsByProposal`(Task 2), `Paginated`(`../model/types`), `PublicProposalSummary`/`PublicPage`(Task 1), `publicUrl`.
- Produces: `getPublicProposals(page?, pageSize?) => Promise<Paginated<PublicProposalSummary>>`.

- [ ] **Step 1: 목록 쿼리 구현**

`src/entities/proposal/api/get-public-proposals.server.ts`:

```ts
import "server-only";
import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/shared/db";
import { proposals, proposalVariants, proposalPages } from "@drizzle/schema";
import { publicUrl } from "@/shared/lib/proposals/constants";
import { getPublicTagsByProposal } from "@/entities/tag/api/get-public-tags-by-proposal.server";
import { clampListParams } from "../lib/public-list-params";
import type { Paginated } from "../model/types";
import type { PublicProposalSummary, PublicPage } from "../model/public-types";

// 노출(exposed) 시안의 페이지네이션 요약 목록. 각 행에 커버 1장 + 태그를 싣는다.
// 정렬은 createdAt desc, id desc(고정 tie-break).
export async function getPublicProposals(
  pageInput = 1,
  pageSizeInput = 20,
): Promise<Paginated<PublicProposalSummary>> {
  const { page, pageSize } = clampListParams(pageInput, pageSizeInput);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(proposals)
    .where(eq(proposals.exposedToUxisworks, true));

  const rows = await db
    .select()
    .from(proposals)
    .where(eq(proposals.exposedToUxisworks, true))
    .orderBy(desc(proposals.createdAt), desc(proposals.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const proposalIds = rows.map((p) => p.id);

  // 커버 후보: 각 시안의 안들을 sortOrder 순으로, currentVersionId가 있는 것만 모은다.
  const variants = proposalIds.length
    ? await db
        .select({
          proposalId: proposalVariants.proposalId,
          currentVersionId: proposalVariants.currentVersionId,
        })
        .from(proposalVariants)
        .where(inArray(proposalVariants.proposalId, proposalIds))
        .orderBy(asc(proposalVariants.proposalId), asc(proposalVariants.sortOrder))
    : [];

  const candidateVersionsByProposal = new Map<string, string[]>();
  for (const v of variants) {
    if (!v.currentVersionId) continue;
    const list = candidateVersionsByProposal.get(v.proposalId) ?? [];
    list.push(v.currentVersionId);
    candidateVersionsByProposal.set(v.proposalId, list);
  }

  // 후보 버전들의 첫 페이지(pageOrder 최소)를 한 번에 조회.
  const candidateVersionIds = [...candidateVersionsByProposal.values()].flat();
  const coverRows = candidateVersionIds.length
    ? await db
        .select({
          versionId: proposalPages.versionId,
          storagePath: proposalPages.storagePath,
          width: proposalPages.width,
          height: proposalPages.height,
        })
        .from(proposalPages)
        .where(inArray(proposalPages.versionId, candidateVersionIds))
        .orderBy(asc(proposalPages.pageOrder))
    : [];

  const firstPageByVersion = new Map<string, PublicPage>();
  for (const pg of coverRows) {
    if (firstPageByVersion.has(pg.versionId)) continue; // 정렬상 첫 행 = pageOrder 최소
    firstPageByVersion.set(pg.versionId, {
      url: publicUrl(pg.storagePath),
      width: pg.width,
      height: pg.height,
    });
  }

  const tagsByProposal = await getPublicTagsByProposal(proposalIds);

  const items: PublicProposalSummary[] = rows.map((p) => {
    // sortOrder 순으로 이미지가 있는 첫 안의 첫 페이지를 커버로. 없으면 null.
    let cover: PublicPage | null = null;
    for (const versionId of candidateVersionsByProposal.get(p.id) ?? []) {
      const pg = firstPageByVersion.get(versionId);
      if (pg) {
        cover = pg;
        break;
      }
    }
    return {
      publicId: p.publicId,
      domain: p.domain,
      title: p.title,
      createdAt: p.createdAt.toISOString(),
      cover,
      tags: tagsByProposal.get(p.id) ?? [],
    };
  });

  return { items, total, page, pageSize };
}
```

> 커버 규칙 주: 스펙은 "첫 번째 안의 최종버전 첫 페이지"였으나, 첫 안이 비어 있어도 갤러리에 빈 커버가
> 나오지 않도록 **sortOrder 순으로 이미지가 있는 첫 안**으로 폴백한다(결정적, 더 유용). 이미지가 전혀
> 없으면 `null`.

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`
Expected: 신규 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add src/entities/proposal/api/get-public-proposals.server.ts
git commit -m "feat(public-api): 노출 시안 목록 쿼리(커버+태그+페이징)"
```

---

### Task 4: 상세 쿼리 `getPublicProposal`

**Files:**
- Create: `src/entities/proposal/api/get-public-proposal.server.ts`

**Interfaces:**
- Consumes: `getPublicTagsByProposal`(Task 2), `PublicProposalDetail`/`PublicVariant`/`PublicPage`(Task 1), `publicUrl`.
- Produces: `getPublicProposal(publicId) => Promise<PublicProposalDetail>` (없거나 비노출이면 `throw new Error("NOT_FOUND")`).

- [ ] **Step 1: 상세 쿼리 구현**

`src/entities/proposal/api/get-public-proposal.server.ts`:

```ts
import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/shared/db";
import { proposals, proposalVariants, proposalVersions, proposalPages } from "@drizzle/schema";
import { publicUrl } from "@/shared/lib/proposals/constants";
import { getPublicTagsByProposal } from "@/entities/tag/api/get-public-tags-by-proposal.server";
import type { PublicProposalDetail, PublicVariant, PublicPage } from "../model/public-types";

// 노출(exposed) 시안 단건의 안별 최종버전 트리. 비노출/부재는 NOT_FOUND.
export async function getPublicProposal(publicId: string): Promise<PublicProposalDetail> {
  const rows = await db
    .select()
    .from(proposals)
    .where(and(eq(proposals.publicId, publicId), eq(proposals.exposedToUxisworks, true)))
    .limit(1);
  const proposal = rows[0];
  if (!proposal) throw new Error("NOT_FOUND");

  const variants = await db
    .select()
    .from(proposalVariants)
    .where(eq(proposalVariants.proposalId, proposal.id))
    .orderBy(asc(proposalVariants.sortOrder));

  // 각 안의 최종버전(currentVersionId)만 싣는다.
  const versionIds = variants
    .map((v) => v.currentVersionId)
    .filter((id): id is string => id !== null);

  const versions = versionIds.length
    ? await db
        .select({
          id: proposalVersions.id,
          versionNo: proposalVersions.versionNo,
          note: proposalVersions.note,
        })
        .from(proposalVersions)
        .where(inArray(proposalVersions.id, versionIds))
    : [];
  const versionById = new Map(versions.map((v) => [v.id, v]));

  const pages = versionIds.length
    ? await db
        .select()
        .from(proposalPages)
        .where(inArray(proposalPages.versionId, versionIds))
        .orderBy(asc(proposalPages.pageOrder))
    : [];
  const pagesByVersion = new Map<string, PublicPage[]>();
  for (const pg of pages) {
    const list = pagesByVersion.get(pg.versionId) ?? [];
    list.push({ url: publicUrl(pg.storagePath), width: pg.width, height: pg.height });
    pagesByVersion.set(pg.versionId, list);
  }

  const tagsByProposal = await getPublicTagsByProposal([proposal.id]);

  const publicVariants: PublicVariant[] = variants.map((v) => {
    const ver = v.currentVersionId ? versionById.get(v.currentVersionId) : undefined;
    return {
      slug: v.slug,
      label: v.label,
      version: ver ? { versionNo: ver.versionNo, note: ver.note } : null,
      pages: v.currentVersionId ? (pagesByVersion.get(v.currentVersionId) ?? []) : [],
    };
  });

  return {
    publicId: proposal.publicId,
    domain: proposal.domain,
    title: proposal.title,
    createdAt: proposal.createdAt.toISOString(),
    tags: tagsByProposal.get(proposal.id) ?? [],
    variants: publicVariants,
  };
}
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`
Expected: 신규 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add src/entities/proposal/api/get-public-proposal.server.ts
git commit -m "feat(public-api): 노출 시안 상세 쿼리(안별 최종버전)"
```

---

### Task 5: 라우트 핸들러 + proxy CORS

**Files:**
- Create: `app/api/public/proposals/route.ts`
- Create: `app/api/public/proposals/[publicId]/route.ts`
- Modify: `proxy.ts` (CORS 분기 추가)

**Interfaces:**
- Consumes: `getPublicProposals`(Task 3), `getPublicProposal`(Task 4), `toErrorResponse`(`@/shared/api/to-error-response`).

- [ ] **Step 1: 목록 라우트 작성**

`app/api/public/proposals/route.ts`:

```ts
import { NextRequest } from "next/server";
import { getPublicProposals } from "@/entities/proposal/api/get-public-proposals.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

// 유시스웍스 공개 목록 — 무인증. exposed 시안만 페이지네이션해 반환(클램프는 쿼리 내부).
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Number(searchParams.get("page") ?? "1");
    const pageSize = Number(searchParams.get("pageSize") ?? "20");
    return Response.json(await getPublicProposals(page, pageSize));
  } catch (error) {
    return toErrorResponse(error);
  }
}
```

- [ ] **Step 2: 상세 라우트 작성**

`app/api/public/proposals/[publicId]/route.ts`:

```ts
import { NextRequest } from "next/server";
import { getPublicProposal } from "@/entities/proposal/api/get-public-proposal.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

// 유시스웍스 공개 상세 — 무인증. 비노출/부재는 NOT_FOUND(404).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ publicId: string }> },
) {
  try {
    const { publicId } = await params;
    return Response.json(await getPublicProposal(publicId));
  } catch (error) {
    return toErrorResponse(error);
  }
}
```

- [ ] **Step 3: proxy.ts에 공개 CORS 분기 추가**

`proxy.ts` — 기존 `PLUGIN_CORS` 상수 **아래**에 `PUBLIC_CORS`를 추가:

```ts
// 읽기전용 공개 표면(/api/public/*). 인증 없이 노출(exposed) 시안만 반환한다.
// 쿠키 자격증명을 받지 않으니 와일드카드 Origin(*)이 안전하다. 읽기 전용이라 GET/OPTIONS만 허용.
const PUBLIC_CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};
```

그리고 `proxy()` 함수 안, 기존 플러그인 분기(`if (path.startsWith("/api/plugin/")) { ... }`) **바로 아래**에 공개 분기를 추가:

```ts
  // 공개 표면: 프리플라이트는 즉시 응답하고, 그 외 GET에는 CORS 헤더만 달아 통과시킨다.
  // 인증·쿠키 세션 처리는 적용하지 않는다(무인증 읽기전용).
  if (path.startsWith("/api/public/")) {
    if (request.method === "OPTIONS") {
      return new NextResponse(null, { status: 204, headers: PUBLIC_CORS });
    }
    const response = NextResponse.next({ request });
    for (const [key, value] of Object.entries(PUBLIC_CORS)) response.headers.set(key, value);
    return response;
  }
```

- [ ] **Step 4: 타입체크 + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 신규 에러 없음(기존 무관 실패는 무시).

- [ ] **Step 5: 수동 E2E (로컬)**

dev 서버를 띄우고 curl로 확인한다(노출 ON 시안이 최소 1건 있어야 함 — 없으면 스튜디오 설정에서 토글 ON).

```bash
npm run dev   # 별도 터미널
# 목록
curl -s "http://localhost:3000/api/public/proposals?page=1&pageSize=5" | head -c 800
# 상세(목록에서 얻은 publicId로)
curl -s "http://localhost:3000/api/public/proposals/<publicId>" | head -c 800
# 비노출/없는 id → 404
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/public/proposals/does-not-exist"
# CORS 프리플라이트
curl -s -i -X OPTIONS "http://localhost:3000/api/public/proposals" | grep -i "access-control"
```

Expected:
- 목록: `{ "items": [...], "total": N, "page": 1, "pageSize": 5 }`, 각 item에 `cover`/`tags`/`createdAt`(ISO).
- 상세: `variants[].version`/`pages`가 sortOrder/pageOrder대로.
- 없는 id: `404`.
- OPTIONS: `Access-Control-Allow-Origin: *` 헤더 존재.
- 노출 OFF 시안은 목록·상세에 안 나옴.

- [ ] **Step 6: 커밋**

```bash
git add app/api/public/proposals/route.ts "app/api/public/proposals/[publicId]/route.ts" proxy.ts
git commit -m "feat(public-api): /api/public/proposals 라우트 + CORS 분기"
```

---

### Task 6: 외부 연동 문서

**Files:**
- Create: `docs/uxisworks-public-api.md`

- [ ] **Step 1: 문서 작성**

`docs/uxisworks-public-api.md` (기존 `docs/figma-plugin-api.md` 스타일):

````markdown
# 유시스웍스 공개 API (`/api/public/*`)

유시스웍스(포트폴리오/갤러리)가 cova의 **노출 처리된 시안** 정보를 읽어가는 무인증 읽기전용 API.
웹 앱 내부 `/api/*`(쿠키 세션·에디터 인가)와 분리된 네임스페이스다.

## 공통 규칙

- Base URL: `https://<cova-host>`
- 인증: **없음**. `시안 설정 > 유시스웍스 노출` 토글이 ON인 시안만 반환한다(공개 뷰어 링크
  visibility와는 무관한 별개 축).
- 메서드: `GET`만. CORS는 모든 Origin 허용(`*`).
- 응답 본문: `application/json`
- 에러: `{ "error": "CODE" }` — 주요 코드 `NOT_FOUND`(404, 비노출/부재).
- 식별자: 외부용 `publicId`(필수)·`domain`(슬러그, nullable)만 노출. 내부 UUID는 응답에 없다.
- 이미지: `proposals` public 버킷의 영구 URL. `width`/`height`는 원본 픽셀.

## 1. 목록

### `GET /api/public/proposals?page=1&pageSize=20`

- `page` 기본 1(최소 1), `pageSize` 기본 20(1~100 클램프).
- 정렬: 작성일 desc.
- 각 행 `cover` = 이미지가 있는 첫 안(sortOrder 순)의 최종버전 첫 페이지. 없으면 `null`.

응답 `200`:
```json
{
  "items": [
    {
      "publicId": "abc123",
      "domain": "main-renewal",
      "title": "메인 리뉴얼",
      "createdAt": "2026-06-20T08:00:00.000Z",
      "cover": { "url": "https://.../public/proposals/...", "width": 1440, "height": 3200 },
      "tags": [
        { "group": "industry", "groupLabel": "산업", "code": "fintech", "label": "핀테크" }
      ]
    }
  ],
  "total": 12,
  "page": 1,
  "pageSize": 20
}
```

## 2. 상세

### `GET /api/public/proposals/{publicId}`

각 안(variant)의 **최종버전** 이미지를 안별로 그룹화해 반환한다.

응답 `200`:
```json
{
  "publicId": "abc123",
  "domain": "main-renewal",
  "title": "메인 리뉴얼",
  "createdAt": "2026-06-20T08:00:00.000Z",
  "tags": [
    { "group": "industry", "groupLabel": "산업", "code": "fintech", "label": "핀테크" }
  ],
  "variants": [
    {
      "slug": "a",
      "label": "A",
      "version": { "versionNo": 3, "note": null },
      "pages": [
        { "url": "https://.../public/proposals/...", "width": 1440, "height": 3200 }
      ]
    }
  ]
}
```

- `variants`는 sortOrder 순, `pages`는 표시 순서(pageOrder).
- 최종버전이 없는 빈 안: `version: null`, `pages: []`.
- 비노출/없는 `publicId` → `404 { "error": "NOT_FOUND" }`.

## 엔드포인트 요약

| 시나리오 | 메서드 · 경로 |
|---|---|
| 노출 시안 목록 | `GET /api/public/proposals` |
| 노출 시안 상세 | `GET /api/public/proposals/{publicId}` |
````

- [ ] **Step 2: 커밋**

```bash
git add docs/uxisworks-public-api.md
git commit -m "docs(public-api): 유시스웍스 공개 API 연동 문서"
```

---

## Self-Review 결과

- **Spec coverage:** 네임스페이스/proxy CORS(Task 5) · 목록(Task 3) · 상세(Task 4) · 태그(Task 2) · 타입(Task 1) · 문서(Task 6) · 비범위(인증/참여자·figmaUrl/UUID 미노출은 코드에서 해당 필드를 아예 select·노출하지 않음으로 충족). 전 섹션 매핑됨.
- **Placeholder scan:** 없음(모든 step에 실제 코드/명령/기대값 포함). Task 1 Step 3의 `Infinity` 기대값은 주에서 page:1/pageSize:20으로 명시 정정.
- **Type consistency:** `PublicTag`(tag entity) → `PublicProposalSummary`/`PublicProposalDetail`(proposal entity)·`groupPublicTags`/`getPublicTagsByProposal` 일관. `clampListParams` 반환 `{page,pageSize}`를 Task 3가 그대로 소비. `PublicPage` 필드(url/width/height)는 cover·pages 양쪽 동일. `getPublicProposal`의 NOT_FOUND는 기존 `toErrorResponse` 매핑(404)과 일치.
