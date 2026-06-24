# 시안 유시스웍스 노출 토글 + 태깅 완성도 컬럼 설계

작성일: 2026-06-24
브랜치: `feat/proposal-exposure-and-tagging-progress`

## 배경 / 목표

시안(proposal) 관리에 두 가지 기능을 추가한다.

1. **유시스웍스 노출 토글** — 시안을 유시스웍스(포트폴리오/갤러리)에 노출할지 여부를 켜고 끄는 값. 기존 `visibility`(공개 뷰어 링크 접근 여부)와는 **별개의 축**이다.
2. **태깅 완성도 컬럼** — 시안 리스트에 태깅이 얼마나 채워졌는지를 % 숫자와 원형차트로 보여주고, 진행 정도에 따라 색을 구별한다.

## 확정된 결정 사항

- 노출 토글은 **별개의 새 boolean 필드**(`exposed_to_uxisworks`), 기본값 OFF.
- 노출 토글은 **설정 페이지에서 편집**, 시안 **리스트 상태 컬럼에 읽기전용 배지**로 표시.
- 태깅 완성도 = **구분 커버리지** = `태그가 1개 이상 선택된 구분 수 / 전체 구분 수 × 100`.
- 원형차트 색은 **4단계 구간**으로 구별.
- 차트 라이브러리(recharts 등)는 미설치이며, 작은 도넛 하나를 위해 의존성을 추가하지 않고 **SVG로 직접 구현**한다.

---

## 기능 1 — 유시스웍스 노출 토글

기존 `whiteboardEnabled` boolean 필드가 거치는 경로(스키마 → 마이그레이션 → zod → mutation → Switch UI)를 그대로 따른다.

### 1.1 데이터 모델

`drizzle/schema.ts`의 `proposals` 테이블에 컬럼 추가:

```ts
exposedToUxisworks: boolean("exposed_to_uxisworks").notNull().default(false),
```

마이그레이션 `drizzle/migrations/0017_proposal_exposed_to_uxisworks.sql`
(`0011_proposal_whiteboard_enabled.sql` 패턴 동일):

```sql
ALTER TABLE "proposals" ADD COLUMN "exposed_to_uxisworks" boolean DEFAULT false NOT NULL;
```

`Proposal` 타입(`typeof proposals.$inferSelect`)에 자동 반영된다.

### 1.2 검증 + 저장

`src/entities/proposal/model/edit-schemas.ts` — `updateSettingsSchema`:

- 필드 추가: `exposedToUxisworks: z.boolean().optional(),`
- `.refine(...)`의 "변경할 항목 없음" 조건에 `v.exposedToUxisworks !== undefined` 추가.

`src/entities/proposal/api/proposal-mutations.server.ts` — `updateProposalSettings`:

- 구조분해에 `exposedToUxisworks` 추가.
- `if (exposedToUxisworks !== undefined) updates.exposedToUxisworks = exposedToUxisworks;`

### 1.3 설정 UI

`src/features/edit-proposal-settings/ui/proposal-settings.tsx`:

- 화이트보드 토글 블록 아래에 "유시스웍스 노출" 행을 동일 패턴으로 추가.
  - 라벨 + 짧은 설명(켜면 유시스웍스 포트폴리오/갤러리에 노출).
  - `<Switch checked={exposedToUxisworks} disabled={pending} onCheckedChange={(checked) => change({ exposedToUxisworks: checked })} />`
- 컴포넌트가 현재 값을 받는 경로(상세 데이터 → 로컬 상태)에 `exposedToUxisworks`를 `whiteboardEnabled`와 동일하게 연결.

### 1.4 리스트 배지

`src/pages/proposals-list/ui/proposals-list-page.tsx`의 **상태 컬럼**:

- `p.exposedToUxisworks === true`일 때 기존 공개/비번 배지 옆에 `<Badge variant="success">노출</Badge>` 추가(읽기전용). variant는 프로젝트에 존재하는 Badge variant 중 의미가 맞는 것으로 확정.

---

## 기능 2 — 태깅 완성도 원형차트 컬럼

### 2.1 진행률 정의

```
taggingProgress = round(taggedGroupCount / totalGroupCount × 100)   // 0~100 정수
```

- `taggedGroupCount` = 해당 시안에서 태그가 1개 이상 선택된 **구분(group)** 수.
- `totalGroupCount` = `tag_groups` 전체 행 수(현재 6, 동적 조회).
- 서버에서 계산해 목록 응답에 포함한다(클라이언트 N+1 없음).

### 2.2 데이터 조회

`src/entities/proposal/api/get-proposals.server.ts`:

- 전체 구분 수를 한 번 조회: `select count(*) from tag_groups`.
- page 쿼리에 시안별 태깅 구분 수 집계를 추가. `proposals` → `proposal_tags`(proposal_id) → `tag_options`(option_id) LEFT JOIN 후 `COUNT(DISTINCT tag_options.group_id)`를 `GROUP BY proposals.id`로 계산. 기존 `where`(검색)/`orderBy(updatedAt desc)`/`limit`/`offset`는 유지.
  - 주의: GROUP BY를 쓰므로 select 컬럼을 명시(`proposals` 전체 컬럼 + 집계)하고, total count 쿼리는 기존 그대로 둔다.
- 각 행에 `taggingProgress`를 계산해 매핑.

### 2.3 타입

`src/entities/proposal/model/types.ts`:

```ts
export type ProposalListItem = Proposal & { taggingProgress: number };
```

`getProposals` 반환 타입을 `Paginated<ProposalListItem>`로 변경. 클라이언트 호출부(`get-proposals.ts`)와 리스트 페이지의 row 타입도 동일하게 맞춘다.

### 2.4 원형차트 컴포넌트 (신규, SVG)

위치: `src/shared/ui/progress-ring/`

- `ProgressRing` 컴포넌트. props: `value: number`(0~100), `size?: number`(기본값 지정).
- 구현: SVG 두 개의 `<circle>`(트랙 + 진행) + `stroke-dasharray`/`stroke-dashoffset`로 도넛 표현. 중앙에 `{value}%` 텍스트.
- 색 구간 함수(4단계):

  | 진행률 | 색 |
  |---|---|
  | 0% | 회색 (muted/비활성) |
  | 1~33% | 빨강 |
  | 34~66% | 주황 |
  | 67~99% | 파랑 |
  | 100% | 초록 |

  실제 색은 프로젝트 테마 토큰(`globals.css` / tailwind 변수)을 확인해 매핑한다. Badge variant(info/success/purple/neutral 등)와 톤이 충돌하지 않게 한다.
- 접근성: SVG에 `role="img"` + `aria-label="태깅 완성도 {value}%"`.

### 2.5 리스트 컬럼

`src/pages/proposals-list/ui/proposals-list-page.tsx`:

- 헤더에 "태깅" `<TableHead>` 추가(상태 컬럼 부근, 위치는 구현 시 확정).
- 셀에 `<ProgressRing value={p.taggingProgress} />` 렌더.

---

## 영향 범위 요약

| 파일 | 변경 |
|---|---|
| `drizzle/schema.ts` | `exposedToUxisworks` 컬럼 추가 |
| `drizzle/migrations/0017_*.sql` | 신규 마이그레이션 |
| `src/entities/proposal/model/edit-schemas.ts` | zod 필드 + refine 추가 |
| `src/entities/proposal/api/proposal-mutations.server.ts` | update 처리 추가 |
| `src/features/edit-proposal-settings/ui/proposal-settings.tsx` | 노출 Switch 추가 |
| `src/entities/proposal/api/get-proposals.server.ts` | 태깅 진행률 집계 추가 |
| `src/entities/proposal/model/types.ts` | `ProposalListItem` 추가 |
| `src/entities/proposal/api/get-proposals.ts` | 반환 타입 변경 |
| `src/shared/ui/progress-ring/` | `ProgressRing` 신규 |
| `src/pages/proposals-list/ui/proposals-list-page.tsx` | 노출 배지 + 태깅 컬럼 추가 |

## 비범위 (YAGNI)

- 유시스웍스 사이트와의 실제 연동/동기화(노출 ON 시 외부로 publish하는 파이프라인)는 이번 범위 밖. 이번에는 **플래그 저장 + 편집 + 표시**까지만.
- 리스트 인라인 토글(행에서 바로 on/off)은 채택하지 않음(설정 페이지에서만 편집).
- 태깅 완성도의 다른 정의(항목 단위 비율 등)는 채택하지 않음(구분 커버리지로 확정).

## 검증 계획

- `0017` 마이그레이션 적용.
- 타입체크 / lint(기존 무관 실패 2건은 제외, [[repo-verification-gotchas]] 참고).
- 수동 E2E:
  1. 설정에서 유시스웍스 노출 토글 ON/OFF → 리스트 상태 컬럼 배지 표시/사라짐 확인.
  2. 한 시안에 태그를 일부 구분만 선택 → 리스트 태깅 컬럼의 % 숫자와 원형차트 색이 구간에 맞게 변하는지 확인(0/일부/전부).
