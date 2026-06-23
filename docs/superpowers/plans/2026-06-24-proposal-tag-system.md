# 시안 태그 시스템 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 시안 상세에 "시안태그관리" 탭을 추가해 작업자가 관리자-편집 가능한 분류 체계로 다중 태깅하고, 데이터는 독립 3 테이블에 적재한다.

**Architecture:** 공통코드 패턴의 관계형 3 테이블(`tag_groups`/`tag_options`/`proposal_tags`). 관리자는 `/studio/tags`에서 구분·항목을 CRUD하고, 작업자는 시안 상세 `?tab=tags`에서 그룹별 칩으로 선택 후 저장한다. 기존 `proposals` 테이블은 변경하지 않고 `proposal_tags`가 FK로만 연결한다.

**Tech Stack:** Next.js 16 (App Router, Route Handlers), React 19, Drizzle ORM + postgres(Supabase), `@tanstack/react-query` v5, `@base-ui/react`, Zod v4, Vitest(node env), nuqs.

## Global Constraints

- **FSD 레이어링:** `app → pages → widgets → features → entities → shared` 단방향. 상위 레이어를 import하지 않는다.
- **라우트 핸들러:** `app/api/**/route.ts`는 얇게 — `.server.ts` 함수에 위임하고 `try/catch` → `toErrorResponse(error)`. 성공 시 `Response.json(...)` 또는 `new Response(null, { status: 204 })`.
- **인증 가드:** 서버 함수 진입부에서 `requireEditor()` / `requireAdmin()` 호출(둘 다 실패 시 `throw new Error("FORBIDDEN")`). 페이지 가드는 `getProfile()` + `isAdmin()`/`isEditor()`.
- **서버 뮤테이션은 entities/<e>/api/*.server.ts**, 클라이언트 http 래퍼 + react-query 훅은 features/<f>/api/*. (manage-users 패턴과 동일.)
- **Drizzle 마이그레이션:** 손으로 작성한 SQL + `--> statement-breakpoint` 구분. FK/INDEX/RLS는 raw SQL. 새 테이블은 `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY` 추가. `drizzle/migrations/meta/_journal.json`에 엔트리 수동 append(`"version": "7"`, `"breakpoints": true`). **스냅샷(meta/*.json)은 재생성하지 않는다.** 동시에 `drizzle/schema.ts`도 갱신한다.
- **Zod v4 관용구:** `z.uuid()`, `z.email()` 사용(`z.string().uuid()`/`.email()`는 deprecated).
- **Base UI Button:** 기본 `type="button"`. 폼 제출 버튼만 `type="submit"`. (이 플랜의 다이얼로그 버튼은 onClick 핸들러 방식이라 모두 `type="button"`.)
- **react-query:** 엔티티별 query factory(`queryOptions`). 뮤테이션 성공 시 관련 리스트/쿼리 무효화.
- **UI 카피:** 한국어.
- **런타임:** Node ≥ 22.
- **커밋:** 태스크(또는 그 안의 의미 단위)마다 커밋. 메시지 컨벤션 `feat(tags): …` / `test(tags): …` / `chore(db): …`.

---

## File Structure

**DB / 스키마**
- Modify `drizzle/schema.ts` — `tagGroups`, `tagOptions`, `proposalTags` 테이블 + 타입
- Create `drizzle/migrations/0015_proposal_tags.sql` — 3 테이블 + FK(CASCADE) + unique + index + RLS
- Create `drizzle/migrations/0016_seed_tags.sql` — 6 구분 + 76 항목 시드(멱등)
- Modify `drizzle/migrations/meta/_journal.json` — 0015·0016 엔트리 append

**entities/tag** (읽기 쿼리 + 서버 뮤테이션 + 순수 로직)
- Create `src/entities/tag/model/types.ts` — DTO 타입
- Create `src/entities/tag/model/schemas.ts` — zod 스키마
- Create `src/entities/tag/lib/diff-selection.ts` — 선택집합 diff(순수)
- Create `src/entities/tag/api/get-taxonomy.server.ts` / `get-taxonomy.ts`
- Create `src/entities/tag/api/get-proposal-tags.server.ts` / `get-proposal-tags.ts`
- Create `src/entities/tag/api/put-proposal-tags.server.ts`
- Create `src/entities/tag/api/group-mutations.server.ts`
- Create `src/entities/tag/api/option-mutations.server.ts`
- Create `src/entities/tag/api/tag.query.ts`
- Create `src/entities/tag/index.ts`

**API 라우트**
- Create `app/api/tags/taxonomy/route.ts` (GET)
- Create `app/api/admin/tags/groups/route.ts` (POST)
- Create `app/api/admin/tags/groups/[id]/route.ts` (PATCH, DELETE)
- Create `app/api/admin/tags/options/route.ts` (POST)
- Create `app/api/admin/tags/options/[id]/route.ts` (PATCH, DELETE)
- Create `app/api/proposals/[id]/tags/route.ts` (GET, PUT)

**features/manage-tag-taxonomy** (관리자 CRUD)
- Create `src/features/manage-tag-taxonomy/api/manage-taxonomy.ts` (http 래퍼)
- Create `src/features/manage-tag-taxonomy/api/use-tag-taxonomy-mutations.ts` (훅)
- Create `src/features/manage-tag-taxonomy/ui/group-dialog.tsx`
- Create `src/features/manage-tag-taxonomy/ui/option-dialog.tsx`
- Create `src/features/manage-tag-taxonomy/ui/option-row.tsx`
- Create `src/features/manage-tag-taxonomy/ui/group-card.tsx`
- Create `src/features/manage-tag-taxonomy/ui/confirm-dialog.tsx`
- Create `src/features/manage-tag-taxonomy/index.ts`

**features/assign-proposal-tags** (작업자 태깅)
- Create `src/features/assign-proposal-tags/api/put-proposal-tags.ts` (http 래퍼)
- Create `src/features/assign-proposal-tags/api/use-save-proposal-tags.ts` (훅)
- Create `src/features/assign-proposal-tags/ui/proposal-tags-panel.tsx`
- Create `src/features/assign-proposal-tags/index.ts`

**pages / app**
- Create `src/pages/admin-tags/ui/admin-tags-page.tsx`
- Create `src/pages/admin-tags/index.ts`
- Create `app/studio/tags/page.tsx`
- Modify `src/widgets/studio-shell/model/nav-config.ts` — admin nav 항목
- Modify `src/pages/proposal-detail/ui/section-nav.tsx` — "tags" 탭
- Modify `src/pages/proposal-detail/ui/proposal-detail-page.tsx` — 탭 렌더

**tests**
- Create `tests/entities/tag/schema.test.ts`
- Create `tests/entities/tag/schemas.test.ts`
- Create `tests/entities/tag/diff-selection.test.ts`
- Modify `tests/widgets/studio-shell/nav-config.test.ts`

---

### Task 1: DB 스키마 + 테이블 마이그레이션

**Files:**
- Modify: `drizzle/schema.ts`
- Create: `drizzle/migrations/0015_proposal_tags.sql`
- Modify: `drizzle/migrations/meta/_journal.json`
- Test: `tests/entities/tag/schema.test.ts`

**Interfaces:**
- Produces: drizzle 테이블 `tagGroups`, `tagOptions`, `proposalTags` + select 타입 `TagGroup`/`TagOption`/`ProposalTag`(스키마용, `$inferSelect`).

- [ ] **Step 1: 실패하는 구조 테스트 작성**

`tests/entities/tag/schema.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { tagGroups, tagOptions, proposalTags } from "@drizzle/schema";

describe("tag schema columns", () => {
  it("tag_groups: code/label/sort_order 컬럼", () => {
    expect(tagGroups.code.name).toBe("code");
    expect(tagGroups.label.name).toBe("label");
    expect(tagGroups.sortOrder.name).toBe("sort_order");
  });
  it("tag_options: group_id/code 컬럼", () => {
    expect(tagOptions.groupId.name).toBe("group_id");
    expect(tagOptions.code.name).toBe("code");
  });
  it("proposal_tags: proposal_id/option_id 컬럼", () => {
    expect(proposalTags.proposalId.name).toBe("proposal_id");
    expect(proposalTags.optionId.name).toBe("option_id");
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/entities/tag/schema.test.ts`
Expected: FAIL — `tagGroups`/`tagOptions`/`proposalTags`가 `@drizzle/schema`에 없음.

- [ ] **Step 3: schema.ts에 테이블 추가**

`drizzle/schema.ts` 상단 import에 `primaryKey` 추가:
```ts
import { pgTable, uuid, text, timestamp, integer, unique, check, index, real, boolean, jsonb, primaryKey } from "drizzle-orm/pg-core";
```
파일 끝에 추가:
```ts
// 시안 태그 — 관리자가 관리하는 분류(그룹/옵션) + 시안별 선택(조인 테이블).
// FK·CASCADE·RLS는 레포 컨벤션대로 SQL 마이그레이션에서 추가한다.
export const tagGroups = pgTable("tag_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(), // 고정키(라벨 변경에도 안정)
  label: text("label").notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tagOptions = pgTable("tag_options", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id").notNull(), // FK → tag_groups (SQL)
  code: text("code").notNull(),
  label: text("label").notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("tag_options_group_code_unique").on(t.groupId, t.code),
]);

export const proposalTags = pgTable("proposal_tags", {
  proposalId: uuid("proposal_id").notNull(), // FK → proposals (SQL, cascade)
  optionId: uuid("option_id").notNull(),     // FK → tag_options (SQL, cascade)
  createdBy: uuid("created_by"),             // FK → profiles (SQL, set null)
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.proposalId, t.optionId] }),
  index("proposal_tags_option_idx").on(t.optionId),
]);

export type TagGroup = typeof tagGroups.$inferSelect;
export type TagOption = typeof tagOptions.$inferSelect;
export type ProposalTag = typeof proposalTags.$inferSelect;
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/entities/tag/schema.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: 테이블 마이그레이션 작성**

`drizzle/migrations/0015_proposal_tags.sql`:
```sql
CREATE TABLE "tag_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tag_groups_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "tag_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tag_options_group_code_unique" UNIQUE("group_id","code")
);
--> statement-breakpoint
CREATE TABLE "proposal_tags" (
	"proposal_id" uuid NOT NULL,
	"option_id" uuid NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "proposal_tags_pk" PRIMARY KEY("proposal_id","option_id")
);
--> statement-breakpoint
ALTER TABLE "tag_options" ADD CONSTRAINT "tag_options_group_id_tag_groups_fk" FOREIGN KEY ("group_id") REFERENCES "tag_groups"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "proposal_tags" ADD CONSTRAINT "proposal_tags_proposal_id_proposals_fk" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "proposal_tags" ADD CONSTRAINT "proposal_tags_option_id_tag_options_fk" FOREIGN KEY ("option_id") REFERENCES "tag_options"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "proposal_tags" ADD CONSTRAINT "proposal_tags_created_by_profiles_fk" FOREIGN KEY ("created_by") REFERENCES "profiles"("id") ON DELETE set null;
--> statement-breakpoint
CREATE INDEX "proposal_tags_option_idx" ON "proposal_tags" ("option_id");
--> statement-breakpoint
ALTER TABLE "tag_groups" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "tag_groups" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "tag_options" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "tag_options" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "proposal_tags" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "proposal_tags" FORCE ROW LEVEL SECURITY;
```

- [ ] **Step 6: _journal.json에 0015 엔트리 append**

`drizzle/migrations/meta/_journal.json`의 `entries` 배열 끝(0014 엔트리 뒤)에 추가:
```json
    ,{
      "idx": 15,
      "version": "7",
      "when": 1782900000000,
      "tag": "0015_proposal_tags",
      "breakpoints": true
    }
```
(0014 엔트리의 닫는 `}` 뒤에 `,`를 붙여 이어붙인다. JSON 유효성 확인.)

- [ ] **Step 7: 타입 체크 + 테스트**

Run: `npx tsc --noEmit && npx vitest run tests/entities/tag/schema.test.ts`
Expected: 타입 에러 없음, 3 tests PASS.

- [ ] **Step 8: 커밋**

```bash
git add drizzle/schema.ts drizzle/migrations/0015_proposal_tags.sql drizzle/migrations/meta/_journal.json tests/entities/tag/schema.test.ts
git commit -m "feat(tags): tag_groups/tag_options/proposal_tags 스키마 + 마이그레이션"
```

> **적용은 Task 2 직후 한 번에** (`npm run db:migrate`) 수행한다.

---

### Task 2: 시드 마이그레이션 (6 구분 · 76 항목)

**Files:**
- Create: `drizzle/migrations/0016_seed_tags.sql`
- Modify: `drizzle/migrations/meta/_journal.json`

**Interfaces:**
- Consumes: Task 1의 `tag_groups`/`tag_options` 테이블 + `tag_options_group_code_unique`.
- Produces: 시드된 6 그룹 + 76 옵션(멱등).

- [ ] **Step 1: 시드 마이그레이션 작성**

`drizzle/migrations/0016_seed_tags.sql`:
```sql
INSERT INTO "tag_groups" ("code","label","description","sort_order") VALUES
  ('purpose','목적','시안이 어떤 단계/목적으로 만들어졌는지 구분합니다.',1),
  ('target','대상','클라이언트의 성격을 구분합니다.',2),
  ('field','분야','업종이나 서비스 카테고리를 구분합니다.',3),
  ('screen','화면','무엇을 디자인한 시안인지 구분합니다.',4),
  ('style','스타일','디자인의 분위기와 시각적 톤을 구분합니다.',5),
  ('structure','구조','화면의 레이아웃이나 핵심 UI 패턴을 구분합니다.',6)
ON CONFLICT ("code") DO NOTHING;
--> statement-breakpoint
INSERT INTO "tag_options" ("group_id","code","label","description","sort_order")
SELECT g.id, v.code, v.label, v.description, v.sort_order
FROM "tag_groups" g
JOIN (VALUES
  ('purpose','proposal','제안','수주/제안 단계에서 방향성을 보여주기 위한 시안',1),
  ('purpose','main','본작업','실제 착수 후 요건을 반영해 제작한 시안',2),
  ('purpose','renewal','리뉴얼','기존 사이트/화면을 새롭게 개편하는 시안',3),
  ('purpose','improvement','개선','일부 영역, 사용성, UI를 개선하는 시안',4),
  ('purpose','operation','운영','배너, 이벤트, 공지 등 운영 목적의 시안',5),
  ('purpose','expansion','확장','기존 서비스에 새로운 페이지나 기능을 추가하는 시안',6),
  ('purpose','test','테스트','내부 검토, 스타일 실험, A/B 비교용 시안',7),
  ('target','gov_office','관공서','시청, 구청, 군청, 행정기관 등',1),
  ('target','public_org','공공기관','공단, 재단, 진흥원, 센터 등',2),
  ('target','education_org','교육기관','학교, 대학, 교육청, 학원 등',3),
  ('target','medical_org','의료기관','병원, 의원, 보건소, 헬스케어 기관',4),
  ('target','enterprise','기업','일반 법인, 중소기업, 대기업',5),
  ('target','brand','브랜드','제품/서비스 브랜드 중심 클라이언트',6),
  ('target','small_biz','소상공인','자영업, 매장, 개인사업자',7),
  ('target','association','협회/단체','협회, 조합, 비영리단체, NGO',8),
  ('target','startup','스타트업','신규 서비스, 플랫폼, IT 기반 초기 기업',9),
  ('target','internal','내부 프로젝트','회사 내부 서비스, 자체 서비스, 사내 시스템',10),
  ('field','public_admin','행정','민원, 정책, 공공서비스, 안내',1),
  ('field','education','교육','교육과정, 학교, 강의, 학습 서비스',2),
  ('field','medical_welfare','의료/복지','병원, 건강, 복지, 돌봄 서비스',3),
  ('field','culture_art','문화/예술','전시, 공연, 박물관, 도서관, 콘텐츠',4),
  ('field','tourism_leisure','관광/레저','여행, 숙박, 축제, 체험, 스포츠',5),
  ('field','manufacturing','제조/산업','제품, 설비, 부품, B2B 산업체',6),
  ('field','it_platform','IT/플랫폼','SaaS, 앱, 웹서비스, 커뮤니티',7),
  ('field','commerce','커머스','쇼핑몰, 상세페이지, 판매/구매',8),
  ('field','finance_insurance','금융/보험','금융상품, 보험, 투자, 상담',9),
  ('field','realestate_construction','부동산/건설','분양, 건설사, 부동산 플랫폼',10),
  ('field','food_beverage','식음료','음식점, 카페, 주류, 프랜차이즈',11),
  ('field','recruit_hr','채용/인재','채용공고, 인재풀, HR 서비스',12),
  ('field','environment_energy','환경/에너지','친환경, 에너지, ESG, 기후 관련',13),
  ('field','media_content','미디어/콘텐츠','뉴스, 매거진, 영상, 콘텐츠 플랫폼',14),
  ('screen','home_main','홈페이지 메인','대표 메인 화면',1),
  ('screen','home_sub','홈페이지 서브','소개, 안내, 콘텐츠성 서브페이지',2),
  ('screen','landing','랜딩페이지','광고/캠페인/전환 중심 단일 페이지',3),
  ('screen','event','이벤트 페이지','프로모션, 참여, 이벤트 안내 페이지',4),
  ('screen','detail','상세페이지','제품, 서비스, 콘텐츠 상세 화면',5),
  ('screen','list','리스트 페이지','게시판, 상품목록, 콘텐츠 목록',6),
  ('screen','search_result','검색/결과 페이지','검색창, 필터, 결과 목록 중심 화면',7),
  ('screen','apply_form','신청/예약 폼','접수, 신청, 예약, 문의 입력 화면',8),
  ('screen','auth','로그인/회원가입','인증 관련 화면',9),
  ('screen','mypage','마이페이지','사용자 정보, 신청내역, 개인화 화면',10),
  ('screen','admin','관리자','CMS, 운영자 관리 화면',11),
  ('screen','dashboard','대시보드','통계, 차트, 현황 관리 화면',12),
  ('screen','app','앱 화면','모바일 앱 UI',13),
  ('screen','banner_popup','배너/팝업','운영 배너, 메인 팝업, 광고 소재',14),
  ('screen','email_notify','이메일/알림','메일 템플릿, 알림 화면',15),
  ('style','trust','신뢰감','안정적이고 공신력 있는 느낌',1),
  ('style','modern','모던','최신 웹 UI 느낌, 정돈된 구성',2),
  ('style','minimal','미니멀','요소를 절제한 단순한 스타일',3),
  ('style','professional','전문적','정보 전달력과 업무성이 강한 스타일',4),
  ('style','friendly','친근한','부드럽고 접근성 좋은 느낌',5),
  ('style','emotional','감성적','이미지, 여백, 문구 중심의 분위기',6),
  ('style','luxury','고급스러운','프리미엄, 고급 브랜드 느낌',7),
  ('style','dynamic','역동적','움직임, 강한 비주얼, 활기 있는 느낌',8),
  ('style','technical','테크니컬','IT, 데이터, 기술 중심 느낌',9),
  ('style','public','공공적','관공서/공공기관에 적합한 정돈된 스타일',10),
  ('style','casual','캐주얼','가볍고 편안한 서비스 느낌',11),
  ('style','kitsch_trendy','키치/트렌디','개성 있고 젊은 감각의 스타일',12),
  ('style','info_centric','정보중심','장식보다 정보 구조가 우선인 스타일',13),
  ('style','visual_centric','비주얼중심','큰 이미지, 그래픽, 영상 중심 스타일',14),
  ('structure','hero','히어로 중심','첫 화면의 큰 비주얼/카피가 중심',1),
  ('structure','card','카드형','콘텐츠를 카드 단위로 나열',2),
  ('structure','list','리스트형','정보를 행 단위 목록으로 정리',3),
  ('structure','grid','그리드형','여러 콘텐츠를 격자 구조로 배치',4),
  ('structure','search','검색중심','검색창, 필터, 결과 탐색이 핵심',5),
  ('structure','booking','예약중심','날짜, 시간, 장소, 인원 선택 구조',6),
  ('structure','apply','신청중심','입력폼과 제출 흐름이 핵심',7),
  ('structure','storytelling','스토리텔링','순차적으로 내용을 설명하는 구조',8),
  ('structure','onepage','원페이지','한 페이지 안에서 섹션별로 전개',9),
  ('structure','tab','탭 구조','카테고리/정보를 탭으로 구분',10),
  ('structure','dashboard','대시보드형','통계, 차트, 요약 카드 중심',11),
  ('structure','map','지도중심','위치, 장소, 지역 정보가 핵심',12),
  ('structure','gallery','갤러리형','이미지나 포트폴리오가 중심',13),
  ('structure','magazine','매거진형','기사, 콘텐츠, 이미지 조합 중심',14),
  ('structure','comparison','비교형','A/B, 상품, 서비스 비교 중심',15),
  ('structure','stepper','단계형','순서대로 진행하는 멀티스텝 구조',16)
) AS v(group_code, code, label, description, sort_order) ON v.group_code = g.code
ON CONFLICT ("group_id","code") DO NOTHING;
```

- [ ] **Step 2: _journal.json에 0016 엔트리 append**

`entries` 배열 끝(0015 뒤)에 추가:
```json
    ,{
      "idx": 16,
      "version": "7",
      "when": 1783000000000,
      "tag": "0016_seed_tags",
      "breakpoints": true
    }
```

- [ ] **Step 3: 마이그레이션 적용(라이브 Supabase)**

Run: `npm run db:migrate`
Expected: 0015·0016 적용 성공(에러 없음). ⚠️ 라이브 DB에 적용된다 — `.env.local`의 `DATABASE_URL` 확인. Node ≥ 22.

- [ ] **Step 4: 시드 검증**

Run:
```bash
node --env-file=.env.local -e "const p=require('postgres')(process.env.DATABASE_URL,{prepare:false});(async()=>{const g=await p\`select count(*)::int n from tag_groups\`;const o=await p\`select count(*)::int n from tag_options\`;console.log('groups',g[0].n,'options',o[0].n);await p.end()})()"
```
Expected: `groups 6 options 76`.

- [ ] **Step 5: 커밋**

```bash
git add drizzle/migrations/0016_seed_tags.sql drizzle/migrations/meta/_journal.json
git commit -m "chore(db): 시안 태그 6구분 76항목 시드 마이그레이션"
```

---

### Task 3: 엔티티 타입 · zod 스키마 · diff 로직

**Files:**
- Create: `src/entities/tag/model/types.ts`
- Create: `src/entities/tag/model/schemas.ts`
- Create: `src/entities/tag/lib/diff-selection.ts`
- Test: `tests/entities/tag/schemas.test.ts`, `tests/entities/tag/diff-selection.test.ts`

**Interfaces:**
- Produces:
  - 타입 `TagGroup`, `TagOption`, `TagGroupWithOptions`, `Taxonomy`, `ProposalTags`
  - zod `groupCreateSchema`, `groupUpdateSchema`, `optionCreateSchema`, `optionUpdateSchema`, `proposalTagsSchema`
  - `diffSelection(current: string[], next: string[]): { toAdd: string[]; toRemove: string[] }`

- [ ] **Step 1: DTO 타입 작성**

`src/entities/tag/model/types.ts`:
```ts
// 클라이언트로 넘기는 태그 DTO(날짜 제외, sortOrder는 number).
export type TagGroup = {
  id: string;
  code: string;
  label: string;
  description: string | null;
  sortOrder: number;
};

export type TagOption = {
  id: string;
  groupId: string;
  code: string;
  label: string;
  description: string | null;
  sortOrder: number;
};

export type TagGroupWithOptions = TagGroup & { options: TagOption[] };
export type Taxonomy = TagGroupWithOptions[];

// 시안 1건의 현재 선택 옵션 id 집합.
export type ProposalTags = { optionIds: string[] };
```

- [ ] **Step 2: 실패하는 zod 스키마 테스트 작성**

`tests/entities/tag/schemas.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import {
  groupCreateSchema,
  optionCreateSchema,
  proposalTagsSchema,
} from "@/entities/tag/model/schemas";

describe("tag schemas", () => {
  it("groupCreateSchema: code/label 필수", () => {
    expect(groupCreateSchema.safeParse({ code: "purpose", label: "목적" }).success).toBe(true);
    expect(groupCreateSchema.safeParse({ label: "목적" }).success).toBe(false);
    expect(groupCreateSchema.safeParse({ code: "purpose", label: "" }).success).toBe(false);
  });
  it("optionCreateSchema: groupId는 uuid", () => {
    const ok = optionCreateSchema.safeParse({
      groupId: "00000000-0000-0000-0000-000000000000",
      code: "proposal",
      label: "제안",
    });
    expect(ok.success).toBe(true);
    expect(optionCreateSchema.safeParse({ groupId: "nope", code: "x", label: "y" }).success).toBe(false);
  });
  it("proposalTagsSchema: optionIds는 uuid 배열", () => {
    expect(proposalTagsSchema.safeParse({ optionIds: [] }).success).toBe(true);
    expect(
      proposalTagsSchema.safeParse({ optionIds: ["00000000-0000-0000-0000-000000000000"] }).success,
    ).toBe(true);
    expect(proposalTagsSchema.safeParse({ optionIds: ["bad"] }).success).toBe(false);
  });
});
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `npx vitest run tests/entities/tag/schemas.test.ts`
Expected: FAIL — `@/entities/tag/model/schemas` 없음.

- [ ] **Step 4: zod 스키마 작성**

`src/entities/tag/model/schemas.ts`:
```ts
import { z } from "zod";

const label = z.string().trim().min(1, "이름을 입력하세요").max(100);
const code = z.string().trim().min(1, "코드를 입력하세요").max(50);
const description = z.string().trim().max(500).nullable().optional();
const sortOrder = z.number().int().optional();

export const groupCreateSchema = z.object({ code, label, description, sortOrder });
export const groupUpdateSchema = z.object({
  label: label.optional(),
  description,
  sortOrder,
});

export const optionCreateSchema = z.object({
  groupId: z.uuid(),
  code,
  label,
  description,
  sortOrder,
});
export const optionUpdateSchema = z.object({
  label: label.optional(),
  description,
  sortOrder,
});

export const proposalTagsSchema = z.object({
  optionIds: z.array(z.uuid()),
});

export type GroupCreateInput = z.infer<typeof groupCreateSchema>;
export type GroupUpdateInput = z.infer<typeof groupUpdateSchema>;
export type OptionCreateInput = z.infer<typeof optionCreateSchema>;
export type OptionUpdateInput = z.infer<typeof optionUpdateSchema>;
export type ProposalTagsInput = z.infer<typeof proposalTagsSchema>;
```

- [ ] **Step 5: zod 테스트 통과 확인**

Run: `npx vitest run tests/entities/tag/schemas.test.ts`
Expected: PASS.

- [ ] **Step 6: 실패하는 diff 테스트 작성**

`tests/entities/tag/diff-selection.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { diffSelection } from "@/entities/tag/lib/diff-selection";

describe("diffSelection", () => {
  it("추가/삭제 계산", () => {
    expect(diffSelection(["a", "b"], ["b", "c"])).toEqual({ toAdd: ["c"], toRemove: ["a"] });
  });
  it("변경 없음 → 빈 diff", () => {
    expect(diffSelection(["a", "b"], ["a", "b"])).toEqual({ toAdd: [], toRemove: [] });
  });
  it("next 중복 제거", () => {
    expect(diffSelection([], ["a", "a"])).toEqual({ toAdd: ["a"], toRemove: [] });
  });
  it("전체 해제 → 전부 삭제", () => {
    expect(diffSelection(["a", "b"], [])).toEqual({ toAdd: [], toRemove: ["a", "b"] });
  });
});
```

- [ ] **Step 7: diff 테스트 실패 확인**

Run: `npx vitest run tests/entities/tag/diff-selection.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 8: diff 로직 작성**

`src/entities/tag/lib/diff-selection.ts`:
```ts
// 현재 선택집합 → 다음 선택집합 전이를 추가/삭제로 분해한다(Set으로 중복 제거).
export function diffSelection(
  current: string[],
  next: string[],
): { toAdd: string[]; toRemove: string[] } {
  const cur = new Set(current);
  const nxt = new Set(next);
  return {
    toAdd: [...nxt].filter((id) => !cur.has(id)),
    toRemove: [...cur].filter((id) => !nxt.has(id)),
  };
}
```

- [ ] **Step 9: diff 테스트 통과 확인**

Run: `npx vitest run tests/entities/tag/diff-selection.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 10: 커밋**

```bash
git add src/entities/tag/model tests/entities/tag/schemas.test.ts src/entities/tag/lib tests/entities/tag/diff-selection.test.ts
git commit -m "feat(tags): 엔티티 타입·zod 스키마·선택집합 diff 로직"
```

---

### Task 4: 분류(taxonomy) 읽기 — 서버 함수 + GET 라우트 + 클라이언트 fetch + query factory

**Files:**
- Create: `src/entities/tag/api/get-taxonomy.server.ts`
- Create: `src/entities/tag/api/get-taxonomy.ts`
- Create: `src/entities/tag/api/tag.query.ts`
- Create: `src/entities/tag/index.ts`
- Create: `app/api/tags/taxonomy/route.ts`

**Interfaces:**
- Consumes: Task 1 테이블, Task 3 `Taxonomy` 타입.
- Produces:
  - 서버 `getTaxonomy(): Promise<Taxonomy>` (in `get-taxonomy.server.ts`)
  - 클라 `getTaxonomy(): Promise<Taxonomy>` (in `get-taxonomy.ts`, http)
  - `tagQueries` factory: `tagQueries.all()`, `tagQueries.taxonomy()`, `tagQueries.proposal(id)`
  - 배럴 `@/entities/tag` → `tagQueries` + 타입 재노출
  - `GET /api/tags/taxonomy` (editor+)

- [ ] **Step 1: 서버 fetch 작성**

`src/entities/tag/api/get-taxonomy.server.ts`:
```ts
import "server-only";
import { asc } from "drizzle-orm";
import { db } from "@/shared/db";
import { tagGroups, tagOptions } from "@drizzle/schema";
import { requireEditor } from "@/shared/auth/guards.server";
import type { Taxonomy, TagOption } from "../model/types";

export async function getTaxonomy(): Promise<Taxonomy> {
  await requireEditor();

  const groups = await db
    .select()
    .from(tagGroups)
    .orderBy(asc(tagGroups.sortOrder), asc(tagGroups.createdAt));
  const options = await db
    .select()
    .from(tagOptions)
    .orderBy(asc(tagOptions.sortOrder), asc(tagOptions.createdAt));

  const byGroup = new Map<string, TagOption[]>();
  for (const o of options) {
    const list = byGroup.get(o.groupId) ?? [];
    list.push({
      id: o.id,
      groupId: o.groupId,
      code: o.code,
      label: o.label,
      description: o.description,
      sortOrder: o.sortOrder,
    });
    byGroup.set(o.groupId, list);
  }

  return groups.map((g) => ({
    id: g.id,
    code: g.code,
    label: g.label,
    description: g.description,
    sortOrder: g.sortOrder,
    options: byGroup.get(g.id) ?? [],
  }));
}
```

- [ ] **Step 2: 클라이언트 fetch 작성**

`src/entities/tag/api/get-taxonomy.ts`:
```ts
import { http } from "@/shared/api/http";
import type { Taxonomy } from "../model/types";

export function getTaxonomy(): Promise<Taxonomy> {
  return http<Taxonomy>("/api/tags/taxonomy");
}
```

- [ ] **Step 3: query factory 작성**

`src/entities/tag/api/tag.query.ts`:
```ts
import { queryOptions } from "@tanstack/react-query";
import { getTaxonomy } from "./get-taxonomy";
import { getProposalTags } from "./get-proposal-tags";

export const tagQueries = {
  all: () => ["tags"] as const,
  taxonomy: () =>
    queryOptions({
      queryKey: [...tagQueries.all(), "taxonomy"],
      queryFn: getTaxonomy,
    }),
  proposal: (proposalId: string) =>
    queryOptions({
      queryKey: [...tagQueries.all(), "proposal", proposalId],
      queryFn: () => getProposalTags(proposalId),
    }),
};
```
> `getProposalTags`는 Task 6에서 만든다. Task 6 완료 전에는 이 파일이 타입 에러를 내므로, **Step 5의 배럴/임포트 검증은 Task 6 이후**에 수행한다(아래 Step 6 참고). 먼저 `get-proposal-tags.ts`를 빈 스텁으로 만들지 말 것 — Task 6에서 실제 구현.

- [ ] **Step 4: 배럴 작성**

`src/entities/tag/index.ts`:
```ts
export { tagQueries } from "./api/tag.query";
export type {
  TagGroup,
  TagOption,
  TagGroupWithOptions,
  Taxonomy,
  ProposalTags,
} from "./model/types";
```

- [ ] **Step 5: GET 라우트 작성**

`app/api/tags/taxonomy/route.ts`:
```ts
import { getTaxonomy } from "@/entities/tag/api/get-taxonomy.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

export async function GET() {
  try {
    return Response.json(await getTaxonomy());
  } catch (error) {
    return toErrorResponse(error);
  }
}
```

- [ ] **Step 6: 타입 체크(부분)**

> 이 시점엔 `tag.query.ts`가 아직 없는 `get-proposal-tags`를 참조하므로 `tsc`가 실패한다. 정상이다. 대신 이 태스크의 서버/라우트 파일만 개별 확인:

Run: `npx tsc --noEmit 2>&1 | grep -v "get-proposal-tags" | grep -E "get-taxonomy|taxonomy/route|tag/index" || echo "no errors in this task's files"`
Expected: `no errors in this task's files`.

- [ ] **Step 7: 커밋**

```bash
git add src/entities/tag/api/get-taxonomy.server.ts src/entities/tag/api/get-taxonomy.ts src/entities/tag/api/tag.query.ts src/entities/tag/index.ts app/api/tags/taxonomy/route.ts
git commit -m "feat(tags): taxonomy 조회 서버/클라이언트 + GET 라우트 + query factory"
```

---

### Task 5: 관리자 CRUD 서버 뮤테이션 + 라우트

**Files:**
- Create: `src/entities/tag/api/group-mutations.server.ts`
- Create: `src/entities/tag/api/option-mutations.server.ts`
- Create: `app/api/admin/tags/groups/route.ts`
- Create: `app/api/admin/tags/groups/[id]/route.ts`
- Create: `app/api/admin/tags/options/route.ts`
- Create: `app/api/admin/tags/options/[id]/route.ts`

**Interfaces:**
- Consumes: Task 1 테이블, Task 3 스키마.
- Produces:
  - `createGroup(input): Promise<TagGroup>`, `updateGroup(id, input): Promise<void>`, `deleteGroup(id): Promise<void>` (DTO `TagGroup` from `../model/types`)
  - `createOption(input): Promise<TagOption>`, `updateOption(id, input): Promise<void>`, `deleteOption(id): Promise<void>`
  - 라우트: `POST /api/admin/tags/groups`, `PATCH|DELETE /api/admin/tags/groups/[id]`, `POST /api/admin/tags/options`, `PATCH|DELETE /api/admin/tags/options/[id]` (모두 admin)

- [ ] **Step 1: 그룹 뮤테이션 작성**

`src/entities/tag/api/group-mutations.server.ts`:
```ts
import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { tagGroups } from "@drizzle/schema";
import { requireAdmin } from "@/shared/auth/guards.server";
import { groupCreateSchema, groupUpdateSchema } from "../model/schemas";
import type { TagGroup } from "../model/types";

export async function createGroup(input: unknown): Promise<TagGroup> {
  await requireAdmin();
  const data = groupCreateSchema.parse(input);
  const [row] = await db
    .insert(tagGroups)
    .values({
      code: data.code,
      label: data.label,
      description: data.description ?? null,
      sortOrder: data.sortOrder ?? 0,
    })
    .returning();
  return {
    id: row.id,
    code: row.code,
    label: row.label,
    description: row.description,
    sortOrder: row.sortOrder,
  };
}

export async function updateGroup(id: string, input: unknown): Promise<void> {
  await requireAdmin();
  const data = groupUpdateSchema.parse(input);
  await db.update(tagGroups).set(data).where(eq(tagGroups.id, id));
}

export async function deleteGroup(id: string): Promise<void> {
  await requireAdmin();
  // tag_options + proposal_tags 는 ON DELETE CASCADE 로 함께 삭제된다.
  await db.delete(tagGroups).where(eq(tagGroups.id, id));
}
```

- [ ] **Step 2: 옵션 뮤테이션 작성**

`src/entities/tag/api/option-mutations.server.ts`:
```ts
import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { tagOptions } from "@drizzle/schema";
import { requireAdmin } from "@/shared/auth/guards.server";
import { optionCreateSchema, optionUpdateSchema } from "../model/schemas";
import type { TagOption } from "../model/types";

export async function createOption(input: unknown): Promise<TagOption> {
  await requireAdmin();
  const data = optionCreateSchema.parse(input);
  const [row] = await db
    .insert(tagOptions)
    .values({
      groupId: data.groupId,
      code: data.code,
      label: data.label,
      description: data.description ?? null,
      sortOrder: data.sortOrder ?? 0,
    })
    .returning();
  return {
    id: row.id,
    groupId: row.groupId,
    code: row.code,
    label: row.label,
    description: row.description,
    sortOrder: row.sortOrder,
  };
}

export async function updateOption(id: string, input: unknown): Promise<void> {
  await requireAdmin();
  const data = optionUpdateSchema.parse(input);
  await db.update(tagOptions).set(data).where(eq(tagOptions.id, id));
}

export async function deleteOption(id: string): Promise<void> {
  await requireAdmin();
  // proposal_tags 는 ON DELETE CASCADE 로 함께 삭제된다.
  await db.delete(tagOptions).where(eq(tagOptions.id, id));
}
```

- [ ] **Step 3: 그룹 컬렉션 라우트(POST)**

`app/api/admin/tags/groups/route.ts`:
```ts
import { NextRequest } from "next/server";
import { createGroup } from "@/entities/tag/api/group-mutations.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

export async function POST(req: NextRequest) {
  try {
    return Response.json(await createGroup(await req.json()), { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
```

- [ ] **Step 4: 그룹 단건 라우트(PATCH, DELETE)**

`app/api/admin/tags/groups/[id]/route.ts`:
```ts
import { NextRequest } from "next/server";
import { updateGroup, deleteGroup } from "@/entities/tag/api/group-mutations.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await updateGroup(id, await req.json());
    return new Response(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await deleteGroup(id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
```

- [ ] **Step 5: 옵션 컬렉션 라우트(POST)**

`app/api/admin/tags/options/route.ts`:
```ts
import { NextRequest } from "next/server";
import { createOption } from "@/entities/tag/api/option-mutations.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

export async function POST(req: NextRequest) {
  try {
    return Response.json(await createOption(await req.json()), { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
```

- [ ] **Step 6: 옵션 단건 라우트(PATCH, DELETE)**

`app/api/admin/tags/options/[id]/route.ts`:
```ts
import { NextRequest } from "next/server";
import { updateOption, deleteOption } from "@/entities/tag/api/option-mutations.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await updateOption(id, await req.json());
    return new Response(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await deleteOption(id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
```

- [ ] **Step 7: 커밋**

```bash
git add src/entities/tag/api/group-mutations.server.ts src/entities/tag/api/option-mutations.server.ts "app/api/admin/tags"
git commit -m "feat(tags): 관리자 그룹·옵션 CRUD 서버 뮤테이션 + 라우트"
```

---

### Task 6: 시안 태그 — 서버 조회/저장 + 라우트 + 클라이언트 조회 fetch

**Files:**
- Create: `src/entities/tag/api/get-proposal-tags.server.ts`
- Create: `src/entities/tag/api/get-proposal-tags.ts`
- Create: `src/entities/tag/api/put-proposal-tags.server.ts`
- Create: `app/api/proposals/[id]/tags/route.ts`

**Interfaces:**
- Consumes: Task 1 `proposalTags`, Task 3 `proposalTagsSchema` + `diffSelection`, Task 4 `tag.query.ts`가 참조하는 `getProposalTags` 클라 fetch.
- Produces:
  - 서버 `getProposalTags(proposalId): Promise<ProposalTags>`, `putProposalTags(proposalId, input): Promise<void>`
  - 클라 `getProposalTags(proposalId): Promise<ProposalTags>` (http)
  - `GET|PUT /api/proposals/[id]/tags` (editor+)
- **이 태스크 완료 시 Task 4의 `tag.query.ts` import가 해소되어 `tsc`가 통과해야 한다.**

- [ ] **Step 1: 서버 조회 작성**

`src/entities/tag/api/get-proposal-tags.server.ts`:
```ts
import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { proposalTags } from "@drizzle/schema";
import { requireEditor } from "@/shared/auth/guards.server";
import type { ProposalTags } from "../model/types";

export async function getProposalTags(proposalId: string): Promise<ProposalTags> {
  await requireEditor();
  const rows = await db
    .select({ optionId: proposalTags.optionId })
    .from(proposalTags)
    .where(eq(proposalTags.proposalId, proposalId));
  return { optionIds: rows.map((r) => r.optionId) };
}
```

- [ ] **Step 2: 서버 저장(diff 교체) 작성**

`src/entities/tag/api/put-proposal-tags.server.ts`:
```ts
import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/shared/db";
import { proposalTags } from "@drizzle/schema";
import { requireEditor } from "@/shared/auth/guards.server";
import { proposalTagsSchema } from "../model/schemas";
import { diffSelection } from "../lib/diff-selection";

export async function putProposalTags(proposalId: string, input: unknown): Promise<void> {
  const editor = await requireEditor();
  const { optionIds } = proposalTagsSchema.parse(input);

  await db.transaction(async (tx) => {
    const existing = await tx
      .select({ optionId: proposalTags.optionId })
      .from(proposalTags)
      .where(eq(proposalTags.proposalId, proposalId));

    const { toAdd, toRemove } = diffSelection(
      existing.map((r) => r.optionId),
      optionIds,
    );

    if (toRemove.length) {
      await tx
        .delete(proposalTags)
        .where(
          and(eq(proposalTags.proposalId, proposalId), inArray(proposalTags.optionId, toRemove)),
        );
    }
    if (toAdd.length) {
      await tx
        .insert(proposalTags)
        .values(toAdd.map((optionId) => ({ proposalId, optionId, createdBy: editor.id })));
    }
  });
}
```

- [ ] **Step 3: 클라이언트 조회 fetch 작성**

`src/entities/tag/api/get-proposal-tags.ts`:
```ts
import { http } from "@/shared/api/http";
import type { ProposalTags } from "../model/types";

export function getProposalTags(proposalId: string): Promise<ProposalTags> {
  return http<ProposalTags>(`/api/proposals/${proposalId}/tags`);
}
```

- [ ] **Step 4: 라우트(GET, PUT) 작성**

`app/api/proposals/[id]/tags/route.ts`:
```ts
import { NextRequest } from "next/server";
import { getProposalTags } from "@/entities/tag/api/get-proposal-tags.server";
import { putProposalTags } from "@/entities/tag/api/put-proposal-tags.server";
import { toErrorResponse } from "@/shared/api/to-error-response";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return Response.json(await getProposalTags(id));
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await putProposalTags(id, await req.json());
    return new Response(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
```

- [ ] **Step 5: 전체 타입 체크 + 테스트**

Run: `npx tsc --noEmit && npx vitest run tests/entities/tag`
Expected: 타입 에러 없음(Task 4의 `tag.query.ts` import 해소), tag 테스트 전부 PASS.

- [ ] **Step 6: 커밋**

```bash
git add src/entities/tag/api/get-proposal-tags.server.ts src/entities/tag/api/get-proposal-tags.ts src/entities/tag/api/put-proposal-tags.server.ts "app/api/proposals/[id]/tags"
git commit -m "feat(tags): 시안 태그 조회/저장(diff 교체) 서버 + GET·PUT 라우트"
```

---

### Task 7: 스튜디오 GNB에 "태그 설정"(admin 전용) 추가

**Files:**
- Modify: `src/widgets/studio-shell/model/nav-config.ts`
- Test: `tests/widgets/studio-shell/nav-config.test.ts`

**Interfaces:**
- Consumes: 기존 `NAV_ITEMS`, `matchNav`, `visibleNavItems`.
- Produces: `/studio/tags` → label `"태그 설정"`, `adminOnly: true`.

- [ ] **Step 1: 실패하는 테스트 추가**

`tests/widgets/studio-shell/nav-config.test.ts`의 `describe` 블록 안에 추가:
```ts
  it("matchNav: 태그 설정 경로", () => {
    expect(matchNav("/studio/tags")?.label).toBe("태그 설정");
  });
  it("visibleNavItems: editor는 태그 설정을 숨김", () => {
    const labels = visibleNavItems("editor").map((i) => i.label);
    expect(labels).not.toContain("태그 설정");
  });
  it("visibleNavItems: admin은 태그 설정을 봄", () => {
    const labels = visibleNavItems("admin").map((i) => i.label);
    expect(labels).toContain("태그 설정");
  });
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/widgets/studio-shell/nav-config.test.ts`
Expected: FAIL — `/studio/tags` 미정의.

- [ ] **Step 3: nav 항목 추가**

`src/widgets/studio-shell/model/nav-config.ts` 상단 import에 `Tags` 추가하고 `NAV_ITEMS`에 항목 추가:
```ts
import { Layers, Users, Tags } from "lucide-react";
```
```ts
export const NAV_ITEMS: NavItem[] = [
  { href: "/studio/proposals", label: "시안", icon: Layers },
  { href: "/studio/tags", label: "태그 설정", icon: Tags, adminOnly: true },
  { href: "/studio/users", label: "사용자 관리", icon: Users, adminOnly: true },
];
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/widgets/studio-shell/nav-config.test.ts`
Expected: PASS (기존 + 신규 모두).

- [ ] **Step 5: 커밋**

```bash
git add src/widgets/studio-shell/model/nav-config.ts tests/widgets/studio-shell/nav-config.test.ts
git commit -m "feat(tags): 스튜디오 GNB에 태그 설정(admin) 추가"
```

---

### Task 8: 관리자 태그 설정 UI (manage-tag-taxonomy 피처 + 페이지 + 라우트)

**Files:**
- Create: `src/features/manage-tag-taxonomy/api/manage-taxonomy.ts`
- Create: `src/features/manage-tag-taxonomy/api/use-tag-taxonomy-mutations.ts`
- Create: `src/features/manage-tag-taxonomy/ui/confirm-dialog.tsx`
- Create: `src/features/manage-tag-taxonomy/ui/group-dialog.tsx`
- Create: `src/features/manage-tag-taxonomy/ui/option-dialog.tsx`
- Create: `src/features/manage-tag-taxonomy/ui/option-row.tsx`
- Create: `src/features/manage-tag-taxonomy/ui/group-card.tsx`
- Create: `src/features/manage-tag-taxonomy/index.ts`
- Create: `src/pages/admin-tags/ui/admin-tags-page.tsx`
- Create: `src/pages/admin-tags/index.ts`
- Create: `app/studio/tags/page.tsx`

**Interfaces:**
- Consumes: `tagQueries`(Task 4), Task 5 라우트, `TagGroup`/`TagOption`/`TagGroupWithOptions` 타입.
- Produces: `AdminTagsPage`(pages 배럴), `GroupCard`/`GroupDialog`(feature 배럴), 훅 `useCreateGroup`/`useUpdateGroup`/`useDeleteGroup`/`useCreateOption`/`useUpdateOption`/`useDeleteOption`.

- [ ] **Step 1: http 래퍼 작성**

`src/features/manage-tag-taxonomy/api/manage-taxonomy.ts`:
```ts
import { http } from "@/shared/api/http";
import type { TagGroup, TagOption } from "@/entities/tag";

export type GroupCreate = { code: string; label: string; description?: string | null; sortOrder?: number };
export type GroupUpdate = { label?: string; description?: string | null; sortOrder?: number };
export type OptionCreate = {
  groupId: string;
  code: string;
  label: string;
  description?: string | null;
  sortOrder?: number;
};
export type OptionUpdate = { label?: string; description?: string | null; sortOrder?: number };

export const createGroup = (input: GroupCreate) =>
  http<TagGroup>("/api/admin/tags/groups", { method: "POST", body: JSON.stringify(input) });
export const updateGroup = (id: string, input: GroupUpdate) =>
  http<void>(`/api/admin/tags/groups/${id}`, { method: "PATCH", body: JSON.stringify(input) });
export const deleteGroup = (id: string) =>
  http<void>(`/api/admin/tags/groups/${id}`, { method: "DELETE" });

export const createOption = (input: OptionCreate) =>
  http<TagOption>("/api/admin/tags/options", { method: "POST", body: JSON.stringify(input) });
export const updateOption = (id: string, input: OptionUpdate) =>
  http<void>(`/api/admin/tags/options/${id}`, { method: "PATCH", body: JSON.stringify(input) });
export const deleteOption = (id: string) =>
  http<void>(`/api/admin/tags/options/${id}`, { method: "DELETE" });
```

- [ ] **Step 2: 뮤테이션 훅 작성**

`src/features/manage-tag-taxonomy/api/use-tag-taxonomy-mutations.ts`:
```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { tagQueries } from "@/entities/tag";
import * as api from "./manage-taxonomy";

function useInvalidateTags() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: tagQueries.all() });
}

export function useCreateGroup() {
  const invalidate = useInvalidateTags();
  return useMutation({ mutationFn: api.createGroup, onSuccess: invalidate });
}
export function useUpdateGroup() {
  const invalidate = useInvalidateTags();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: api.GroupUpdate }) => api.updateGroup(id, input),
    onSuccess: invalidate,
  });
}
export function useDeleteGroup() {
  const invalidate = useInvalidateTags();
  return useMutation({ mutationFn: (id: string) => api.deleteGroup(id), onSuccess: invalidate });
}
export function useCreateOption() {
  const invalidate = useInvalidateTags();
  return useMutation({ mutationFn: api.createOption, onSuccess: invalidate });
}
export function useUpdateOption() {
  const invalidate = useInvalidateTags();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: api.OptionUpdate }) => api.updateOption(id, input),
    onSuccess: invalidate,
  });
}
export function useDeleteOption() {
  const invalidate = useInvalidateTags();
  return useMutation({ mutationFn: (id: string) => api.deleteOption(id), onSuccess: invalidate });
}
```

- [ ] **Step 3: 확인 다이얼로그 작성**

`src/features/manage-tag-taxonomy/ui/confirm-dialog.tsx`:
```tsx
"use client";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "삭제",
  onConfirm,
  pending,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  pending?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>취소</DialogClose>
          <Button type="button" variant="destructive" onClick={onConfirm} disabled={pending}>
            {pending ? "삭제 중…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: 그룹 다이얼로그 작성**

`src/features/manage-tag-taxonomy/ui/group-dialog.tsx`:
```tsx
"use client";

import { useState } from "react";
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
import type { TagGroup } from "@/entities/tag";
import { useCreateGroup, useUpdateGroup } from "../api/use-tag-taxonomy-mutations";

export function GroupDialog({
  open,
  onOpenChange,
  group,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  group?: TagGroup;
}) {
  const isEdit = !!group;
  const create = useCreateGroup();
  const update = useUpdateGroup();
  const [code, setCode] = useState(group?.code ?? "");
  const [label, setLabel] = useState(group?.label ?? "");
  const [description, setDescription] = useState(group?.description ?? "");
  const pending = create.isPending || update.isPending;

  function submit() {
    if (!label.trim()) {
      toast.error("이름을 입력하세요");
      return;
    }
    const desc = description.trim() || null;
    if (group) {
      // `group` 진리값으로 분기해야 TS가 group을 정의됨으로 좁힌다(isEdit 불리언은 못 좁힘).
      update.mutate(
        { id: group.id, input: { label: label.trim(), description: desc } },
        {
          onSuccess: () => {
            toast.success("구분을 수정했습니다");
            onOpenChange(false);
          },
          onError: () => toast.error("수정에 실패했습니다"),
        },
      );
    } else {
      if (!code.trim()) {
        toast.error("코드를 입력하세요");
        return;
      }
      create.mutate(
        { code: code.trim(), label: label.trim(), description: desc },
        {
          onSuccess: () => {
            toast.success("구분을 추가했습니다");
            onOpenChange(false);
          },
          onError: () => toast.error("추가에 실패했습니다(코드 중복일 수 있어요)"),
        },
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "구분 수정" : "구분 추가"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {!isEdit && (
            <div className="space-y-1.5">
              <Label htmlFor="group-code">코드(고정키)</Label>
              <Input
                id="group-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="purpose"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="group-label">이름</Label>
            <Input
              id="group-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="목적"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="group-desc">설명(선택)</Label>
            <Input
              id="group-desc"
              value={description ?? ""}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>취소</DialogClose>
          <Button type="button" onClick={submit} disabled={pending}>
            {pending ? "저장 중…" : "저장"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 5: 옵션 다이얼로그 작성**

`src/features/manage-tag-taxonomy/ui/option-dialog.tsx`:
```tsx
"use client";

import { useState } from "react";
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
import type { TagOption } from "@/entities/tag";
import { useCreateOption, useUpdateOption } from "../api/use-tag-taxonomy-mutations";

export function OptionDialog({
  open,
  onOpenChange,
  groupId,
  option,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  groupId: string;
  option?: TagOption;
}) {
  const isEdit = !!option;
  const create = useCreateOption();
  const update = useUpdateOption();
  const [code, setCode] = useState(option?.code ?? "");
  const [label, setLabel] = useState(option?.label ?? "");
  const [description, setDescription] = useState(option?.description ?? "");
  const pending = create.isPending || update.isPending;

  function submit() {
    if (!label.trim()) {
      toast.error("이름을 입력하세요");
      return;
    }
    const desc = description.trim() || null;
    if (option) {
      // `option` 진리값으로 분기해야 TS가 option을 정의됨으로 좁힌다.
      update.mutate(
        { id: option.id, input: { label: label.trim(), description: desc } },
        {
          onSuccess: () => {
            toast.success("항목을 수정했습니다");
            onOpenChange(false);
          },
          onError: () => toast.error("수정에 실패했습니다"),
        },
      );
    } else {
      if (!code.trim()) {
        toast.error("코드를 입력하세요");
        return;
      }
      create.mutate(
        { groupId, code: code.trim(), label: label.trim(), description: desc },
        {
          onSuccess: () => {
            toast.success("항목을 추가했습니다");
            onOpenChange(false);
            setCode("");
            setLabel("");
            setDescription("");
          },
          onError: () => toast.error("추가에 실패했습니다(코드 중복일 수 있어요)"),
        },
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "항목 수정" : "항목 추가"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {!isEdit && (
            <div className="space-y-1.5">
              <Label htmlFor="opt-code">코드(고정키)</Label>
              <Input
                id="opt-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="proposal"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="opt-label">이름</Label>
            <Input
              id="opt-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="제안"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="opt-desc">설명(선택)</Label>
            <Input
              id="opt-desc"
              value={description ?? ""}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>취소</DialogClose>
          <Button type="button" onClick={submit} disabled={pending}>
            {pending ? "저장 중…" : "저장"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 6: 옵션 행 작성**

`src/features/manage-tag-taxonomy/ui/option-row.tsx`:
```tsx
"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { TagOption } from "@/entities/tag";
import { Button } from "@/shared/ui/button";
import { useDeleteOption } from "../api/use-tag-taxonomy-mutations";
import { OptionDialog } from "./option-dialog";
import { ConfirmDialog } from "./confirm-dialog";

export function OptionRow({ option }: { option: TagOption }) {
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const del = useDeleteOption();

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm">{option.label}</span>
          <span className="text-muted-foreground font-mono text-xs">{option.code}</span>
        </div>
        {option.description && (
          <p className="text-muted-foreground truncate text-xs">{option.description}</p>
        )}
      </div>
      <div className="flex shrink-0 gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setEditOpen(true)}
          aria-label="항목 수정"
        >
          <Pencil />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setDelOpen(true)}
          aria-label="항목 삭제"
        >
          <Trash2 />
        </Button>
      </div>

      <OptionDialog open={editOpen} onOpenChange={setEditOpen} groupId={option.groupId} option={option} />
      <ConfirmDialog
        open={delOpen}
        onOpenChange={setDelOpen}
        title={`'${option.label}' 항목을 삭제할까요?`}
        description="이 항목이 선택된 시안의 태그 기록도 함께 삭제됩니다."
        onConfirm={() =>
          del.mutate(option.id, {
            onSuccess: () => {
              toast.success("항목을 삭제했습니다");
              setDelOpen(false);
            },
            onError: () => toast.error("삭제에 실패했습니다"),
          })
        }
        pending={del.isPending}
      />
    </div>
  );
}
```

- [ ] **Step 7: 그룹 카드 작성**

`src/features/manage-tag-taxonomy/ui/group-card.tsx`:
```tsx
"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { TagGroupWithOptions } from "@/entities/tag";
import { Button } from "@/shared/ui/button";
import { useDeleteGroup } from "../api/use-tag-taxonomy-mutations";
import { GroupDialog } from "./group-dialog";
import { OptionDialog } from "./option-dialog";
import { OptionRow } from "./option-row";
import { ConfirmDialog } from "./confirm-dialog";

export function GroupCard({ group }: { group: TagGroupWithOptions }) {
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const del = useDeleteGroup();

  return (
    <div className="bg-card ring-foreground/10 rounded-xl ring-1">
      <div className="border-border/60 flex items-start justify-between gap-3 border-b p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium">{group.label}</h3>
            <span className="text-muted-foreground font-mono text-xs">{group.code}</span>
          </div>
          {group.description && (
            <p className="text-muted-foreground mt-0.5 text-xs">{group.description}</p>
          )}
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setEditOpen(true)}
            aria-label="구분 수정"
          >
            <Pencil />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setDelOpen(true)}
            aria-label="구분 삭제"
          >
            <Trash2 />
          </Button>
        </div>
      </div>

      <div className="divide-border/60 divide-y">
        {group.options.map((opt) => (
          <OptionRow key={opt.id} option={opt} />
        ))}
        {group.options.length === 0 && (
          <p className="text-muted-foreground px-4 py-3 text-xs">항목이 없습니다.</p>
        )}
      </div>

      <div className="p-3">
        <Button type="button" variant="outline" size="sm" onClick={() => setAddOpen(true)}>
          <Plus />
          항목 추가
        </Button>
      </div>

      <GroupDialog open={editOpen} onOpenChange={setEditOpen} group={group} />
      <OptionDialog open={addOpen} onOpenChange={setAddOpen} groupId={group.id} />
      <ConfirmDialog
        open={delOpen}
        onOpenChange={setDelOpen}
        title={`'${group.label}' 구분을 삭제할까요?`}
        description="이 구분의 모든 항목과, 항목이 선택된 시안의 태그 기록도 함께 삭제됩니다."
        onConfirm={() =>
          del.mutate(group.id, {
            onSuccess: () => {
              toast.success("구분을 삭제했습니다");
              setDelOpen(false);
            },
            onError: () => toast.error("삭제에 실패했습니다"),
          })
        }
        pending={del.isPending}
      />
    </div>
  );
}
```

- [ ] **Step 8: feature 배럴 작성**

`src/features/manage-tag-taxonomy/index.ts`:
```ts
export { GroupCard } from "./ui/group-card";
export { GroupDialog } from "./ui/group-dialog";
```

- [ ] **Step 9: 관리자 페이지 작성**

`src/pages/admin-tags/ui/admin-tags-page.tsx`:
```tsx
"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { tagQueries } from "@/entities/tag";
import { GroupCard, GroupDialog } from "@/features/manage-tag-taxonomy";
import { PageHeader } from "@/widgets/studio-shell";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";

export function AdminTagsPage() {
  const { data, isPending, isError } = useQuery(tagQueries.taxonomy());
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="태그 설정" description="시안에 태깅할 구분과 항목을 관리합니다." />

      <div className="mb-4 flex justify-end">
        <Button type="button" onClick={() => setAddOpen(true)}>
          <Plus />
          구분 추가
        </Button>
      </div>

      {isPending && (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      )}
      {isError && <p className="text-destructive text-sm">태그 분류를 불러오지 못했습니다.</p>}
      {data && data.length === 0 && (
        <p className="text-muted-foreground text-sm">아직 구분이 없습니다. ‘구분 추가’로 시작하세요.</p>
      )}
      {data && data.length > 0 && (
        <div className="space-y-4">
          {data.map((g) => (
            <GroupCard key={g.id} group={g} />
          ))}
        </div>
      )}

      <GroupDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
```

- [ ] **Step 10: pages 배럴 + app 라우트 작성**

`src/pages/admin-tags/index.ts`:
```ts
export { AdminTagsPage } from "./ui/admin-tags-page";
```

`app/studio/tags/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import { getProfile } from "@/shared/auth/guards.server";
import { isAdmin, type Role } from "@/shared/auth/roles";
import { AdminTagsPage } from "@/pages/admin-tags";

export default async function Page() {
  const profile = await getProfile();
  if (!profile || !isAdmin(profile.role as Role)) redirect("/studio");
  return <AdminTagsPage />;
}
```

- [ ] **Step 11: 타입 체크 + 빌드 확인**

Run: `npx tsc --noEmit && npm run lint`
Expected: 에러 없음.

- [ ] **Step 12: 커밋**

```bash
git add src/features/manage-tag-taxonomy src/pages/admin-tags "app/studio/tags"
git commit -m "feat(tags): 관리자 태그 설정 페이지(구분·항목 CRUD)"
```

---

### Task 9: 작업자 태깅 탭 (assign-proposal-tags 피처 + 상세 탭 연동)

**Files:**
- Create: `src/features/assign-proposal-tags/api/put-proposal-tags.ts`
- Create: `src/features/assign-proposal-tags/api/use-save-proposal-tags.ts`
- Create: `src/features/assign-proposal-tags/ui/proposal-tags-panel.tsx`
- Create: `src/features/assign-proposal-tags/index.ts`
- Modify: `src/pages/proposal-detail/ui/section-nav.tsx`
- Modify: `src/pages/proposal-detail/ui/proposal-detail-page.tsx`

**Interfaces:**
- Consumes: `tagQueries.taxonomy()` + `tagQueries.proposal(id)`(Task 4), `PUT /api/proposals/[id]/tags`(Task 6).
- Produces: `ProposalTagsPanel`(feature 배럴), `SectionId`에 `"tags"` 추가, 상세페이지 `?tab=tags` 렌더.

- [ ] **Step 1: http 래퍼 작성**

`src/features/assign-proposal-tags/api/put-proposal-tags.ts`:
```ts
import { http } from "@/shared/api/http";

export function putProposalTags(proposalId: string, optionIds: string[]): Promise<void> {
  return http<void>(`/api/proposals/${proposalId}/tags`, {
    method: "PUT",
    body: JSON.stringify({ optionIds }),
  });
}
```

- [ ] **Step 2: 저장 훅 작성**

`src/features/assign-proposal-tags/api/use-save-proposal-tags.ts`:
```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { tagQueries } from "@/entities/tag";
import { putProposalTags } from "./put-proposal-tags";

export function useSaveProposalTags(proposalId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (optionIds: string[]) => putProposalTags(proposalId, optionIds),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: tagQueries.proposal(proposalId).queryKey }),
  });
}
```

- [ ] **Step 3: 태깅 패널 작성**

`src/features/assign-proposal-tags/ui/proposal-tags-panel.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { tagQueries } from "@/entities/tag";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";
import { cn } from "@/shared/lib/utils";
import { useSaveProposalTags } from "../api/use-save-proposal-tags";

export function ProposalTagsPanel({ proposalId }: { proposalId: string }) {
  const taxonomy = useQuery(tagQueries.taxonomy());
  const current = useQuery(tagQueries.proposal(proposalId));
  const save = useSaveProposalTags(proposalId);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  // 서버 선택값이 로드/갱신되면 로컬 선택 상태를 동기화한다.
  useEffect(() => {
    if (current.data) setSelected(new Set(current.data.optionIds));
  }, [current.data]);

  if (taxonomy.isPending || current.isPending) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    );
  }
  if (taxonomy.isError || current.isError || !current.data) {
    return <p className="text-destructive text-sm">태그 정보를 불러오지 못했습니다.</p>;
  }
  if (taxonomy.data.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        등록된 태그 분류가 없습니다. 관리자에게 문의하세요.
      </p>
    );
  }

  const baseline = new Set(current.data.optionIds);
  const dirty =
    selected.size !== baseline.size || [...selected].some((id) => !baseline.has(id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSave() {
    save.mutate([...selected], {
      onSuccess: () => toast.success("태그를 저장했습니다"),
      onError: () => toast.error("태그 저장에 실패했습니다"),
    });
  }

  return (
    <div className="space-y-5">
      {taxonomy.data.map((group) => (
        <div key={group.id} className="bg-card ring-foreground/10 rounded-xl p-4 ring-1 sm:p-5">
          <div className="mb-3">
            <h3 className="text-sm font-medium">{group.label}</h3>
            {group.description && (
              <p className="text-muted-foreground mt-0.5 text-xs">{group.description}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {group.options.map((opt) => {
              const on = selected.has(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  title={opt.description ?? undefined}
                  aria-pressed={on}
                  onClick={() => toggle(opt.id)}
                  className={cn(
                    "cursor-pointer rounded-full border px-3 py-1.5 text-sm transition-colors",
                    on
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:bg-muted",
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
            {group.options.length === 0 && (
              <span className="text-muted-foreground text-xs">항목 없음</span>
            )}
          </div>
        </div>
      ))}

      <div className="flex items-center justify-end gap-3">
        {dirty && <span className="text-muted-foreground text-xs">저장되지 않은 변경사항</span>}
        <Button type="button" onClick={handleSave} disabled={!dirty || save.isPending}>
          {save.isPending ? "저장 중…" : "저장"}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: feature 배럴 작성**

`src/features/assign-proposal-tags/index.ts`:
```ts
export { ProposalTagsPanel } from "./ui/proposal-tags-panel";
```

- [ ] **Step 5: section-nav에 "tags" 탭 추가**

`src/pages/proposal-detail/ui/section-nav.tsx` 수정 — import에 `Tag` 추가, `SectionId`·`SECTIONS` 확장:
```tsx
import { Layers, Settings, Tag } from "lucide-react";
```
```ts
export type SectionId = "settings" | "variants" | "tags";

const SECTIONS = [
  { id: "settings", label: "사이트설정", icon: Settings },
  { id: "variants", label: "시안설정", icon: Layers },
  { id: "tags", label: "시안태그관리", icon: Tag },
] as const;
```
(나머지 컴포넌트 본문은 그대로 — `SECTIONS.map`이 새 항목을 자동 렌더한다.)

- [ ] **Step 6: 상세페이지에 tags 탭 연동**

`src/pages/proposal-detail/ui/proposal-detail-page.tsx` 수정:

(a) import 추가:
```tsx
import { ProposalTagsPanel } from "@/features/assign-proposal-tags";
```
(b) `useQueryState`의 enum에 `"tags"` 추가:
```tsx
  const [tab, setTab] = useQueryState(
    "tab",
    parseAsStringEnum(["settings", "variants", "tags"] as const)
      .withDefault("settings")
      .withOptions({ history: "push" }),
  );
```
(c) `{tab === "variants" && (...)}` 블록 바로 뒤에 태그 탭 렌더 추가:
```tsx
          {tab === "tags" && (
            <section>
              <ProposalTagsPanel proposalId={proposal.id} />
            </section>
          )}
```

- [ ] **Step 7: 타입 체크 + 린트**

Run: `npx tsc --noEmit && npm run lint`
Expected: 에러 없음.

- [ ] **Step 8: 커밋**

```bash
git add src/features/assign-proposal-tags src/pages/proposal-detail/ui/section-nav.tsx src/pages/proposal-detail/ui/proposal-detail-page.tsx
git commit -m "feat(tags): 시안 상세 시안태그관리 탭(그룹별 칩 다중선택)"
```

---

### Task 10: 통합 검증 + 수동 E2E

**Files:** (없음 — 검증 전용)

**Interfaces:**
- Consumes: Task 1–9 전부.

- [ ] **Step 1: 전체 테스트**

Run: `npm run test`
Expected: 전부 PASS(신규 tag 테스트 + nav-config 포함).

- [ ] **Step 2: 린트 + 타입 + 빌드**

Run: `npm run lint && npx tsc --noEmit && npm run build`
Expected: 에러 없음.

- [ ] **Step 3: 포맷 확인**

Run: `npm run format:check`
Expected: 통과(실패 시 `npm run format` 후 재확인·커밋).

- [ ] **Step 4: 수동 E2E (dev 서버 — `npm run dev`)**

관리자(admin) 계정으로:
- [ ] `/studio` 좌측 GNB에 "태그 설정" 노출 → 클릭 시 `/studio/tags`에 6개 구분 + 항목 표시.
- [ ] 구분 추가/수정/삭제 동작(삭제 시 경고 문구 노출, 확인 후 목록에서 사라짐).
- [ ] 항목 추가/수정/삭제 동작. 같은 그룹에 중복 코드 추가 시 실패 토스트.
- [ ] 시안 상세(`/studio/proposals/<id>`) 좌측 탭에 "시안태그관리" 노출 → `?tab=tags`.
- [ ] 칩 다중 토글 → [저장] → 새로고침 후에도 선택 유지. 미변경 시 [저장] 비활성.
- [ ] 선택된 항목을 `/studio/tags`에서 삭제 → 상세 태그 탭에서 해당 칩이 사라짐(CASCADE 확인).

editor 계정으로:
- [ ] GNB에 "태그 설정" **미노출**, `/studio/tags` 직접 접근 시 `/studio`로 리다이렉트.
- [ ] 시안 상세 "시안태그관리" 탭에서 태깅·저장 **가능**.

- [ ] **Step 5: 최종 정리 커밋(필요 시)**

```bash
git add -A
git commit -m "chore(tags): 포맷/정리"
```

---

## 검증 노트 (TDD 범위)

- **순수 로직·스키마는 TDD**: `diffSelection`(Task 3), zod 스키마(Task 3), 스키마 구조(Task 1), nav-config(Task 7) — 모두 vitest로 선검증.
- **I/O 글루(서버 fn·라우트·UI)**: 이 레포 관행대로 `tsc`/`lint`/`build` + 수동 E2E로 검증. PUT 저장의 핵심 분기(추가/삭제/무변경)는 `diffSelection` 단위 테스트로 이미 보장된다.

