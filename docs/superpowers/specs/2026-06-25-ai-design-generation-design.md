# AI 시안 생성 설계 (`/studio/ai-designs`)

작성일: 2026-06-25

## 배경 / 목표

스튜디오에 **관리자 전용** "AI 시안 생성" 메뉴를 신설한다. 관리자가 기초 정보(회사명·페이지 유형·태그·추가 요청)를
입력하면, 우리 DB의 기존 시안 중 **태그가 일치하는 참고 이미지**를 최대 10개 추출하고, 그 입력과 이미지들을
Anthropic API(Claude, vision)에 넘겨 **완결형 단일 HTML 문자열**로 된 시안을 생성한다. 생성된 HTML은 전용
테이블에 저장하고, 작업중 → 완료 상태를 거쳐 **raw HTML 전용 뷰어**(기존 시안 뷰어와 별개)로 열어볼 수 있게 한다.
생성 결과는 삭제할 수 있다.

이것은 기존 시안 시스템(이미지 업로드 기반)과 별개의 **AI 생성 시안** 도메인이다. 기존 태그 시스템
([[proposal-tag-system]])과 `proposals` 공개 버킷([[proposals-bucket-public]])을 참고 자료원으로 재사용한다.

## 확정된 결정 사항

- **접근 권한**: 관리자(ADMIN) 전용. 메뉴 노출은 `nav-config`의 `adminOnly`, 실제 가드는 페이지의 서버
  `isAdmin` redirect + API의 `requireAdmin()`. (메뉴 숨김은 가드가 아니다 — 서버 가드가 진짜 방어선.)
- **모델**: 기본값 `claude-sonnet-4-6` (Sonnet 4.6). `ANTHROPIC_MODEL` 환경변수로 언제든 교체 가능.
  정확한 모델 ID·`max_tokens`·이미지 블록 포맷·vision 제약은 **구현 직전 `claude-api` 스킬로 확정**한다(추측 금지).
- **참고 이미지 범위**: **전체 시안**(노출 여부 무관)에서 태그 매칭. 선택 이미지의 공개 URL이 Anthropic으로 전송됨.
- **태그 매칭**: **느슨 매칭 + 매칭수 정렬**. 선택 태그 중 하나라도 일치하면 후보, 많이 일치한 순으로 최대 10개.
  항상 결과가 나오도록 한다(0건 허용).
- **비동기 실행 (Vercel Workflows)**: 생성 요청은 행을 `working`으로 INSERT 후
  `start(generateAiDesignWorkflow, [id])`로 **durable 워크플로우를 트리거하고 201 반환**. 워크플로우의 step들이
  참고 이미지 추출 → Claude 호출 → 행 갱신을 수행한다. 클라이언트는 우리 `ai_designs` 행을 폴링한다
  (워크플로우 run id는 사용하지 않음 — 행이 단일 진실원천). `workflow` 패키지(`npm i workflow`),
  `next.config.ts`를 `withWorkflow()`로 래핑, `tsconfig` 플러그인이 필요. (배포 타깃 = Vercel.)
- **durable/재시도**: Workflows는 배포·크래시를 deterministic replay로 견디고, `'use step'`은 실패 시 자동 재시도.
  최종 실패는 워크플로우의 try/catch에서 `markFailed` step으로 행을 `failed`로 표기. 사용자용 **재시도** 버튼은
  `failed` 행에 대해 워크플로우를 재트리거한다. (롱러닝 서버 가정/`after()`/stale 타임아웃은 Workflows가
  durability를 담당하므로 불필요. stale 표시는 선택적 백스톱으로만 둘 수 있음.)
- **뷰어**: 관리자 전용 **raw HTML route**(`text/html` 반환)를 새 탭으로 연다. 기존 React 캔버스 뷰어와 별개.
- **저장 위치**: 생성 HTML은 `ai_designs.html`(text 컬럼)에 인라인 저장.
- **태그 저장**: `proposal_tags`와 동일한 정션 테이블(`ai_design_tags`)로 선택 태그를 보존.
- **네임스페이스**: 기존 관례대로 `/studio/ai-designs`(페이지) + `/api/admin/ai-designs`(API).

> 모든 경로는 `d:\project\git\uxis-live-design` 기준. import alias: `@/*` → `./src/*`, `@drizzle/*` → `./drizzle/*`.

---

## 1. 전체 데이터 흐름

```
[생성하기 모달 제출]
  └─ POST /api/admin/ai-designs            (requireAdmin)
       ├─ zod 검증 (title, company?, pageType, optionIds[], extraNotes?)
       ├─ ai_designs INSERT (status='working', html=null, model=<env>)
       ├─ ai_design_tags INSERT (선택 optionId들)
       ├─ start(generateAiDesignWorkflow, [id])   ← durable 워크플로우 트리거 (await, 즉시 반환)
       └─ 새 행(DTO) 201 반환

  (Vercel Workflow)  generateAiDesignWorkflow(id)        'use workflow'
       try {
         ├─ step resolveAiDesignReferences(id) → { input, imageUrls(≤10) }
         ├─ step generateAiDesignHtml(input, imageUrls) → html
         │        (Claude Sonnet 4.6 · vision · streaming · 자동 재시도)
         └─ step markAiDesignDone(id, html, model)   → status='done'
       } catch (e) {
         └─ step markAiDesignFailed(id, message)      → status='failed'
       }

[목록 화면]
  - react-query 목록 조회. 'working' 행이 하나라도 있으면 refetchInterval 폴링.
  - 'done'   → "뷰어 열기" → /studio/ai-designs/[id]/raw 새 탭 (raw HTML)
  - 'failed' → "재시도"(워크플로우 재트리거) · 각 행 "삭제"
```

- **Workflows = durable**: 배포·크래시를 deterministic replay로 견딤. `'use step'`은 외부 호출 단위로 자동 재시도,
  step 실행 중 워크플로우는 리소스 없이 suspend. Vercel Functions가 step을 실행하고 Vercel Queues가 신뢰성을 보장.
- **상태 추적**: 워크플로우 run-id 기반 조회 API는 사용하지 않는다. step들이 우리 `ai_designs` 행을 갱신하고
  UI는 그 행을 폴링(단일 진실원천). 관측은 Vercel 대시보드(Observability → Workflows).
- **트리거**: `import { start } from "workflow/api"` → `await start(generateAiDesignWorkflow, [id])` (run id 미반환,
  fire-and-forget). `next.config.ts`를 `workflow/next`의 `withWorkflow()`로 래핑해야 동작.
- **step duration**: 각 step은 격리된 Vercel Function 라우트로 컴파일 → 그 함수의 max duration 제한을 받는다.
  Claude 생성 step이 수십 초~수 분일 수 있으므로 함수 maxDuration을 넉넉히(예: 300s+, Fluid면 더) 설정한다
  (구현 시 SDK의 step 타임아웃/설정 및 Vercel 함수 설정 방법을 확인 — §12).

---

## 2. DB 스키마 (Drizzle, 마이그레이션 0019)

Drizzle ORM + postgres-js, **schema-first**. 스키마 파일은 컬럼만, **FK/CASCADE/RLS는 SQL 마이그레이션에**
손으로 추가(레포 관례). 기존 idiom: `uuid("id").primaryKey().defaultRandom()`,
`timestamp(..., { withTimezone: true }).defaultNow()`, enum은 PG enum 대신 `check()` 제약.

### `drizzle/schema.ts` 추가

```ts
export const aiDesigns = pgTable("ai_designs", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),                 // 제목(회사명)
  company: text("company"),                        // 회사명 별도 보관(선택; title과 합칠 수도)
  pageType: text("page_type").notNull(),           // 'main' | 'dashboard' | 'subpage'
  extraNotes: text("extra_notes"),                 // 자유 추가 요청사항
  status: text("status").notNull().default("working"), // 'working' | 'done' | 'failed'
  html: text("html"),                              // 완료 시 채워짐
  errorMessage: text("error_message"),
  model: text("model"),                            // 사용 모델 id 기록(감사용)
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (t) => [
  check("ai_designs_page_type_chk", sql`${t.pageType} in ('main','dashboard','subpage')`),
  check("ai_designs_status_chk", sql`${t.status} in ('working','done','failed')`),
]);

export const aiDesignTags = pgTable("ai_design_tags", {
  aiDesignId: uuid("ai_design_id").notNull(),
  optionId: uuid("option_id").notNull(),
}, (t) => [
  primaryKey({ columns: [t.aiDesignId, t.optionId] }),
]);

export type AiDesign = typeof aiDesigns.$inferSelect;
```

> `company`는 별도 보관할지 `title`에 합칠지는 구현 시 모달 UX에 맞춰 결정(둘 다 받되 title 필수, company 선택).

### 마이그레이션

1. `npm run db:generate` → `0019_*.sql` 생성
2. 생성 SQL에 **손으로 추가** (`0015_proposal_tags.sql` 스타일 그대로):
   - FK: `ai_design_tags.ai_design_id → ai_designs(id) ON DELETE cascade`
   - FK: `ai_design_tags.option_id → tag_options(id) ON DELETE cascade`
   - FK: `ai_designs.created_by → profiles(id) ON DELETE set null`
   - 두 테이블 모두 `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY`
3. `npm run db:migrate` (Node ≥22 필요 — [[phase1b-db-reconciliation]])

`db` 싱글톤은 `@/shared/db`에서 import.

---

## 3. 메뉴 · 라우팅 · 관리자 가드

- **`src/widgets/studio-shell/model/nav-config.ts`**: lucide 아이콘(`Sparkles`) import 후 `NAV_ITEMS`에 추가
  ```ts
  { href: "/studio/ai-designs", label: "AI 시안 생성", icon: Sparkles, adminOnly: true },
  ```
  active 상태/role 필터(`visibleNavItems(role)`, `matchNav`)는 사이드바가 이미 처리.
- **`app/studio/ai-designs/page.tsx`** (thin, server): `app/studio/tags/page.tsx` 가드 패턴 복제
  ```ts
  const profile = await getProfile();           // @/shared/auth/guards.server
  if (!profile || !isAdmin(profile.role as Role)) redirect("/studio");
  // 재export 또는 컴포넌트 렌더
  ```
  (editor 가드는 `app/studio/layout.tsx`가 전역 적용, admin 가드는 이 페이지에서.)
- **`src/pages/ai-designs/index.ts`** + **`src/pages/ai-designs/ui/ai-designs-page.tsx`** (`"use client"`).
  `src/pages/admin-tags`/`proposals-list` 패턴 미러링.
- API 서버 함수: `src/entities/ai-design/api/*.server.ts`, 각 함수 진입 시 `requireAdmin()` 우선 호출.

---

## 4. 목록 화면 (`src/pages/ai-designs`)

- `PageHeader`(`@/widgets/studio-shell`) 제목 + 우측 상단 **"생성하기"** 버튼(모달 오픈).
- 리스트(카드 또는 테이블): 제목/회사명, 페이지 유형 뱃지, 태그 칩, **상태**(working=스피너 "작업중" / done / failed),
  생성일.
- 행 액션: **뷰어 열기**(`status==='done'`), **재시도**(`status==='failed'` → 워크플로우 재트리거), **삭제**.
- 데이터: `@tanstack/react-query` + `nuqs`(이미 deps). `working` 행이 있으면 `refetchInterval`(예: 3~5초)로 폴링,
  전부 종료되면 폴링 중단.
- (선택 백스톱) Workflows가 durability를 담당하므로 stale 타임아웃은 필수가 아니다. 원하면
  `status==='working' && now - updated_at > STALE_MS`를 "지연" 표기로만 추가할 수 있다.

---

## 5. 생성하기 모달

UI 프리미티브: `@base-ui/react` + shadcn. **주의**([[base-ui-button-submit-type]]): Base UI `Button`은 기본
`type="button"` → 제출 버튼에 `type="submit"` 명시.

필드:

1. **제목(회사명)** — 텍스트, 필수. (title 필수; company 선택 입력 — 구현 시 단일/분리 확정)
2. **페이지 유형** — 단일 선택, 필수. 3개의 **시각 카드 + 예시 썸네일**. 썸네일은 외부 이미지 의존 없이
   **손수 그린 인라인 SVG 와이어프레임 목업**:
   - **메인**: 상단 히어로 + 카드 섹션 + CTA 라인
   - **대시보드**: 좌측 사이드바 + 상단 KPI 카드 + 차트/표 그리드
   - **서브페이지**: 헤더 + 본문(좌) + 사이드(우) 구조
   카드 = 썸네일 + 라벨 + 1줄 설명. 선택 시 강조 테두리.
3. **참고 태그** — 다중 선택 칩(그룹별 섹션). 기존 태그 그룹 중 **생성에 유용한 그룹만 선별 노출**:
   기본 후보 **분야(field) · 스타일(style) · 타겟(target) · 구조(structure)**. (정확한 그룹 `code`는 시드 데이터
   `0016_seed_tags.sql`에 맞춰 구현 시 확정. 화이트리스트 상수로 관리.) 태그 옵션은 기존 태그 조회 API/엔티티 재사용.
4. **추가 요청사항** — 자유 텍스트(textarea), 선택. "기타" 항목.

제출 페이로드 예: `{ title, company?, pageType, optionIds: string[], extraNotes? }`. zod 스키마로 검증
(`pageType` enum, `optionIds` uuid 배열).

페이지 유형은 매칭에도 활용: 가능하면 `main/dashboard/subpage`를 `screen` 태그 그룹의 옵션 코드로 매핑해
참고 이미지 쿼리에 함께 넣는다(매핑 불가하면 프롬프트 컨텍스트로만 사용).

---

## 6. 참고 이미지 추출 (`src/entities/ai-design/api/get-tag-matched-images.server.ts`)

`import "server-only"`, `db`(`@/shared/db`), 스키마(`@drizzle/schema`), drizzle helper(`eq/inArray/sql/asc`).
선택 `optionId`들(+페이지유형 매핑 코드)로 **전체 시안 대상, 느슨 매칭 + 매칭수 정렬**:

1. `proposal_tags`에서 `inArray(optionId, selected)` → `proposalId` GROUP BY, `COUNT(*)` desc 정렬, `limit(10)`.
2. 각 시안 커버 이미지 해석: `proposalVariants → proposalVersions(currentVersionId) → proposalPages(pageOrder=0)`의
   `storagePath`. 조립 패턴은 `src/entities/proposal/api/get-viewer-variants.server.ts` /
   `get-public-proposals.server.ts` 참고.
3. `publicUrl(storagePath)`(`src/shared/lib/proposals/constants.ts`)로 영구 공개 URL 생성 →
   Anthropic `image_url`(URL source) 블록에 그대로 사용(서명 불필요, `proposals` 버킷 public).

반환: `{ proposalId, title?, url }[]` (프롬프트에 출처 맥락을 줄 수 있게 title 동봉 가능).

---

## 7. Anthropic 생성 (Workflow step) + 워크플로우 오케스트레이션

생성 로직은 Vercel Workflow의 step들로 구성한다. `'use step'`은 격리된 라우트로 컴파일되어 자동 재시도되고,
오케스트레이터(`'use workflow'`)는 deterministic replay로 배포/크래시를 견딘다.

**파일 배치**
- `src/entities/ai-design/workflow/generate-ai-design.workflow.ts` — `'use workflow'` 오케스트레이터.
- step들은 `src/entities/ai-design/workflow/steps.ts`(각 함수에 `'use step'`)로 두고, 실제 로직은 기존
  `.server.ts`(server-only) 모듈을 호출하는 얇은 래퍼로 둔다.

**Claude 호출 (`claude-api` 스킬로 확정한 설정 — 추측 아님)**
- SDK: `@anthropic-ai/sdk`(TS). 클라이언트는 `new Anthropic()`(env `ANTHROPIC_API_KEY` 자동 인식).
- 모델: env `ANTHROPIC_MODEL` 기본 `claude-sonnet-4-6`.
- thinking: `{ type: "adaptive" }`(4.6는 adaptive; `budget_tokens` 사용 금지). `output_config: { effort: "medium" }`(조절 가능).
- **스트리밍 필수**: HTML이 길어 `max_tokens`가 크므로(Sonnet 4.6 최대 64K) `client.messages.stream({ max_tokens: 64000, ... }).finalMessage()`로 호출(요청 타임아웃 회피).
- vision: 참고 이미지는 `{ type: "image", source: { type: "url", url } }` 블록으로 첨부(공개 URL 그대로, 서명 불필요).
- 메시지: 시스템 = 역할(시니어 웹 디자이너/프론트엔드) + **출력 형식 = 완결형 단일 HTML 문서 문자열만**(설명/마크다운 금지,
  인라인 CSS 권장, 외부 스크립트/네트워크 의존 최소화). 사용자 = 제목/회사명·페이지유형·선택 태그(라벨)·추가 요청 +
  이미지 URL 블록(최대 10).
- 응답에서 HTML 본문만 추출(코드펜스 제거).

**워크플로우 흐름** (§1 다이어그램과 동일)
1. `resolveAiDesignReferences(id)` step → 행/태그 로드 + `getTagMatchedImages` → `{ input, imageUrls }`.
2. `generateAiDesignHtml(input, imageUrls)` step → Claude 호출 → `html`. (transient 실패는 step 자동 재시도.)
3. `markAiDesignDone(id, html, model)` step → `status='done'`.
4. 위 try가 실패하면 catch에서 `markAiDesignFailed(id, message)` step → `status='failed'` + `error_message`.

**트리거**: `import { start } from "workflow/api"`; `POST` 핸들러가 행 INSERT 후
`await start(generateAiDesignWorkflow, [id])`(run id 미반환). 재시도 버튼도 같은 `start(...)`를 재호출(행을 `working`으로 되돌린 뒤).

API 라우트(`app/api/admin/ai-designs/route.ts` 등)는 thin: `try { return Response.json(await fn(...), {status}) }
catch (e) { return toErrorResponse(e) }`. 에러 매핑은 `src/shared/api/to-error-response.ts`
(`FORBIDDEN`→403, `NOT_FOUND`→404, ZodError→400, `RATE_LIMITED`→429).

**설정**: `next.config.ts`를 `withWorkflow()`(`workflow/next`)로 래핑, `tsconfig.json`에 `{ "name": "workflow" }`
플러그인 추가, proxy/middleware matcher가 `.well-known/workflow/`를 제외하도록 함. step Claude 호출이 길 수 있으니
Vercel 함수 maxDuration을 넉넉히 설정(§12에서 정확한 설정 위치 확인).

---

## 8. Raw HTML 뷰어

- **`app/studio/ai-designs/[id]/raw/route.ts`** — `GET`, `requireAdmin()`, 행 로드(없으면 404, html 없으면 409/안내),
  `new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } })`.
- Next 16 dynamic params는 Promise: `{ params }: { params: Promise<{ id: string }> }` → `const { id } = await params;`.
- 목록의 "뷰어 열기"가 이 URL을 **새 탭**으로 연다(`target="_blank"`). 기존 시안 뷰어(React 캔버스, `/p/[publicId]`)와
  완전 별개의 "raw HTML만 렌더".
- 보안: 관리자 전용 + 동일 출처. 생성 HTML에 스크립트가 끼는 경우를 대비해 **제한적 CSP 헤더**(인라인 스타일 허용,
  외부/스크립트 차단) 적용 검토. 시안 목업은 보통 정적이라 무방.

---

## 9. 삭제

- **`DELETE /api/admin/ai-designs/[id]`** → `requireAdmin()` → `ai_designs` 행 삭제(`ai_design_tags`는 FK CASCADE).
- 목록에서 확인 후 삭제(react-query invalidate).

---

## 10. 파일 추가/변경 요약

신규:
- `drizzle/schema.ts`(편집: `aiDesigns`, `aiDesignTags`, 타입)
- `drizzle/migrations/0019_*.sql`(생성 후 손 편집)
- `app/studio/ai-designs/page.tsx`
- `app/studio/ai-designs/[id]/raw/route.ts`
- `app/api/admin/ai-designs/route.ts`(POST 생성 + GET 목록)
- `app/api/admin/ai-designs/[id]/route.ts`(DELETE)
- `src/pages/ai-designs/index.ts`, `src/pages/ai-designs/ui/ai-designs-page.tsx`
- `src/pages/ai-designs/ui/create-ai-design-modal.tsx`(또는 features/)
- `src/pages/ai-designs/ui/page-type-cards.tsx`(SVG 썸네일)
- `src/entities/ai-design/api/create-ai-design.server.ts`
- `src/entities/ai-design/api/list-ai-designs.server.ts`
- `src/entities/ai-design/api/delete-ai-design.server.ts`
- `src/entities/ai-design/api/get-tag-matched-images.server.ts`
- `src/entities/ai-design/api/generate-html.server.ts`(Claude 호출 로직, server-only)
- `src/entities/ai-design/api/generation-mutations.server.ts`(markDone/markFailed/resolveReferences server-only)
- `src/entities/ai-design/workflow/generate-ai-design.workflow.ts`(`'use workflow'`)
- `src/entities/ai-design/workflow/steps.ts`(`'use step'` 래퍼들)
- `src/entities/ai-design/model/*.ts`(타입/zod 스키마)
- `.env.example`(편집: `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`)

변경:
- `src/widgets/studio-shell/model/nav-config.ts`(메뉴 1줄)
- `package.json`(추가: `@anthropic-ai/sdk`, `workflow`)
- `next.config.ts`(`withWorkflow()` 래핑)
- `tsconfig.json`(`plugins: [{ "name": "workflow" }]`)
- `proxy.ts`/미들웨어 matcher(`.well-known/workflow/` 제외) — 기존 매처가 있으면 거기에 반영
- `vercel.json`(신규 또는 편집: step 함수 maxDuration) — §12에서 확정

---

## 11. 테스트 / 검증

- 태그 매칭 쿼리(매칭수 정렬·limit 10·느슨 매칭) 단위 테스트.
- `nav-config` admin 노출 테스트(기존 `tests/widgets/studio-shell/nav-config.test.ts` 패턴).
- 생성 서버 함수 테스트: Anthropic SDK 호출 모킹 → done/failed 상태 전이 검증.
- 수동 E2E: DB 데이터가 적을 수 있으니 부트스트랩 관리자/시드 필요할 수 있음([[phase1b-db-reconciliation]]).
- **무관 기존 실패 주의**([[repo-verification-gotchas]]): lint 2건·`format:check` 전역·`locate.test.ts` 2건은
  내 변경으로 오인하지 않는다.

---

## 12. 미해결/구현 시 확정할 점

- 페이지 유형 `main/dashboard/subpage` ↔ `screen` 태그 그룹 옵션 코드 매핑 존재 여부(있으면 매칭에 포함).
- 모달에 노출할 태그 그룹 최종 화이트리스트(분야/스타일/타겟/구조) — 시드 데이터로 그룹 `code` 확정.
- `title`/`company` 단일 입력 vs 분리 입력(현재안: 둘 다, title 필수).
- 폴링 주기(기본 3~5초) 수치 확정. (stale 표시는 선택 백스톱.)
- **Vercel Workflow step 함수 maxDuration 설정 위치/방법** — Claude 생성 step이 수 분일 수 있다.
  `workflow` SDK가 step 타임아웃/재시도 옵션을 노출하는지, 그리고 생성되는 step 라우트의 함수 maxDuration을
  `vercel.json`의 `functions` 글롭 또는 프로젝트 설정으로 어떻게 올리는지 구현 시 공식 문서로 확정.
- **로컬 개발에서 Workflow 동작 방식** 확인(`workflow` dev 모드는 로컬에서도 동일하게 도는지) + 미설정 시 폴백.
- Claude 모델 ID/스트리밍/이미지 블록은 `claude-api`로 확정 완료(§7). `output_config.effort` 기본값(`medium`)은 튜닝 가능.
