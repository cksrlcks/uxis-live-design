# 화이트보드 쓰기 부담 절감 (로그인 + 사용자별 레이어) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 화이트보드를 다시 활성화하되, 저장 단위를 "획 1개=row 1개"에서 "(사용자×페이지) 레이어=row 1개"로 바꾸고 debounce 플러시 + 로그인 강제 + 본인 획만 지우기로 DB 쓰기 부담을 없앤다.

**Architecture:** DB 영속 계층만 레이어 단위로 바꾸고(획들을 `strokes` jsonb 배열에 묶음), 실시간 broadcast·SVG 렌더는 획 단위로 그대로 유지한다. 클라는 react-query 캐시에 평탄화된 `StrokeDTO[]`를 들고, "내 획"을 페이지별로 묶어 ~1.5s debounce(+ 탭 숨김 시 즉시) PUT 한다. 드로잉은 로그인 필수(핀 패턴 복제), 지우개는 본인 획만 대상.

**Tech Stack:** Next.js(BFF route handlers), Drizzle ORM(Postgres/Supabase), @tanstack/react-query, Supabase Realtime broadcast, zod, Vitest.

**상위 스펙:** `docs/superpowers/specs/2026-06-23-whiteboard-write-burden-design.md`

## Global Constraints

- 모든 쓰기/읽기는 BFF에서 `resolveViewerGate(publicId)` 게이트를 **먼저** 통과(`proposal` 없으면 `NOT_FOUND`, `decision !== "allow"`면 `FORBIDDEN`).
- 쓰기(PUT)는 `getProfile()` 세션 필수 — 없으면 `throw new Error("LOGIN_REQUIRED")`(이미 401 매핑됨).
- `author_id`/`author_name`은 **항상 서버 세션**에서 취득(위조 불가). `author_color`만 클라 페이로드.
- 테이블명은 `whiteboard_strokes` 유지(의미만 "획"→"레이어"). RLS `ENABLE` + `FORCE`(정책 없음=deny) 유지.
- 커밋마다 `npx tsc --noEmit` + `npx vitest run` 게이트 통과.
- 한국어 주석/카피 유지(기존 코드 톤).
- 작업 브랜치: `feat/whiteboard-layers`(master 기준). 완료 후 master ff-merge.

---

## File Structure

- `drizzle/schema.ts` — `whiteboardStrokes` 테이블을 레이어 형태로 재정의(컬럼·unique·index).
- `drizzle/migrations/0010_whiteboard_layers.sql` — 기존 테이블 DROP 후 레이어 테이블 CREATE + FK + RLS(신규, 수기 작성).
- `drizzle/migrations/meta/_journal.json` — 0010 엔트리 추가.
- `src/entities/whiteboard/model/types.ts` — `StrokeDTO`(authorId non-null), `StoredStroke` 추가, `WhiteboardContext.viewerId` 추가.
- `src/entities/whiteboard/model/stroke-schema.ts` — 입력 스키마를 레이어 upsert(`strokeInputSchema`/`layerUpsertInputSchema`)로 교체.
- `src/entities/whiteboard/api/flatten.ts` — 레이어 row → `StrokeDTO[]` 순수 평탄화(신규, 테스트 대상).
- `src/entities/whiteboard/api/get-strokes.server.ts` — 레이어 row 조회 후 평탄화.
- `src/entities/whiteboard/index.ts` — 배럴 export 갱신.
- `src/features/whiteboard/api/upsert-layer.server.ts` — 내 레이어 upsert(신규, create/delete 대체).
- `src/features/whiteboard/api/create-stroke.server.ts`, `delete-stroke.server.ts` — 삭제.
- `src/features/whiteboard/api/use-stroke-mutations.ts` — `useLayerFlush(publicId)`로 교체.
- `src/features/whiteboard/index.ts` — 배럴 export 갱신.
- `app/api/p/[publicId]/strokes/route.ts` — GET 유지 + POST→PUT.
- `app/api/p/[publicId]/strokes/[strokeId]/route.ts` — 삭제(폴더째).
- `src/widgets/preview-canvas/ui/whiteboard-layer.tsx` — 레이어 flush(debounce/pagehide) + 본인만 지우기 + 로그인 게이팅.
- `src/widgets/preview-canvas/ui/canvas-view.tsx` — `WHITEBOARD_ENABLED=true` + `viewerId` 전달.
- `tests/whiteboard/flatten.test.ts`, `tests/whiteboard/schema.test.ts` — 순수 단위 테스트(신규).

---

### Task 1: DB 스키마 + 마이그레이션 (레이어 모델)

**Files:**
- Modify: `drizzle/schema.ts:108-129`
- Create: `drizzle/migrations/0010_whiteboard_layers.sql`
- Modify: `drizzle/migrations/meta/_journal.json`

**Interfaces:**
- Produces: 테이블 `whiteboard_strokes`(레이어), Drizzle 객체 `whiteboardStrokes`(컬럼: `id, proposalId, variantId, versionId, pageOrder, authorId, authorName, authorColor, strokes, updatedAt`), 타입 `WhiteboardStroke`.

> **주의(마이그레이션):** `npm run db:generate`는 `points→strokes`·`created_at→updated_at` 같은 동일 타입 컬럼 교체를 "rename?"으로 **대화형 질문**해 비대화형 실행 시 멈춘다. 라이브 데이터가 0건이므로 마이그레이션 SQL과 journal 엔트리를 **수기로 작성**한다(아래 그대로). meta 스냅샷은 재생성하지 않는다 — 추후 누군가 `db:generate`를 돌리면 스냅샷 동기화 보정 마이그레이션이 한 번 생길 수 있으나, 이 마이그레이션(DROP+CREATE)의 적용에는 영향 없다.

- [ ] **Step 1: `drizzle/schema.ts`의 `whiteboardStrokes` 블록 교체**

`drizzle/schema.ts:108-129`(주석 포함 `// 버전 종속 화이트보드 스트로크...`부터 `export type WhiteboardStroke ...`까지)를 아래로 교체:

```ts
// 버전 종속 화이트보드 — 한 사용자가 한 페이지에 그린 획들을 한 row(strokes 배열)로 묶는다.
// pin_comments와 동일 스코프 체계. 로그인 사용자만 그릴 수 있어 author_id는 NOT NULL.
// strokes: { drawId, points:[{x,y}], color, width }[] (정규화 경로). 쓰기는 (author_id, variant,
// version, page_order) 유니크로 upsert → 사용자별 페이지 레이어가 정확히 한 row.
export const whiteboardStrokes = pgTable("whiteboard_strokes", {
  id: uuid("id").primaryKey().defaultRandom(),
  proposalId: uuid("proposal_id").notNull(),     // FK via SQL
  variantId: uuid("variant_id").notNull(),       // FK via SQL
  versionId: uuid("version_id").notNull(),       // FK via SQL
  pageOrder: integer("page_order").notNull(),
  authorId: uuid("author_id").notNull(),         // FK via SQL — 소유권·레이어 키(로그인 강제)
  authorName: text("author_name").notNull(),
  authorColor: text("author_color").notNull(),
  strokes: jsonb("strokes").notNull(),           // StoredStroke[]
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("whiteboard_strokes_author_page_uq").on(t.authorId, t.variantId, t.versionId, t.pageOrder),
  index("whiteboard_strokes_variant_version_page_idx").on(t.variantId, t.versionId, t.pageOrder),
]);

export type WhiteboardStroke = typeof whiteboardStrokes.$inferSelect;
```

(`unique`·`jsonb`·`integer`·`real`은 `drizzle/schema.ts:1`에서 이미 import됨. `real`은 더 안 쓰여도 다른 테이블에서 사용 중이라 그대로 둔다.)

- [ ] **Step 2: 마이그레이션 SQL 작성**

`drizzle/migrations/0010_whiteboard_layers.sql` 신규 작성:

```sql
DROP TABLE IF EXISTS "whiteboard_strokes" CASCADE;
--> statement-breakpoint
CREATE TABLE "whiteboard_strokes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"page_order" integer NOT NULL,
	"author_id" uuid NOT NULL,
	"author_name" text NOT NULL,
	"author_color" text NOT NULL,
	"strokes" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "whiteboard_strokes_author_page_uq" UNIQUE("author_id","variant_id","version_id","page_order")
);
--> statement-breakpoint
ALTER TABLE "whiteboard_strokes" ADD CONSTRAINT "whiteboard_strokes_proposal_id_proposals_fk" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "whiteboard_strokes" ADD CONSTRAINT "whiteboard_strokes_variant_id_variants_fk" FOREIGN KEY ("variant_id") REFERENCES "proposal_variants"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "whiteboard_strokes" ADD CONSTRAINT "whiteboard_strokes_version_id_versions_fk" FOREIGN KEY ("version_id") REFERENCES "proposal_versions"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "whiteboard_strokes" ADD CONSTRAINT "whiteboard_strokes_author_id_profiles_fk" FOREIGN KEY ("author_id") REFERENCES "profiles"("id") ON DELETE cascade;
--> statement-breakpoint
CREATE INDEX "whiteboard_strokes_variant_version_page_idx" ON "whiteboard_strokes" ("variant_id","version_id","page_order");
--> statement-breakpoint
ALTER TABLE "whiteboard_strokes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "whiteboard_strokes" FORCE ROW LEVEL SECURITY;
```

- [ ] **Step 3: journal에 0010 엔트리 추가**

`drizzle/migrations/meta/_journal.json`의 `entries` 배열 끝(0009 엔트리 뒤)에 추가:

```json
    {
      "idx": 10,
      "version": "7",
      "when": 1782400000000,
      "tag": "0010_whiteboard_layers",
      "breakpoints": true
    }
```

(0009 엔트리의 닫는 `}` 뒤에 `,`를 붙이고 위 객체를 넣는다.)

- [ ] **Step 4: 타입 체크**

Run: `npx tsc --noEmit`
Expected: PASS (schema.ts 변경이 컴파일됨). 이 시점엔 `get-strokes.server.ts`·`create-stroke.server.ts`가 옛 컬럼(`points` 등)을 참조해 **에러가 날 수 있다** — 그 에러는 Task 3/4에서 해소된다. 본 스텝에선 `drizzle/schema.ts` 자체에 에러가 없는지만 확인(에러 목록에 schema.ts가 없으면 OK).

- [ ] **Step 5: 커밋**

```bash
git add drizzle/schema.ts drizzle/migrations/0010_whiteboard_layers.sql drizzle/migrations/meta/_journal.json
git commit -m "feat(db): 화이트보드를 사용자별 페이지 레이어(strokes 배열)로 재정의"
```

(`db:migrate`는 라이브 DB 대상이라 수동 단계 — 마지막 검증에서 안내.)

---

### Task 2: 엔티티 타입 + 입력 스키마 (레이어 upsert)

**Files:**
- Modify: `src/entities/whiteboard/model/types.ts`
- Modify: `src/entities/whiteboard/model/stroke-schema.ts`
- Modify: `src/entities/whiteboard/index.ts`
- Test: `tests/whiteboard/schema.test.ts`

**Interfaces:**
- Consumes: 없음.
- Produces:
  - `StrokePoint = { x: number; y: number }`
  - `StoredStroke = { drawId: string; points: StrokePoint[]; color: string; width: number }`
  - `StrokeDTO`(렌더용, `authorId: string` non-null, `createdAt: string`)
  - `WhiteboardContext = { publicId, variantId, versionId, viewerId: string | null }`
  - `strokeInputSchema`, `layerUpsertInputSchema`(zod), `StrokeInput`, `LayerUpsertInput`(추론 타입)
  - 상수 `MAX_STROKE_POINTS = 2000`, `MAX_LAYER_STROKES = 500`

- [ ] **Step 1: 실패하는 스키마 테스트 작성**

`tests/whiteboard/schema.test.ts` 신규:

```ts
import { describe, expect, it } from "vitest";
import { layerUpsertInputSchema, MAX_LAYER_STROKES } from "@/entities/whiteboard";

const stroke = (drawId: string) => ({
  drawId,
  points: [
    { x: 0, y: 0 },
    { x: 0.5, y: 0.5 },
  ],
  color: "#ff0000",
  width: 0.004,
});

describe("layerUpsertInputSchema", () => {
  it("유효한 레이어 입력을 통과시킨다", () => {
    const parsed = layerUpsertInputSchema.parse({
      variantId: "v1",
      versionId: "ver1",
      pageOrder: 0,
      strokes: [stroke("d1"), stroke("d2")],
      authorColor: "#3b82f6",
    });
    expect(parsed.strokes).toHaveLength(2);
  });

  it("빈 strokes 배열을 허용한다(레이어 삭제 신호)", () => {
    expect(() =>
      layerUpsertInputSchema.parse({
        variantId: "v1",
        versionId: "ver1",
        pageOrder: 0,
        strokes: [],
        authorColor: "#3b82f6",
      }),
    ).not.toThrow();
  });

  it("점이 2개 미만인 획을 거부한다", () => {
    expect(() =>
      layerUpsertInputSchema.parse({
        variantId: "v1",
        versionId: "ver1",
        pageOrder: 0,
        strokes: [{ drawId: "d1", points: [{ x: 0, y: 0 }], color: "#000", width: 0.004 }],
        authorColor: "#3b82f6",
      }),
    ).toThrow();
  });

  it("레이어당 획 수 상한을 넘으면 거부한다", () => {
    const many = Array.from({ length: MAX_LAYER_STROKES + 1 }, (_, i) => stroke(`d${i}`));
    expect(() =>
      layerUpsertInputSchema.parse({
        variantId: "v1",
        versionId: "ver1",
        pageOrder: 0,
        strokes: many,
        authorColor: "#3b82f6",
      }),
    ).toThrow();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/whiteboard/schema.test.ts`
Expected: FAIL ("layerUpsertInputSchema" export 없음 / 모듈 해석 실패).

- [ ] **Step 3: `stroke-schema.ts` 교체**

`src/entities/whiteboard/model/stroke-schema.ts` 전체를 아래로 교체:

```ts
import { z } from "zod";

// 페이지 박스 기준 정규화 좌표. 시안 밖도 허용하므로 핀과 동일하게 ±10으로만 제한.
const pointSchema = z.object({
  x: z.number().finite().min(-10).max(10),
  y: z.number().finite().min(-10).max(10),
});

export const MAX_STROKE_POINTS = 2000;
// 레이어(한 사용자×페이지)에 쌓일 수 있는 획 수 상한 — jsonb 폭주 방지.
export const MAX_LAYER_STROKES = 500;

// 레이어에 저장/전송되는 한 획. drawId는 클라가 만든 안정 식별자(렌더 key·dedupe·실시간).
export const strokeInputSchema = z.object({
  drawId: z.string().trim().min(1).max(64),
  // 2점 미만은 선이 아니다. 폭주 방지를 위해 점 수 상한(긴 선은 클라에서 단순화).
  points: z.array(pointSchema).min(2).max(MAX_STROKE_POINTS),
  color: z.string().trim().min(1).max(32),
  width: z.number().finite().min(0).max(1),
});
export type StrokeInput = z.infer<typeof strokeInputSchema>;

// 클라 → 서버 PUT 본문: 한 사용자의 그 페이지 레이어 전체(idempotent 교체).
export const layerUpsertInputSchema = z.object({
  variantId: z.string().min(1),
  versionId: z.string().min(1),
  pageOrder: z.number().int().min(0),
  strokes: z.array(strokeInputSchema).max(MAX_LAYER_STROKES),
  authorColor: z.string().trim().min(1).max(32),
});
export type LayerUpsertInput = z.infer<typeof layerUpsertInputSchema>;
```

- [ ] **Step 4: `types.ts` 교체**

`src/entities/whiteboard/model/types.ts` 전체를 아래로 교체:

```ts
// 스트로크의 클라이언트/전송 표현(createdAt ISO 문자열 — RSC·broadcast·상태 동일 모양).
export type StrokePoint = { x: number; y: number };

// DB 레이어 row의 jsonb 배열 원소(저장되는 한 획).
export type StoredStroke = {
  drawId: string;
  points: StrokePoint[];
  color: string;
  width: number;
};

// 렌더/전송용 평탄화 획(레이어를 펼친 것). 로그인 필수라 authorId는 non-null.
export type StrokeDTO = {
  id: string; // = stroke.drawId
  variantId: string;
  versionId: string;
  pageOrder: number;
  points: StrokePoint[];
  color: string;
  width: number;
  authorId: string;
  authorName: string;
  authorColor: string;
  createdAt: string; // ISO 8601 — 레이어 updatedAt
};

// 캔버스 화이트보드 컨텍스트. viewerId=null이면 게스트(로그인 유도).
export type WhiteboardContext = {
  publicId: string;
  variantId: string;
  versionId: string;
  viewerId: string | null;
};
```

- [ ] **Step 5: `index.ts` 배럴 갱신**

`src/entities/whiteboard/index.ts` 전체를 아래로 교체:

```ts
export { strokeQueries } from "./api/stroke.query";
export type { StrokeDTO, StrokePoint, StoredStroke, WhiteboardContext } from "./model/types";
export {
  MAX_STROKE_POINTS,
  MAX_LAYER_STROKES,
  strokeInputSchema,
  layerUpsertInputSchema,
  type StrokeInput,
  type LayerUpsertInput,
} from "./model/stroke-schema";
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `npx vitest run tests/whiteboard/schema.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 7: 커밋**

```bash
git add src/entities/whiteboard/model/types.ts src/entities/whiteboard/model/stroke-schema.ts src/entities/whiteboard/index.ts tests/whiteboard/schema.test.ts
git commit -m "feat(whiteboard): 레이어 upsert 입력 스키마·타입(StoredStroke/WhiteboardContext.viewerId)"
```

---

### Task 3: 레이어 평탄화 + get-strokes 조회

**Files:**
- Create: `src/entities/whiteboard/api/flatten.ts`
- Modify: `src/entities/whiteboard/api/get-strokes.server.ts`
- Test: `tests/whiteboard/flatten.test.ts`

**Interfaces:**
- Consumes: `StrokeDTO`, `StoredStroke`(Task 2).
- Produces: `flattenLayers(rows: LayerRow[]): StrokeDTO[]`, `type LayerRow = { variantId, versionId, pageOrder, authorId, authorName, authorColor, strokes: StoredStroke[], updatedAt: Date }`.

- [ ] **Step 1: 실패하는 평탄화 테스트 작성**

`tests/whiteboard/flatten.test.ts` 신규:

```ts
import { describe, expect, it } from "vitest";
import { flattenLayers, type LayerRow } from "@/entities/whiteboard/api/flatten";

describe("flattenLayers", () => {
  it("각 획에 row의 작성자 신원과 updatedAt(ISO)을 부여한다", () => {
    const rows: LayerRow[] = [
      {
        variantId: "v1",
        versionId: "ver1",
        pageOrder: 0,
        authorId: "u1",
        authorName: "Kim",
        authorColor: "#111",
        strokes: [
          { drawId: "d1", points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], color: "#f00", width: 0.004 },
          { drawId: "d2", points: [{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }], color: "#00f", width: 0.002 },
        ],
        updatedAt: new Date("2026-06-23T00:00:00.000Z"),
      },
    ];
    const out = flattenLayers(rows);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      id: "d1",
      authorId: "u1",
      authorName: "Kim",
      authorColor: "#111",
      pageOrder: 0,
      color: "#f00",
      createdAt: "2026-06-23T00:00:00.000Z",
    });
    expect(out[1]).toMatchObject({ id: "d2", color: "#00f", width: 0.002 });
  });

  it("빈 레이어는 건너뛰고 여러 row를 합친다", () => {
    const rows: LayerRow[] = [
      {
        variantId: "v1", versionId: "ver1", pageOrder: 0,
        authorId: "u1", authorName: "A", authorColor: "#1",
        strokes: [],
        updatedAt: new Date(0),
      },
      {
        variantId: "v1", versionId: "ver1", pageOrder: 1,
        authorId: "u2", authorName: "B", authorColor: "#2",
        strokes: [{ drawId: "x", points: [{ x: 0, y: 0 }, { x: 1, y: 0 }], color: "#000", width: 0.004 }],
        updatedAt: new Date(0),
      },
    ];
    const out = flattenLayers(rows);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: "x", authorId: "u2", pageOrder: 1 });
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/whiteboard/flatten.test.ts`
Expected: FAIL (`flatten` 모듈 없음).

- [ ] **Step 3: `flatten.ts` 작성**

`src/entities/whiteboard/api/flatten.ts` 신규:

```ts
import type { StrokeDTO, StoredStroke } from "../model/types";

// DB 레이어 row의 평탄화 입력 형태(서버 조회 결과를 이 모양으로 맞춰 넘긴다).
export type LayerRow = {
  variantId: string;
  versionId: string;
  pageOrder: number;
  authorId: string;
  authorName: string;
  authorColor: string;
  strokes: StoredStroke[];
  updatedAt: Date;
};

// 레이어 row들을 렌더용 획 단위(StrokeDTO[])로 펼친다. 각 획에 row의 작성자 신원·updatedAt 부여.
export function flattenLayers(rows: LayerRow[]): StrokeDTO[] {
  const out: StrokeDTO[] = [];
  for (const row of rows) {
    const createdAt = row.updatedAt.toISOString();
    for (const s of row.strokes) {
      out.push({
        id: s.drawId,
        variantId: row.variantId,
        versionId: row.versionId,
        pageOrder: row.pageOrder,
        points: s.points,
        color: s.color,
        width: s.width,
        authorId: row.authorId,
        authorName: row.authorName,
        authorColor: row.authorColor,
        createdAt,
      });
    }
  }
  return out;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/whiteboard/flatten.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: `get-strokes.server.ts` 교체**

`src/entities/whiteboard/api/get-strokes.server.ts` 전체를 아래로 교체:

```ts
import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { whiteboardStrokes, proposalVariants, proposalVersions } from "@drizzle/schema";
import { resolveViewerGate } from "@/shared/access/resolve-viewer-gate.server";
import type { StrokeDTO, StoredStroke } from "../model/types";
import { flattenLayers, type LayerRow } from "./flatten";

export async function getStrokes(
  publicId: string,
  variantId: string,
  versionId: string,
): Promise<StrokeDTO[]> {
  // Gate FIRST (legacy ordering — never validate/query before the access check).
  const { proposal, decision } = await resolveViewerGate(publicId);
  if (!proposal) throw new Error("NOT_FOUND");
  if (decision !== "allow") throw new Error("FORBIDDEN");
  if (!variantId || !versionId) throw new Error("BAD_QUERY");

  // membership: variant ∈ proposal, version ∈ variant
  const v = await db
    .select({ id: proposalVariants.id })
    .from(proposalVariants)
    .where(and(eq(proposalVariants.id, variantId), eq(proposalVariants.proposalId, proposal.id)))
    .limit(1);
  if (v.length === 0) throw new Error("NOT_FOUND");
  const ver = await db
    .select({ id: proposalVersions.id })
    .from(proposalVersions)
    .where(and(eq(proposalVersions.id, versionId), eq(proposalVersions.variantId, variantId)))
    .limit(1);
  if (ver.length === 0) throw new Error("NOT_FOUND");

  const rows = await db
    .select()
    .from(whiteboardStrokes)
    .where(and(eq(whiteboardStrokes.variantId, variantId), eq(whiteboardStrokes.versionId, versionId)))
    .orderBy(asc(whiteboardStrokes.updatedAt), asc(whiteboardStrokes.id));

  const layers: LayerRow[] = rows.map((r) => ({
    variantId: r.variantId,
    versionId: r.versionId,
    pageOrder: r.pageOrder,
    authorId: r.authorId,
    authorName: r.authorName,
    authorColor: r.authorColor,
    strokes: r.strokes as StoredStroke[],
    updatedAt: r.updatedAt,
  }));
  return flattenLayers(layers);
}
```

- [ ] **Step 6: 커밋**

```bash
git add src/entities/whiteboard/api/flatten.ts src/entities/whiteboard/api/get-strokes.server.ts tests/whiteboard/flatten.test.ts
git commit -m "feat(whiteboard): 레이어 row→획 평탄화 조회(get-strokes)"
```

---

### Task 4: 서버 upsert-layer (create/delete 대체)

**Files:**
- Create: `src/features/whiteboard/api/upsert-layer.server.ts`
- Delete: `src/features/whiteboard/api/create-stroke.server.ts`
- Delete: `src/features/whiteboard/api/delete-stroke.server.ts`

**Interfaces:**
- Consumes: `layerUpsertInputSchema`(Task 2), `whiteboardStrokes`(Task 1), `resolveViewerGate`, `getProfile`.
- Produces: `upsertLayer(publicId: string, raw: unknown): Promise<{ ok: true }>`.

- [ ] **Step 1: `upsert-layer.server.ts` 작성**

`src/features/whiteboard/api/upsert-layer.server.ts` 신규:

```ts
import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { whiteboardStrokes, proposalVariants, proposalVersions, proposalPages } from "@drizzle/schema";
import { resolveViewerGate } from "@/shared/access/resolve-viewer-gate.server";
import { getProfile } from "@/shared/auth/guards.server";
import { layerUpsertInputSchema } from "@/entities/whiteboard";

// 내 레이어(한 사용자×페이지의 획 전체)를 idempotent upsert. 로그인 필수 + 본인 row만.
// strokes가 비면 내 레이어 삭제. author_id/author_name은 세션에서만(위조 불가).
export async function upsertLayer(publicId: string, raw: unknown): Promise<{ ok: true }> {
  const { proposal, decision } = await resolveViewerGate(publicId);
  if (!proposal) throw new Error("NOT_FOUND");
  if (decision !== "allow") throw new Error("FORBIDDEN");
  const profile = await getProfile();
  if (!profile) throw new Error("LOGIN_REQUIRED");

  const { variantId, versionId, pageOrder, strokes, authorColor } =
    layerUpsertInputSchema.parse(raw);

  const v = await db
    .select({ id: proposalVariants.id })
    .from(proposalVariants)
    .where(and(eq(proposalVariants.id, variantId), eq(proposalVariants.proposalId, proposal.id)))
    .limit(1);
  if (v.length === 0) throw new Error("NOT_FOUND");
  const ver = await db
    .select({ id: proposalVersions.id })
    .from(proposalVersions)
    .where(and(eq(proposalVersions.id, versionId), eq(proposalVersions.variantId, variantId)))
    .limit(1);
  if (ver.length === 0) throw new Error("NOT_FOUND");
  const pg = await db
    .select({ id: proposalPages.id })
    .from(proposalPages)
    .where(and(eq(proposalPages.versionId, versionId), eq(proposalPages.pageOrder, pageOrder)))
    .limit(1);
  if (pg.length === 0) throw new Error("BAD_PAGE");

  const authorName = profile.displayName ?? profile.email.split("@")[0] ?? "사용자";

  // 빈 배열 = 내 레이어 삭제(소유권 키로만 한정 → 남의 레이어 못 건드림).
  if (strokes.length === 0) {
    await db
      .delete(whiteboardStrokes)
      .where(
        and(
          eq(whiteboardStrokes.authorId, profile.id),
          eq(whiteboardStrokes.variantId, variantId),
          eq(whiteboardStrokes.versionId, versionId),
          eq(whiteboardStrokes.pageOrder, pageOrder),
        ),
      );
    return { ok: true };
  }

  const now = new Date();
  await db
    .insert(whiteboardStrokes)
    .values({
      proposalId: proposal.id,
      variantId,
      versionId,
      pageOrder,
      authorId: profile.id,
      authorName,
      authorColor,
      strokes,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        whiteboardStrokes.authorId,
        whiteboardStrokes.variantId,
        whiteboardStrokes.versionId,
        whiteboardStrokes.pageOrder,
      ],
      set: { strokes, authorName, authorColor, updatedAt: now },
    });
  return { ok: true };
}
```

- [ ] **Step 2: 옛 서버 파일 삭제**

```bash
git rm src/features/whiteboard/api/create-stroke.server.ts src/features/whiteboard/api/delete-stroke.server.ts
```

- [ ] **Step 3: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 남는 에러는 `app/api/.../strokes/route.ts`(아직 `createStroke` import)와 `use-stroke-mutations.ts`/`whiteboard-layer.tsx`(아직 옛 훅) 정도 — Task 5~7에서 해소. `upsert-layer.server.ts` 자체 에러 없음을 확인.

- [ ] **Step 4: 커밋**

```bash
git add src/features/whiteboard/api/upsert-layer.server.ts
git commit -m "feat(whiteboard): 서버 upsertLayer(로그인·소속 검증, 빈 배열=삭제)로 create/delete 대체"
```

---

### Task 5: BFF route (GET 유지 + POST→PUT, [strokeId] 제거)

**Files:**
- Modify: `app/api/p/[publicId]/strokes/route.ts`
- Delete: `app/api/p/[publicId]/strokes/[strokeId]/route.ts` (폴더째)

**Interfaces:**
- Consumes: `getStrokes`(Task 3), `upsertLayer`(Task 4).
- Produces: `GET /api/p/[publicId]/strokes?variant=&version=` → `{ strokes: StrokeDTO[] }`; `PUT /api/p/[publicId]/strokes` → `{ ok: true }`.

- [ ] **Step 1: route.ts 교체**

`app/api/p/[publicId]/strokes/route.ts` 전체를 아래로 교체:

```ts
import { getStrokes } from "@/entities/whiteboard/api/get-strokes.server";
import { toErrorResponse } from "@/shared/api/to-error-response";
import { upsertLayer } from "@/features/whiteboard/api/upsert-layer.server";

export async function GET(req: Request, { params }: { params: Promise<{ publicId: string }> }) {
  try {
    const { publicId } = await params;
    const url = new URL(req.url);
    const variantId = url.searchParams.get("variant") ?? "";
    const versionId = url.searchParams.get("version") ?? "";
    return Response.json({ strokes: await getStrokes(publicId, variantId, versionId) });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ publicId: string }> }) {
  try {
    const { publicId } = await params;
    const raw = await req.json().catch(() => null);
    return Response.json(await upsertLayer(publicId, raw));
  } catch (error) {
    return toErrorResponse(error);
  }
}
```

- [ ] **Step 2: [strokeId] 라우트 삭제**

```bash
git rm app/api/p/[publicId]/strokes/[strokeId]/route.ts
```

(폴더 `app/api/p/[publicId]/strokes/[strokeId]/`가 비면 함께 정리된다.)

- [ ] **Step 3: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 남는 에러는 `use-stroke-mutations.ts`/`whiteboard-layer.tsx`/`features/whiteboard/index.ts`(옛 훅)와 `canvas-view.tsx`(WhiteboardContext에 viewerId 없음) — Task 6~8에서 해소. route.ts 자체 에러 없음 확인.

- [ ] **Step 4: 커밋**

```bash
git add app/api/p/[publicId]/strokes/route.ts
git commit -m "feat(whiteboard): BFF를 GET+PUT(레이어 upsert)로 — POST/DELETE 라우트 제거"
```

---

### Task 6: 클라 flush 훅 (useLayerFlush)

**Files:**
- Modify: `src/features/whiteboard/api/use-stroke-mutations.ts`
- Modify: `src/features/whiteboard/index.ts`

**Interfaces:**
- Consumes: `LayerUpsertInput`(Task 2), `http`.
- Produces: `useLayerFlush(publicId: string)` → react-query mutation, `mutate(input: LayerUpsertInput)` / `mutateAsync`.

- [ ] **Step 1: use-stroke-mutations.ts 교체**

`src/features/whiteboard/api/use-stroke-mutations.ts` 전체를 아래로 교체:

```ts
import { useMutation } from "@tanstack/react-query";
import { http } from "@/shared/api/http";
import { type LayerUpsertInput } from "@/entities/whiteboard";

// 내 레이어(한 페이지의 내 획 전체)를 idempotent PUT으로 영속화.
// keepalive: 탭 종료(pagehide) 직전 호출도 전송이 보장되도록(소량 페이로드).
export function useLayerFlush(publicId: string) {
  return useMutation({
    mutationFn: (input: LayerUpsertInput) =>
      http<{ ok: true }>(`/api/p/${publicId}/strokes`, {
        method: "PUT",
        body: JSON.stringify(input),
        keepalive: true,
      }),
  });
}
```

- [ ] **Step 2: 배럴 갱신**

`src/features/whiteboard/index.ts` 전체를 아래로 교체:

```ts
export { useLayerFlush } from "./api/use-stroke-mutations";
```

- [ ] **Step 3: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 남는 에러는 `whiteboard-layer.tsx`(옛 훅·viewerId)와 `canvas-view.tsx` — Task 7~8. 본 파일들 자체 에러 없음 확인.

- [ ] **Step 4: 커밋**

```bash
git add src/features/whiteboard/api/use-stroke-mutations.ts src/features/whiteboard/index.ts
git commit -m "feat(whiteboard): useLayerFlush(레이어 PUT, keepalive)로 create/delete 훅 대체"
```

---

### Task 7a: whiteboard-layer — 레이어 debounce flush + 본인만 지우기

**Files:**
- Modify: `src/widgets/preview-canvas/ui/whiteboard-layer.tsx`

**Interfaces:**
- Consumes: `useLayerFlush`(Task 6), `WhiteboardContext.viewerId`(Task 2), `StrokeDTO`(authorId non-null).
- Produces: 컴포넌트 내부 동작만(외부 시그니처 불변, 단 `ctx`에 `viewerId` 필요 — Task 8에서 주입).

> 이 Task는 "획마다 즉시 INSERT/DELETE"를 "내 레이어를 페이지별 debounce PUT"으로 바꾼다. 단위 테스트는 DOM/실시간 의존이 커 어렵다 — `tsc` + Task 마지막의 2탭 수동 검증으로 확인한다(기존 화이트보드도 동일하게 lib만 단위 테스트).

- [ ] **Step 1: import 교체**

`src/widgets/preview-canvas/ui/whiteboard-layer.tsx:16`
```ts
import { useCreateStroke, useDeleteStroke } from "@/features/whiteboard";
```
를
```ts
import { useLayerFlush } from "@/features/whiteboard";
```
로 교체. (이 Task에선 `CreateStrokeInput` 사용처도 사라지므로) `:10-15`의 import 묶음에서 `type CreateStrokeInput,` 줄을 제거:
```ts
import {
  strokeQueries,
  type StrokeDTO,
  type WhiteboardContext,
} from "@/entities/whiteboard";
```

- [ ] **Step 2: ctx 구조분해 + flush·debounce 상태 추가**

`whiteboard-layer.tsx:77-82`의
```ts
  const { publicId, variantId, versionId } = ctx;
  const rt = useRealtimeOptional();
  const qc = useQueryClient();
  const { data: strokes = [] } = useQuery(strokeQueries.list(publicId, variantId, versionId));
  const createMut = useCreateStroke(publicId, variantId, versionId);
  const deleteMut = useDeleteStroke(publicId, variantId, versionId);
```
를 아래로 교체:
```ts
  const { publicId, variantId, versionId, viewerId } = ctx;
  const rt = useRealtimeOptional();
  const qc = useQueryClient();
  const { data: strokes = [] } = useQuery(strokeQueries.list(publicId, variantId, versionId));
  const flush = useLayerFlush(publicId);

  // 그리기/지우기로 더러워진 페이지를 모아 debounce 후 내 레이어만 PUT(쓰기 빈도↓).
  const FLUSH_DELAY = 1500;
  const dirtyRef = useRef<Set<number>>(new Set());
  const flushTimerRef = useRef<number | null>(null);

  // 타이머/언로드 핸들러의 stale 클로저 방지 — 항상 최신 클로저로 한 페이지를 flush.
  const flushPageRef = useRef<(pageOrder: number) => void>(() => {});
  // eslint-disable-next-line react-hooks/refs -- intentional: keep latest closure for timers/unload handlers
  flushPageRef.current = (pageOrder: number) => {
    const key = strokeQueries.list(publicId, variantId, versionId).queryKey;
    const all = qc.getQueryData<StrokeDTO[]>(key) ?? [];
    const mine = all.filter((s) => s.authorId === viewerId && s.pageOrder === pageOrder);
    flush.mutate(
      {
        variantId,
        versionId,
        pageOrder,
        strokes: mine.map((s) => ({ drawId: s.id, points: s.points, color: s.color, width: s.width })),
        authorColor: rt?.myColor ?? "#3b82f6",
      },
      { onError: (e) => toast.error(e instanceof Error ? e.message : "그림 저장에 실패했습니다") },
    );
  };

  function flushAllDirty() {
    const pages = [...dirtyRef.current];
    dirtyRef.current.clear();
    if (flushTimerRef.current != null) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    for (const p of pages) flushPageRef.current(p);
  }

  function markDirty(pageOrder: number) {
    dirtyRef.current.add(pageOrder);
    if (flushTimerRef.current != null) clearTimeout(flushTimerRef.current);
    flushTimerRef.current = window.setTimeout(() => {
      flushTimerRef.current = null;
      flushAllDirty();
    }, FLUSH_DELAY);
  }
```

- [ ] **Step 3: 탭 숨김/언마운트 flush effect 추가**

`whiteboard-layer.tsx`의 기존 "언마운트 시 대기 중인 지우개 미리보기 rAF 정리" effect(`:114-118`) **바로 아래**에 추가:
```ts
  // 탭 숨김(visibilitychange/pagehide)·언마운트 시 더러운 페이지를 즉시 flush(닫기 직전 유실 방지).
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "hidden") flushAllDirty();
    };
    const onPageHide = () => flushAllDirty();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onPageHide);
      flushAllDirty();
    };
    // flushAllDirty는 안정 ref(dirty/timer/flushPage)만 읽으므로 빈 deps로 안전.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

- [ ] **Step 4: onPenUp 저장부 교체 (낙관적 추가 + broadcast + markDirty)**

`whiteboard-layer.tsx:298-341`을 교체한다 — `const points = pts.map(...)`(298)부터 `createMut.mutate(...)` 블록 끝과 **`onPenUp` 함수 닫는 `}`(341)까지 포함**. 아래 블록은 그 닫는 `}`를 포함하므로(끝줄 `  }`), 결과적으로 함수 경계가 정확히 한 번만 닫힌다:
```ts
    // 로그인 강제 — 게스트는 onPenDown 게이트에서 막히지만, 방어적으로 한 번 더 확인.
    if (viewerId == null) {
      setDrawing(null);
      rt?.broadcastDrawEnd(s.drawId);
      return;
    }
    const points = pts.map((p) => normPoint(p.x, p.y, box));
    const key = strokeQueries.list(publicId, variantId, versionId).queryKey;
    // 확정 획을 즉시 캐시에 넣고(로컬 선 제거), 피어에 broadcast. 영속화는 페이지 debounce flush.
    const stroke: StrokeDTO = {
      id: s.drawId,
      variantId,
      versionId,
      pageOrder: s.pageOrder,
      points,
      color: s.color,
      width: s.width,
      authorId: viewerId,
      authorName: rt?.myName ?? "사용자",
      authorColor: rt?.myColor ?? "#3b82f6",
      createdAt: "",
    };
    qc.setQueryData<StrokeDTO[]>(key, (prev) =>
      prev && prev.some((x) => x.id === stroke.id) ? prev : [...(prev ?? []), stroke],
    );
    setDrawing(null);
    rt?.broadcastStroke(stroke);
    rt?.broadcastDrawEnd(s.drawId);
    markDirty(s.pageOrder);
  }
```
(끝의 `}`는 `onPenUp` 함수 닫는 중괄호 — 기존 함수 경계를 유지하도록 교체 범위를 맞춘다.)

- [ ] **Step 5: commitErase 교체 (본인 획만 + markDirty, 즉시 I/O 제거)**

`whiteboard-layer.tsx:412-483` — `commitErase` 함수와 **그 위 주석 블록(412-413)까지 포함**해 아래로 교체(아래 블록이 새 주석을 포함하므로 옛 주석이 남지 않게 한다). 시그니처도 `async function` → `function`으로 바뀜에 주의:
```ts
  // 지우개 경로로 내 획만 잘라 캐시·피어에 즉시 반영하고, 영향 페이지를 debounce flush로 영속화.
  // 남의 획은 건드리지 않는다(본인만 지우기) → cross-user split·다건 쓰기 폭주 제거.
  function commitErase(eraser: { x: number; y: number }[]) {
    if (eraser.length === 0 || viewerId == null) return;
    const radius = eraserRadiusContent();
    const boxes = measureBoxes();
    const eBox = eraserBBox(eraser, radius);
    const key = strokeQueries.list(publicId, variantId, versionId).queryKey;
    const current = qc.getQueryData<StrokeDTO[]>(key) ?? [];

    const next: StrokeDTO[] = [];
    const removedIds: string[] = [];
    const addedStrokes: StrokeDTO[] = [];
    const dirtyPages = new Set<number>();

    for (const stroke of current) {
      // 남의 획·다른 페이지·안 겹치는 획은 그대로 둔다.
      if (stroke.authorId !== viewerId) {
        next.push(stroke);
        continue;
      }
      const box = boxes.find((b) => b.pageOrder === stroke.pageOrder);
      if (!box || !strokeIntersectsBBox(stroke.points, box, eBox)) {
        next.push(stroke);
        continue;
      }
      const segs = eraseStrokePoints(stroke.points, box, eraser, radius);
      if (segs.length === 1 && segs[0] === stroke.points) {
        next.push(stroke); // 미변경(참조 동일)
        continue;
      }
      // 변경됨: 원본 제거 + 살아남은 세그먼트(새 drawId) 추가.
      removedIds.push(stroke.id);
      dirtyPages.add(stroke.pageOrder);
      for (const seg of segs) {
        const seg2: StrokeDTO = { ...stroke, id: newDrawId(), points: seg, createdAt: "" };
        next.push(seg2);
        addedStrokes.push(seg2);
      }
    }
    if (removedIds.length === 0) return; // 아무것도 안 지워짐

    qc.setQueryData<StrokeDTO[]>(key, next); // 낙관적: 즉시 잘린 결과 반영
    removedIds.forEach((id) => rt?.broadcastStrokeDeleted(id)); // 실시간: 원본 제거
    addedStrokes.forEach((s) => rt?.broadcastStroke(s)); // 실시간: 세그먼트 추가
    dirtyPages.forEach((p) => markDirty(p)); // 영속화: 영향 페이지 debounce flush
  }
```

- [ ] **Step 6: onEraserUp의 `void commitErase(path)` → `commitErase(path)`**

`whiteboard-layer.tsx:409` `void commitErase(path);` 를 `commitErase(path);` 로 바꾼다(이제 동기 함수).

- [ ] **Step 7: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 남는 에러는 `canvas-view.tsx`(WhiteboardContext에 `viewerId` 미전달) 1곳 — Task 8에서 해소. `whiteboard-layer.tsx` 자체 에러 없음 확인.

- [ ] **Step 8: 커밋**

```bash
git add src/widgets/preview-canvas/ui/whiteboard-layer.tsx
git commit -m "feat(whiteboard): 레이어 debounce flush + 본인 획만 지우기(획별 즉시 쓰기 제거)"
```

---

### Task 7b: whiteboard-layer — 로그인 게이팅(게스트 유도 모달)

**Files:**
- Modify: `src/widgets/preview-canvas/ui/whiteboard-layer.tsx`

**Interfaces:**
- Consumes: `viewerId`(Task 7a에서 구조분해됨), `Dialog`/`Button` UI.
- Produces: 게스트가 펜/지우개로 그리려 하면 로그인 유도 모달(핀과 동일 UX).

- [ ] **Step 1: Dialog/Button import 추가**

`whiteboard-layer.tsx`의 import 구역(파일 상단, `import { cn } from "@/shared/lib/utils";` 아래)에 추가:
```ts
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
```

- [ ] **Step 2: 게스트 상태 추가**

Task 7a에서 추가한 flush 상태 부근(컴포넌트 본문 상단의 `const [tool, setTool] = useState<Tool>("pen");` 위)에 추가:
```ts
  const isGuest = viewerId == null;
  const [loginOpen, setLoginOpen] = useState(false);
```

- [ ] **Step 3: onPenDown 게이트**

`whiteboard-layer.tsx`의 `function onPenDown(e: React.PointerEvent) {` 본문 첫 줄(`if (spaceHeld || e.button !== 0) return;`) **다음**에 추가:
```ts
    if (isGuest) {
      setLoginOpen(true);
      return;
    }
```

- [ ] **Step 4: onEraserDown 게이트**

`function onEraserDown(e: React.PointerEvent) {`의 첫 줄(`if (spaceHeld || e.button !== 0) return;`) **다음**에 동일하게 추가:
```ts
    if (isGuest) {
      setLoginOpen(true);
      return;
    }
```

- [ ] **Step 5: 로그인 모달 렌더 추가**

`whiteboard-layer.tsx` 최상위 반환 JSX의 마지막 닫는 `</div>`(루트 `<div className="pointer-events-none absolute inset-0">`의 닫힘) **직전**에 추가:
```tsx
      <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
        <DialogContent className="pointer-events-auto gap-6 p-6">
          <DialogHeader className="gap-3">
            <DialogTitle>로그인이 필요합니다</DialogTitle>
            <DialogDescription>
              그림을 그리려면 로그인해 주세요.
              <br />
              로그인 후 현재 화면으로 돌아옵니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              onClick={() => {
                const returnTo =
                  typeof window !== "undefined"
                    ? window.location.pathname + window.location.search
                    : "/";
                window.location.href = `/login?returnTo=${encodeURIComponent(returnTo)}`;
              }}
            >
              로그인
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
```

- [ ] **Step 6: 타입 체크**

Run: `npx tsc --noEmit`
Expected: `canvas-view.tsx` 외 에러 없음(Task 8에서 해소).

- [ ] **Step 7: 커밋**

```bash
git add src/widgets/preview-canvas/ui/whiteboard-layer.tsx
git commit -m "feat(whiteboard): 게스트 드로잉 시 로그인 유도 모달(핀 패턴)"
```

---

### Task 8: 화이트보드 재노출 + viewerId 배선

**Files:**
- Modify: `src/widgets/preview-canvas/ui/canvas-view.tsx:21`, `:267-280`

**Interfaces:**
- Consumes: `pin.viewerId`(PinContext에 이미 존재), `WhiteboardLayer`(viewerId 필요).
- Produces: 화이트보드 UI 노출 + `WhiteboardContext.viewerId` 주입.

- [ ] **Step 1: 플래그 활성화**

`canvas-view.tsx:21`
```ts
const WHITEBOARD_ENABLED: boolean = false;
```
를
```ts
const WHITEBOARD_ENABLED: boolean = true;
```
로 바꾼다.

- [ ] **Step 2: ctx에 viewerId 주입**

`canvas-view.tsx:267-280`의 `<WhiteboardLayer ... ctx={{ ... }} ... />`에서 `ctx` 객체에 `viewerId`를 추가:
```tsx
            {WHITEBOARD_ENABLED && pin && (
              <WhiteboardLayer
                contentRef={contentRef}
                pages={pages}
                ctx={{
                  publicId: pin.publicId,
                  variantId: pin.variantId,
                  versionId: pin.versionId,
                  viewerId: pin.viewerId,
                }}
                mode={mode}
                spaceHeld={spaceHeld}
                visible={strokesVisible}
              />
            )}
```

- [ ] **Step 3: 전체 타입 체크 + 테스트**

Run: `npx tsc --noEmit`
Expected: PASS (에러 0).

Run: `npx vitest run`
Expected: PASS (whiteboard 신규 2파일 포함 전부 통과).

- [ ] **Step 4: 커밋**

```bash
git add src/widgets/preview-canvas/ui/canvas-view.tsx
git commit -m "feat(whiteboard): UI 재노출 + WhiteboardContext.viewerId 배선"
```

---

### Task 9: 마이그레이션 적용 + 수동 E2E 검증

**Files:** 없음(운영/검증 단계).

- [ ] **Step 1: 라이브 DB에 마이그레이션 적용**

Run: `npm run db:migrate`
Expected: `0010_whiteboard_layers` 적용 성공. (실패 시 `.env.local`의 DB URL/네트워크 확인. 라이브 데이터 0건이라 DROP+CREATE 안전.)

- [ ] **Step 2: 빌드/실행**

Run: `npm run dev` (또는 프로젝트의 실행 스크립트)
Expected: 컴파일 에러 없이 기동.

- [ ] **Step 3: 수동 검증 체크리스트(2탭 + 로그인/게스트)**

공개 시안 `/p/<publicId>` 캔버스에서:
- [ ] 로그인 사용자: 그리기 모드에서 펜으로 여러 획을 빠르게 그린다 → 화면에 즉시 보임.
- [ ] 네트워크 탭: 그리는 동안 `/strokes`로의 **PUT이 매 획이 아니라 멈춤 후 ~1.5s에 묶여서** 발생(획당 INSERT 아님).
- [ ] 두 번째 탭(다른 로그인 사용자): 첫 탭의 획이 실시간으로 나타남.
- [ ] 첫 탭 새로고침: 그린 획이 그대로 보존(레이어 GET 평탄화).
- [ ] 지우개로 내 획 일부를 문지른다 → 그 부분만 잘리고, **PUT 1건**으로 영속화.
- [ ] 남의 획 위에 지우개를 그어도 **안 지워짐**(본인만).
- [ ] 획을 그린 직후 탭을 닫았다가 다시 연다 → pagehide flush로 **보존**됨.
- [ ] 게스트(로그아웃 상태): 펜/지우개로 그리려 하면 **로그인 모달** → 로그인 후 같은 화면 복귀, 이후 그리기 가능.
- [ ] 게스트는 남이 그린 획을 **보기**는 됨.

- [ ] **Step 4: 검증 결과 기록 후 마무리**

문제 없으면 `superpowers:finishing-a-development-branch`로 master ff-merge 진행. 문제 있으면 해당 Task로 돌아가 수정.

---

## Self-Review

**1. Spec coverage** (스펙 각 절 → Task 매핑):
- §4 데이터 모델 → Task 1 ✓
- §5 쓰기 경로(debounce/pagehide/빈 배열 삭제) → Task 7a(클라) + Task 4(서버 빈 배열 삭제) ✓
- §6 실시간·렌더 불변 + 평탄화 → Task 3(평탄화), Task 7a(획 단위 broadcast 유지) ✓
- §7 로그인 유도 → Task 7b ✓
- §8 접근/권한(세션·소속) → Task 4 ✓
- §9 BFF API(GET/PUT, POST·DELETE 제거) → Task 5 ✓
- §10 마이그레이션 → Task 1 + Task 9 ✓
- §11 영향 파일 → 전 Task에 분산, 누락 없음 ✓
- §12 테스트(평탄화/스키마/erase 본인만) → Task 2·3 단위 테스트 + Task 9 수동(erase 본인만은 수동 검증) ✓
- §13 Done 기준 → Task 9 체크리스트가 1:1 대응 ✓

**2. Placeholder scan:** "TBD/TODO/적절히 처리" 없음. 모든 코드 스텝에 실제 코드 포함 ✓.

**3. Type consistency:**
- `StrokeDTO.authorId: string`(Task 2) — Task 3 평탄화·Task 7a 생성에서 모두 string 부여 ✓.
- `StoredStroke = { drawId, points, color, width }`(Task 2) — `flattenLayers`(Task 3)·`strokeInputSchema`(Task 2)·flush 페이로드(Task 7a) 동일 필드 ✓.
- `LayerUpsertInput`(Task 2) — `useLayerFlush`(Task 6)·`upsertLayer` parse(Task 4)·flush 호출(Task 7a) 동일 형태(`variantId, versionId, pageOrder, strokes, authorColor`) ✓.
- `WhiteboardContext.viewerId`(Task 2) — `canvas-view`(Task 8) 주입, `whiteboard-layer` 구조분해(Task 7a) ✓.
- `upsertLayer`/`getStrokes`/`useLayerFlush`/`flattenLayers` 시그니처가 호출부와 일치 ✓.

이슈 없음 — 진행 준비 완료.
