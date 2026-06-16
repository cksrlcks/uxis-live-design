# Phase 4 — 멀티 안(variant) + 안별 히스토리 + 비교 뷰 설계

> 작성일: 2026-06-16
> 상위 설계: `docs/superpowers/specs/2026-06-15-uxis-live-design-design.md`
> 선행 단계: Phase 1b(시안·뷰어), Phase 2(프리뷰 UX) — 완료
> 비고: 실시간/댓글(Phase 3) 트랙과 **독립적**. variant는 향후 댓글 주소체계에 포함되게만 고려한다.

하나의 시안 아래에 **여러 개의 "안(案)"**(예: A안·B안·C안, 개수 가변)을 올리고,
**각 안이 자기만의 수정 히스토리**를 갖도록 한다. 클라이언트는 안을 개별 URL로 직접 보거나
나란히 비교할 수 있다. 데이터 모델·권한·보안 원칙은 상위 설계를 따른다.

## 0. 용어

| 용어 | 의미 | 테이블 |
|---|---|---|
| **시안(proposal)** | 고객에게 공유하는 단위. 하나의 `public_id`·공개설정·비번을 가짐 | `proposals` |
| **안(variant)** | 시안 안의 **나란히 존재하는 대안**(A/B/C…). 개수 가변, 개별 URL | `proposal_variants` (신설) |
| **버전(version)** | 한 안의 **순차 수정 이력**(v1·v2·v3…). 편집자 전용 | `proposal_versions` |
| **페이지(page)** | 한 버전에 속한 이미지들 | `proposal_pages` |

계층: **시안 → 안 → 버전 → 페이지**. (기존 모델은 안 레벨이 없어 시안 → 버전 → 페이지였다.)

## 1. 범위

**포함**
- 안 CRUD: 추가 / label 수정 / 삭제 / 순서 변경
- 안별 버전 히스토리 + 비파괴 복원 (기존 로직을 안 스코프로 재사용)
- 공개 뷰어: 기본 **안 목록**, **`?v=<slug>`** 안별 직접 접근, **`?compare=1`** 나란히 비교
- 에디터 상세: 안 탭/전환 + 안 추가 + 안별 히스토리·새 버전
- 기존 데이터 마이그레이션(기존 시안 → 안 1개로 감싸기)

**제외 (YAGNI)**
- 안끼리 **페이지 단위 동기 스크롤** 비교 — 비교는 현재버전 컬럼 나열까지만
- 댓글/실시간(Phase 3) — variantId가 향후 주소체계에 들어가게만 고려, 구현 안 함
- 드래그 정렬 고급 UX — 간단한 순서 변경(up/down 또는 sort_order PATCH)까지
- 안별 개별 공개설정/비번 — 권한은 **시안 단위** 유지

## 2. 확정된 결정

| # | 결정 | 선택 | 이유 |
|---|------|------|------|
| 1 | 안의 위치 | **시안 아래 신규 레벨(`proposal_variants`)** | 머릿속 모델과 1:1. 각 테이블이 한 역할만. 안별 URL·비교 깔끔 (방식 A) |
| 2 | label ↔ URL 분리 | **label(수정 가능) / slug(불변)** 분리 | "A안"→"1안" 변경해도 공유 URL `?v=a`가 안 깨짐 |
| 3 | slug 자동 부여 | 생성 시 **미사용 a→z 순**, 26개 초과 시 짧은 랜덤 폴백 | 외부 의존 없이 헬퍼로, 시안 내 유니크 |
| 4 | 현재 버전 위치 | **안 레벨(`variant.current_version_id`)** | 안마다 독립적으로 현재 버전을 가짐(안 A=v3, 안 B=v1) |
| 5 | 히스토리 공개 범위 | **편집자 전용** | 클라이언트는 각 안의 현재 버전만. 기존 모델과 동일 |
| 6 | 접근 권한 단위 | **시안 단위(기존 유지)** | 공개/비번은 시안 전체. 한 번 통과 → 모든 안 열람 |
| 7 | 기본 뷰어 화면 | **안 목록(썸네일)부터** | 링크 열면 안 목록 → 선택. 직접 URL은 `?v=` |
| 8 | 마지막 안 삭제 | **불가(최소 1개 보장)** | 안 0개인 빈 시안 방지 |
| 9 | 비교 뷰 | **모든 안의 현재 버전 컬럼 나열** | 동시 대조. 동기 스크롤은 비범위 |
| 10 | 스토리지 경로 | **`{proposalId}/{versionId}/{pageId}.{ext}` 그대로** | versionId가 전역 유니크 → 안 레벨 추가해도 경로 불변, 기존 이미지 유효 |

## 3. 데이터 모델 (`drizzle/schema.ts`)

### 3.1 신설 `proposal_variants`
```
proposal_variants
├─ id                 uuid PK (defaultRandom)
├─ proposal_id        uuid → proposals (ON DELETE CASCADE)
├─ label              text NOT NULL      표시 이름(수정 가능). 기본 "A","B","C"…
├─ slug               text NOT NULL      URL용 고정 키(불변). "a","b","c"…
├─ sort_order         int  NOT NULL      안 목록/탭 순서
├─ current_version_id uuid NULL → proposal_versions   (안별 현재 버전; 순환 FK는 SQL 후추가)
├─ created_by         uuid → profiles
├─ created_at         timestamptz NOT NULL default now()
└─ UNIQUE(proposal_id, slug)
```

### 3.2 변경 `proposal_versions` — proposal이 아니라 안에 소속
```
proposal_versions
├─ proposal_id  →  변경  variant_id  uuid → proposal_variants (ON DELETE CASCADE)
├─ version_no   1,2,3…  (이제 **안별**로 매김)
└─ UNIQUE(proposal_id, version_no)  →  UNIQUE(variant_id, version_no)
```

### 3.3 변경 `proposals`
- `current_version_id` **제거**(안 레벨로 이동). `public_id`·`title`·`owner_id`·`visibility`·`access_password_hash`는 그대로.

### 3.4 `proposal_pages`
- 변경 없음.

**마이그레이션 컨벤션**(기존과 동일): `drizzle-kit generate` 후 같은 파일에 FK·UNIQUE·RLS·데이터 이전 SQL을 수동 append.

**RLS 백스톱**: `proposal_variants`도 `ENABLE` + `FORCE ROW LEVEL SECURITY`, anon/authenticated 정책 없음 = 완전 deny. 모든 접근은 API route의 Drizzle 경유(기존 원칙).

**순환 FK 주의**: `proposal_variants.current_version_id → proposal_versions` 와
`proposal_versions.variant_id → proposal_variants` 가 상호 참조 → `current_version_id`는 NULL 허용 + FK는 마이그레이션 SQL에서 후추가(기존 `proposals.current_version_id` 패턴과 동일).

## 4. 데이터 마이그레이션 (기존 시안 → 안 1개)

실데이터가 거의 없는 빌드 단계. 같은 마이그레이션 SQL 안에서 순서대로:

1. `proposal_variants` 테이블 생성(컬럼·UNIQUE·RLS).
2. `proposal_versions.variant_id` 컬럼 추가(우선 NULL 허용).
3. **기존 시안마다 안 1개 생성**: `INSERT INTO proposal_variants (proposal_id, label, slug, sort_order, current_version_id, created_by) SELECT id, 'A', 'a', 0, current_version_id, owner_id FROM proposals;`
4. **버전 재귀속**: 각 `proposal_versions`의 `variant_id`를 같은 `proposal_id`의 안으로 채움.
5. `proposal_versions.variant_id` NOT NULL + FK 설정, `proposal_id` 컬럼 제거, UNIQUE 교체.
6. `proposal_variants.current_version_id` FK 후추가.
7. `proposals.current_version_id` 컬럼 제거.

## 5. 스토리지 & 업로드 플로우

- 경로 `{proposalId}/{versionId}/{pageId}.{ext}` **유지**(변경 4번 #10).
- 업로드 3-스텝(준비→PUT→확정)은 그대로. **확정 단계에서 `proposal_versions.current` 대신 `proposal_variants.current_version_id`를 갱신**한다.
- 안 추가 = "새 안 + v1" 한 번에. 새 버전 = "기존 안에 vN+1".

## 6. API 표면 (BFF, 전부 `requireEditor()`)

기존 `/versions`를 **`/variants/[variantId]/versions`** 아래로 이동시켜 안에 종속.

| 메서드/경로 | 동작 | 상태 |
|---|---|---|
| `POST /api/proposals` | 시안 생성 + **첫 안(label A/slug a)** + v1 + 업로드 URL | 수정 |
| `GET /api/proposals/[id]` | 시안 + **안 목록**(각 안의 버전·current 포함) | 수정 |
| `PATCH /api/proposals/[id]` | title·visibility·비번 | 그대로 |
| `DELETE /api/proposals/[id]` | 시안 삭제(cascade + Storage 객체) | 그대로(쿼리는 variant join 경유로 조정) |
| `POST /api/proposals/[id]/variants` | **안 추가**(다음 label/slug 부여 + v1 + 업로드 URL) | 신규 |
| `PATCH /api/proposals/[id]/variants/[vid]` | label 수정 / sort_order 변경 | 신규 |
| `DELETE /api/proposals/[id]/variants/[vid]` | 안 삭제(+ Storage). **마지막 1개 삭제 불가(409)** | 신규 |
| `POST /api/proposals/[id]/variants/[vid]/versions` | 그 안의 **새 버전** + 업로드 URL | 이동 |
| `POST .../variants/[vid]/versions/[ver]/pages` | 업로드 확정 → **그 안의** current_version 갱신 | 수정 |
| `POST /api/proposals/[id]/variants/[vid]/restore` | 그 안의 특정 버전 → 새 버전 복원(비파괴) | 이동 |
| `app/p/[publicId]` (server) | 게이트 후 안 목록 / `?v=` / `?compare=1` 분기 | 수정 |

- slug 자동 부여 헬퍼: 시안의 기존 slug 집합을 받아 미사용 a→z 첫 글자 반환, 폴백은 짧은 랜덤(public-id 헬퍼 재사용 가능).
- 안 추가 시 label 기본값 = 다음 대문자(A→B→C…), 이후 사용자가 PATCH로 자유 변경.
- `versionNo`는 **variant별 max+1**로 채번.

## 7. 화면 (App Router)

**공개 뷰어 `app/p/[publicId]/page.tsx`** — 접근 게이트(visibility/비번/unlock 쿠키)는 기존 그대로, 통과 후 분기:
- **파라미터 없음** → 안 목록 그리드: 안마다 카드(label + 썸네일 = 현재버전 1페이지 signed URL). 클릭 → `?v=slug`.
- **`?v=<slug>`** → 그 안의 현재 버전 페이지를 `ProposalPreview`로 렌더(직접 공유 URL). 상단에 안 전환 + "목록" / "나란히 보기".
- **`?compare=1`** → 모든 안의 현재 버전을 컬럼으로 좌우 배치.
- 클라이언트에 **히스토리 비노출**.

**에디터 상세 `app/(dashboard)/dashboard/proposals/[id]/page.tsx`**
- 상단 **안 탭/리스트** + **"안 추가"** 버튼, label 인라인 수정, 순서 변경.
- 선택된 안: 현재 미리보기 · **버전 히스토리(목록·복원)** · **"새 버전 올리기"** (전부 그 안 스코프).

**컴포넌트**
```
components/preview/
├─ variant-list.tsx     안 목록 그리드(썸네일)
└─ compare-view.tsx     나란히 비교(현재버전 컬럼 나열)
components/proposals/
├─ variant-tabs.tsx     에디터 안 전환/추가/라벨수정/순서
├─ add-variant-form.tsx 안 추가 업로더(width/height 측정 — 기존 업로더 재사용)
└─ (add-version-form.tsx · version-actions.tsx 를 variant 스코프로 조정)
lib/proposals/
└─ variant-slug.ts      slug 자동 부여(순수, 테스트)
```

## 8. 테스트 전략

기존 패턴(순수 로직 단위 테스트):
- `lib/proposals/variant-slug.ts` — 미사용 문자 선택, 폴백, 시안 내 유니크
- label/slug 분리 불변성(label 변경이 slug에 영향 없음) — 헬퍼/로직 수준
- variant별 `versionNo` 채번(max+1) 로직

I/O가 얽힌 라우트·업로드·마이그레이션은 plan의 **수동 검증 단계**로 확인(기존 방침).

## 9. Done 기준 (Phase 4)

- 편집자가 한 시안에 안을 **여러 개** 추가하고, 안마다 label을 자유롭게 바꾸고, 순서를 정하고, 삭제할 수 있다(마지막 1개는 삭제 불가).
- 각 안이 **독립적인 버전 히스토리**(새 버전/복원, 비파괴)를 가지며, 안 A·B의 현재 버전이 서로 다를 수 있다.
- 공개 뷰어에서 링크를 열면 **안 목록**이 보이고, `?v=<slug>`로 특정 안을 직접 열 수 있으며, `?compare=1`로 안들을 **나란히 비교**할 수 있다.
- label을 바꿔도 기존 공유 URL(`?v=slug`)이 깨지지 않는다.
- 클라이언트에는 히스토리가 노출되지 않고, 권한(공개/비번)은 시안 단위로 동작한다.
- 기존 시안이 안 1개로 마이그레이션되어 그대로 열람·편집된다.
- 모든 데이터 접근은 API route의 Drizzle 경유, 추가 테이블은 RLS `FORCE` + deny 백스톱.

**작업 형태**: `feat/phase4-variants` 브랜치, 태스크별 작은 커밋, 커밋마다 `npx tsc --noEmit` + Vitest 게이트, 완료 후 master로 ff-merge(기존 phased 워크플로).
