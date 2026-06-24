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
- **비동기 실행**: 생성 요청은 행을 `working`으로 INSERT 후 **즉시 201 반환**, 실제 Claude 호출은
  Next.js 16 `after()`(`next/server`)로 응답 후 백그라운드 실행. 클라이언트는 목록을 폴링한다.
- **지연/실패 복구**: 생성 도중 프로세스 재시작 시 행이 `working`에 멈출 수 있으므로, `updated_at`이 일정
  시간(예: 5분) 이상 지난 `working`은 UI에서 "지연"으로 간주하고 **재시도** 가능하게 한다.
- **뷰어**: 관리자 전용 **raw HTML route**(`text/html` 반환)를 새 탭으로 연다. 기존 React 캔버스 뷰어와 별개.
- **저장 위치**: 생성 HTML은 `ai_designs.html`(text 컬럼)에 인라인 저장.
- **태그 저장**: `proposal_tags`와 동일한 정션 테이블(`ai_design_tags`)로 선택 태그를 보존.
- **네임스페이스**: 기존 관례대로 `/studio/ai-designs`(페이지) + `/api/admin/ai-designs`(API).

> 모든 경로는 `d:\project\git\uxis-live-design` 기준. import alias: `@/*` → `./src/*`, `@drizzle/*` → `./drizzle/*`.

---

## 1. 전체 데이터 흐름

```
[생성하기 모달 제출]
  └─ POST /api/admin/ai-designs
       ├─ requireAdmin()
       ├─ zod 검증 (title, pageType, optionIds[], extraNotes?)
       ├─ ai_designs INSERT (status='working', html=null, model=<env>)
       ├─ ai_design_tags INSERT (선택 optionId들)
       ├─ after(() => generateAiDesign(id))   ← 응답 후 백그라운드
       └─ 새 행(DTO) 즉시 201 반환

  (백그라운드) generateAiDesign(id)
       ├─ 행 로드 + 선택 태그(optionIds) 로드
       ├─ getTagMatchedImages(optionIds, pageType) → 참고 이미지 URL 최대 10개
       ├─ buildPrompt(입력 + 이미지 URL) → Anthropic(Sonnet 4.6) 호출 (vision)
       ├─ 성공: UPDATE html=<응답>, status='done', updated_at=now
       └─ 실패: UPDATE status='failed', error_message=<요약>, updated_at=now

[목록 화면]
  - react-query 로 목록 조회. 'working' 행이 하나라도 있으면 refetchInterval 폴링.
  - 'done' → "뷰어 열기" 활성화 → /studio/ai-designs/[id]/raw 새 탭 (raw HTML)
  - 'failed' 또는 지연된 'working' → "재시도" 버튼
  - 각 행 "삭제" 버튼
```

`after()`는 self-hosted long-lived Node 서버에서 응답 후에도 실행된다. 동작/제약은 구현 시
`node_modules/next/dist/docs/`에서 재확인한다(AGENTS.md: 이 Next.js는 학습 데이터와 다를 수 있음 — Next 16.2.9).

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
- 행 액션: **뷰어 열기**(`status==='done'`), **재시도**(`failed` 또는 지연된 `working`), **삭제**.
- 데이터: `@tanstack/react-query` + `nuqs`(이미 deps). `working` 행이 있으면 `refetchInterval`(예: 3~5초)로 폴링,
  전부 종료되면 폴링 중단.
- 지연 판정: `status==='working' && now - updated_at > STALE_MS(예: 5분)` → UI에서 "지연" 표기 + 재시도 노출.

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

## 7. Anthropic 생성 (`src/entities/ai-design/api/generate-ai-design.server.ts`)

- `@anthropic-ai/sdk` 설치(현재 미설치). env 추가: `ANTHROPIC_API_KEY`(서버 시크릿, SDK 기본 인식),
  `ANTHROPIC_MODEL`(기본 `claude-sonnet-4-6`). `.env.example`/`.env.local` 갱신([[rotate-supabase-secrets]] 맥락처럼
  시크릿은 커밋 금지).
- **구현 직전 `claude-api` 스킬 로드** — 정확한 모델 ID, `max_tokens`, 이미지 블록 포맷, vision 입력 제약,
  토큰/요금 확인(메모리/추측 금지).
- 메시지 구성:
  - 시스템: 역할(시니어 웹 디자이너/프론트엔드), **출력 형식 = 완결형 단일 HTML 문서 문자열만**(설명/마크다운 금지,
    인라인 CSS 권장, 외부 스크립트/네트워크 의존 최소화).
  - 사용자: 제목/회사명, 페이지 유형, 선택 태그(라벨), 추가 요청사항 + 참고 이미지 URL 블록들(최대 10).
- 응답에서 HTML 본문만 추출(코드펜스가 있으면 제거) → `html` 저장, `status='done'`.
- 실패(네트워크/4xx/5xx/timeout): `status='failed'` + `error_message`(요약). Anthropic 429는 `RATE_LIMITED`
  의미로 메시지 보존.
- 비용/감사: 사용 모델은 `model` 컬럼에 기록. (토큰/비용 상세 로깅은 범위 밖 — 추후.)

API 라우트(`app/api/admin/ai-designs/route.ts` 등)는 thin: `try { return Response.json(await fn(...), {status}) }
catch (e) { return toErrorResponse(e) }`. 에러 매핑은 `src/shared/api/to-error-response.ts`
(`FORBIDDEN`→403, `NOT_FOUND`→404, ZodError→400, `RATE_LIMITED`→429).

생성 트리거: `POST /api/admin/ai-designs` 핸들러가 행 생성 후 `after(() => generateAiDesign(id))`로 예약하고
즉시 반환. (동기 await 금지 — 요청 타임아웃 회피.)

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
- `src/entities/ai-design/api/generate-ai-design.server.ts`
- `src/entities/ai-design/model/*.ts`(타입/zod 스키마)
- `.env.example`(편집: `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`)
- `package.json`(편집: `@anthropic-ai/sdk` 추가)

변경:
- `src/widgets/studio-shell/model/nav-config.ts`(메뉴 1줄)

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
- `STALE_MS`(지연 판정 임계, 기본 5분)와 폴링 주기(기본 3~5초) 수치 확정.
- 정확한 Claude 모델 ID·`max_tokens`·이미지 블록 포맷(`claude-api` 스킬로 확정).
