# 시안 태그 시스템 설계 (Proposal Tag System)

- 작성일: 2026-06-24
- 상태: 설계 승인됨 (구현 계획 작성 전)

## 1. 배경 / 목적

시안 상세페이지에 **"시안태그관리"** 서브메뉴(탭)를 추가한다. 작업자가 시안마다 정해진 분류 체계에 따라 태그를 **다중선택**으로 체크한다. 축적된 태그 데이터는 **추후 AI가 시안을 학습**하는 데 활용한다(소비는 이번 범위 밖).

태그 분류 체계(구분/항목)는 고정값이 아니라 **관리자 페이지에서 동적으로 추가/수정/삭제**할 수 있어야 한다 — 기존 공통코드관리(common code) 패턴과 동일.

## 2. 핵심 결정 사항

| 항목 | 결정 |
|---|---|
| 초기 데이터 | 제공된 6개 구분 + 전체 항목·설명을 **시드**로 미리 입력 |
| 삭제 시맨틱 | 관리자가 항목/그룹 삭제 시 연결된 시안 선택 기록도 **완전 삭제(CASCADE)** |
| 작업자 태깅 UI | **그룹별 칩(전체 노출)** — 6개 섹션, 토글 칩, 설명은 툴팁, 하단 명시적 [저장] |
| 데이터 구조 | 기존 `proposals`와 분리된 **독립 3 테이블** (FK 한 줄로만 연결) |
| 선택 방식 | 모든 그룹 **다중선택** |

### 채택 접근 vs 대안
- **채택: 관계형 공통코드 패턴(3 테이블).** 관리자 동적 CRUD 가능, AI 집계 조회 용이, 요청한 "공통코드처럼"에 부합.
- 대안 A — `proposals`에 JSON 배열 컬럼: 분류 동적 변경 불가, 집계·정합성 약함 → 탈락.
- 대안 B — 하드코딩 enum: 관리자 편집 요구사항과 충돌 → 탈락.

## 3. 데이터 모델

기존 `proposals` 테이블은 **변경하지 않는다**(컬럼 추가 없음). 신규 독립 테이블 3개.

### 3.1 `tag_groups` — 구분/필드 정의 (관리자 관리)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | uuid PK | `defaultRandom()` |
| `code` | text | 고정키(`purpose`/`target`/`field`/`screen`/`style`/`structure`), **unique** |
| `label` | text NOT NULL | 표시명("목적") |
| `description` | text NULL | 구분 설명 |
| `sort_order` | integer NOT NULL | 정렬 |
| `created_at` | timestamptz NOT NULL | `defaultNow()` |

- `code`로 식별을 안정화 → 라벨을 바꿔도 식별자 유지.

### 3.2 `tag_options` — 항목 정의 (관리자 관리)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | uuid PK | `defaultRandom()` |
| `group_id` | uuid NOT NULL | → `tag_groups(id)` **ON DELETE CASCADE** (SQL) |
| `code` | text NOT NULL | 그룹 내 고정키 |
| `label` | text NOT NULL | 표시명("제안") |
| `description` | text NULL | 항목 설명("수주/제안 단계에서 …") — 툴팁 노출 |
| `sort_order` | integer NOT NULL | 정렬 |
| `created_at` | timestamptz NOT NULL | `defaultNow()` |
| | | **unique(group_id, code)** |

### 3.3 `proposal_tags` — 시안별 선택 (작업자 다중선택, 조인 테이블)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| `proposal_id` | uuid NOT NULL | → `proposals(id)` **ON DELETE CASCADE** (SQL) |
| `option_id` | uuid NOT NULL | → `tag_options(id)` **ON DELETE CASCADE** (SQL) |
| `created_by` | uuid NULL | 태깅한 사용자(소유권 set null) |
| `created_at` | timestamptz NOT NULL | `defaultNow()` |
| | | **PK(proposal_id, option_id)**, **index(option_id)** (AI 집계용) |

- FK·CASCADE는 이 레포 컨벤션대로 Drizzle 정의에 `.references()`를 쓰지 않고 **raw SQL 마이그레이션**에서 추가한다.
- 옵션/그룹 삭제 → `proposal_tags` CASCADE 삭제 → "완전 삭제" 결정 충족.

## 4. 컴포넌트 / 모듈 (FSD)

### 신규
- `src/entities/tag/`
  - `model/types.ts` — `TagGroup`, `TagOption`, `TagTaxonomy`(그룹+옵션 중첩), `ProposalTagSelection` 타입
  - `api/get-taxonomy.server.ts` / `get-taxonomy.ts` — 전체 분류 조회
  - `api/get-proposal-tags.server.ts` / `.ts` — 시안 선택값 조회
  - `api/group-mutations.server.ts`, `option-mutations.server.ts`, `proposal-tag-mutations.server.ts`
  - `api/tag.query.ts` — react-query queryOptions 팩토리
  - `index.ts`
- `src/features/manage-tag-taxonomy/` — 관리자 CRUD UI + 훅 (그룹·옵션 추가/수정/삭제/순서)
- `src/features/assign-proposal-tags/` — 태깅 탭 UI(그룹별 칩) + 저장 훅
- `src/pages/admin-tags/` — 관리자 페이지 셸
- `app/studio/tags/page.tsx` — admin 가드 + `AdminTagsPage` 렌더
- `app/api/tags/taxonomy/route.ts` (GET)
- `app/api/admin/tags/groups/route.ts` (POST), `app/api/admin/tags/groups/[id]/route.ts` (PATCH/DELETE)
- `app/api/admin/tags/options/route.ts` (POST), `app/api/admin/tags/options/[id]/route.ts` (PATCH/DELETE)
- `app/api/proposals/[id]/tags/route.ts` (GET, PUT)

### 기존 수정
- `src/widgets/studio-shell/model/nav-config.ts` — `adminOnly` 항목 **"태그 설정"**(`/studio/tags`) 추가
- `src/pages/proposal-detail/ui/section-nav.tsx` — `SectionId`에 `"tags"` 추가, 3번째 탭 **"시안태그관리"**(Tag 아이콘)
- `src/pages/proposal-detail/ui/proposal-detail-page.tsx` — `?tab` enum에 `"tags"` 추가, 탭 본문에 태깅 탭 렌더

> 메뉴 라벨 구분: 관리자 정의 화면 = **"태그 설정"**, 시안 상세 탭 = **"시안태그관리"**(요청 명칭 유지).

## 5. API 계약

| 메서드 · 경로 | 권한 | 요청 | 응답 |
|---|---|---|---|
| `GET /api/tags/taxonomy` | editor+ | — | `TagGroup[]`(각 그룹에 `options[]` 중첩, sort_order 정렬) |
| `POST /api/admin/tags/groups` | admin | `{code,label,description?,sortOrder?}` | 201 / 생성된 그룹 |
| `PATCH /api/admin/tags/groups/[id]` | admin | 부분 필드 | 204 |
| `DELETE /api/admin/tags/groups/[id]` | admin | — | 204 (옵션·선택 CASCADE 삭제) |
| `POST /api/admin/tags/options` | admin | `{groupId,code,label,description?,sortOrder?}` | 201 / 생성된 옵션 |
| `PATCH /api/admin/tags/options/[id]` | admin | 부분 필드 | 204 |
| `DELETE /api/admin/tags/options/[id]` | admin | — | 204 (선택 CASCADE 삭제) |
| `GET /api/proposals/[id]/tags` | editor+ | — | `{ optionIds: string[] }` |
| `PUT /api/proposals/[id]/tags` | editor+ | `{ optionIds: string[] }` | 204 — 트랜잭션 내 diff(삭제+삽입) 후 선택집합 전체 교체 |

- 라우트 핸들러는 기존 컨벤션대로 `.server.ts` 함수에 위임 + `try/catch` → `toErrorResponse`.
- 권한은 `getProfile()` + `isAdmin()`/role 가드.
- 입력 검증은 zod 스키마(`entities/tag/model`)로.

## 6. UI 동작

### 6.1 관리자 정의 페이지 (`/studio/tags`, admin 전용)
- 그룹 목록(아코디언/리스트). 그룹을 펼치면 소속 옵션 목록.
- 그룹·옵션 각각 **추가/수정/삭제** + **순서변경**(`sort_order`; 1차는 위/아래 또는 순서 입력, 드래그는 추후).
- CRUD는 Base UI 다이얼로그 기반, `features/manage-users` 패턴 차용(http + react-query mutation, 성공 시 무효화).
- 삭제는 사용 중 경고("이 항목이 선택된 시안 N건의 기록도 함께 삭제됩니다") 확인 후 진행.

### 6.2 작업자 태깅 탭 (시안 상세, `?tab=tags`)
- editor+ 누구나 접근. **그룹별 칩(전체 노출)** 레이아웃: 6개 섹션, 항목 토글 칩, 설명 툴팁.
- 진입 시 `taxonomy` + 현재 시안 선택값 로드 → 선택된 칩 active.
- dirty 추적, 하단 **[저장]** 클릭 시 `PUT /api/proposals/[id]/tags`로 선택집합 전체 전송. 성공 시 토스트 + 쿼리 무효화.
- 분류가 비어 있으면(관리자가 전부 삭제 등) 빈 상태 안내.

## 7. 마이그레이션 + 시드

1. `drizzle/migrations/0015_*.sql` — `drizzle-kit generate`로 3 테이블 생성. 생성 후 FK + ON DELETE CASCADE + `index(option_id)` 구문을 레포 컨벤션대로 보강.
2. `drizzle/migrations/0016_seed_tags.sql` — 손수 작성. 6개 그룹 + 전체 항목·설명 멱등 INSERT(존재 시 무시). `code` 기준.

시드 데이터(요청 원본 그대로):
- **목적**: 제안 / 본작업 / 리뉴얼 / 개선 / 운영 / 확장 / 테스트
- **대상**: 관공서 / 공공기관 / 교육기관 / 의료기관 / 기업 / 브랜드 / 소상공인 / 협회·단체 / 스타트업 / 내부 프로젝트
- **분야**: 행정 / 교육 / 의료·복지 / 문화·예술 / 관광·레저 / 제조·산업 / IT·플랫폼 / 커머스 / 금융·보험 / 부동산·건설 / 식음료 / 채용·인재 / 환경·에너지 / 미디어·콘텐츠
- **화면**: 홈페이지 메인 / 홈페이지 서브 / 랜딩페이지 / 이벤트 페이지 / 상세페이지 / 리스트 페이지 / 검색·결과 페이지 / 신청·예약 폼 / 로그인·회원가입 / 마이페이지 / 관리자 / 대시보드 / 앱 화면 / 배너·팝업 / 이메일·알림
- **스타일**: 신뢰감 / 모던 / 미니멀 / 전문적 / 친근한 / 감성적 / 고급스러운 / 역동적 / 테크니컬 / 공공적 / 캐주얼 / 키치·트렌디 / 정보중심 / 비주얼중심
- **구조**: 히어로 중심 / 카드형 / 리스트형 / 그리드형 / 검색중심 / 예약중심 / 신청중심 / 스토리텔링 / 원페이지 / 탭 구조 / 대시보드형 / 지도중심 / 갤러리형 / 매거진형 / 비교형 / 단계형

(각 항목의 설명 텍스트는 요청서 표의 "설명" 열을 그대로 사용.)

## 8. 테스트

- 단위/통합(vitest): `PUT /api/proposals/[id]/tags` diff 로직(추가·삭제·무변경), 권한 가드(editor 미만 차단, 정의 CRUD는 admin 전용), CASCADE 동작(옵션 삭제 시 선택 기록 제거).
- 태깅 탭/관리 페이지 수동 E2E(기존 워크플로 관행).

## 9. 범위 밖 (추후)
- AI 학습용 export/조회 API, 태그 사용량 통계 대시보드
- 그룹별 단일선택 옵션(현재 전부 다중선택)
- 순서변경 드래그 앤 드롭(1차는 단순 컨트롤)
- 그룹/옵션 사용여부(active) 토글 — 현재는 CRUD만
