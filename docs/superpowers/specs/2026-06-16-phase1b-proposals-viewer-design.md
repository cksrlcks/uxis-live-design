# Phase 1b — 시안 & 뷰어 설계 (부록)

> 작성일: 2026-06-16
> 상위 설계: `docs/superpowers/specs/2026-06-15-uxis-live-design-design.md`
> 선행 단계: Phase 1a (기반 & 인증) — 완료

이 문서는 Phase 1b(시안 CRUD · 이미지 업로드 · 버전 히스토리 · 공개 뷰어 + 비번 게이트)에서
상위 설계가 명시하지 않은 **구현 결정**을 확정한다. 데이터 모델·권한·보안 원칙은 상위 설계를 따른다.

## 1. 범위

**포함**
- 시안(`proposals`) CRUD + `public_id` 생성
- 비공개 버킷 이미지 업로드(페이지), v1 자동 생성
- 버전 히스토리: 목록 / 특정 버전 보기 / 복원
- 공개/비공개/비번 설정
- 공개 뷰어 `/p/[publicId]` **최소 렌더** + 비번 게이트 + signed read URL
- BFF API route + 2중 권한 체크(코드 1차 + RLS deny 백스톱)

**제외 (YAGNI — 다음 단계)**
- `comments` / `chat_messages` 테이블, 실시간 — Phase 3
- 풀스크린 슬라이드 / 캔버스 뷰 — Phase 2
- 이미지 다운스케일/최적화 — 하지 않음(native 1920 폭 유지)

## 2. 확정된 결정

| # | 결정 | 선택 | 이유 |
|---|------|------|------|
| 1 | 이미지 업로드 방식 | **Signed upload URL** | API route가 인증 후 단발성 업로드 URL 발급 → 브라우저가 Storage에 직접 PUT. Vercel 본문 크기 한계(~4.5MB) 회피, 대용량 1920px 이미지에 적합. 메타데이터는 여전히 API 경유(BFF 유지) |
| 2 | 버전 복원 의미 | **새 버전으로 복사(비파괴)** | 옛 버전 페이지를 새 버전(vN+1)으로 복제 후 current 지정. 전체 이력 보존, 스냅샷 일관성 유지 |
| 3 | Phase 1b 뷰어 범위 | **최소 렌더** | 페이지를 순서대로 세로 나열. 풀스크린/캔버스는 Phase 2 |
| 4 | 이미지 원본 크기 | **클라이언트 측정** | 업로드 전 브라우저에서 natural width/height 측정 → 메타와 함께 전송. 서버 이미지 라이브러리(sharp 등) 네이티브 의존성 불필요 |
| 5 | 비번 해싱 | **`node:crypto` scrypt** | 네이티브 의존성 0. `salt:hash`(hex) 저장, 평문 금지 |
| 6 | unlock 토큰 | **HMAC-SHA256 서명 HttpOnly 쿠키** | `publicId`에만 유효, 만료 ~12h. 새 env `ACCESS_TOKEN_SECRET` |
| 7 | `public_id` 생성 | **8자 무작위 코드(node:crypto)** | 혼동 문자 제외 알파벳, 충돌 시 재시도. 외부 의존성 없이 헬퍼로 구현 |

## 3. 데이터 모델 추가 (`drizzle/schema.ts`)

상위 설계 §5를 그대로 따른다. Phase 1b는 아래 3개 테이블만 추가한다
(`comments`/`chat_messages`는 Phase 3).

```
proposals
├─ id                   uuid PK (defaultRandom)
├─ public_id            text UNIQUE        URL용 8자 코드
├─ title                text NOT NULL
├─ owner_id             uuid → profiles
├─ visibility           text NOT NULL default 'private'   CHECK in ('private','public')
├─ access_password_hash text NULL          공개+비번일 때만 (scrypt 'salt:hash')
├─ current_version_id   uuid NULL → proposal_versions     기본 표시 버전
├─ created_at / updated_at  timestamptz NOT NULL default now()

proposal_versions
├─ id          uuid PK
├─ proposal_id uuid → proposals (ON DELETE CASCADE)
├─ version_no  int NOT NULL       1,2,3… (proposal별)
├─ note        text NULL
├─ created_by  uuid → profiles
├─ created_at  timestamptz NOT NULL default now()
└─ UNIQUE(proposal_id, version_no)

proposal_pages
├─ id           uuid PK
├─ version_id   uuid → proposal_versions (ON DELETE CASCADE)
├─ page_order   int NOT NULL
├─ storage_path text NOT NULL      비공개 버킷 경로
├─ width        int NOT NULL
├─ height       int NOT NULL
└─ UNIQUE(version_id, page_order)
```

**마이그레이션 컨벤션** (기존과 동일): `drizzle-kit generate`로 생성 후, FK·RLS·CHECK 등
수동 SQL을 같은 마이그레이션 파일에 append.

**RLS 백스톱**: 세 테이블 모두 `ENABLE` + `FORCE ROW LEVEL SECURITY`,
**anon/authenticated 정책 없음 = 완전 deny**. 모든 접근은 API route의 Drizzle(privileged pooler) 경유.
공개 시안의 anon 조회도 PostgREST가 아니라 **우리 API route**를 타므로 RLS 정책이 필요 없다.
(Realtime 구독용 정책은 Phase 3에서 도입)

**순환 FK 주의**: `proposals.current_version_id → proposal_versions` 와
`proposal_versions.proposal_id → proposals` 가 상호 참조. `current_version_id`는 NULL 허용 +
FK는 마이그레이션 SQL에서 나중에 추가하여 생성 순서 문제를 피한다.

## 4. 스토리지 & 업로드 플로우

- 비공개 버킷명 `proposals` (대시보드에서 1회 생성, 또는 셋업 스크립트)
- 객체 경로: `{proposalId}/{versionId}/{pageId}.{ext}`
- 서버 전용 서비스 클라이언트 신규: `lib/supabase/service.ts` — `SUPABASE_SECRET_KEY`로
  Storage signed upload/read URL 발급. **명시적 권한 체크 뒤에만** 사용.

**업로드 3-스텝** (BFF 유지, 브라우저는 데이터가 아닌 Storage 객체만 직접 다룸):

1. **준비**: `POST /api/proposals`(신규 시안) 또는 `POST /api/proposals/[id]/versions`(새 버전)
   → `requireEditor()` → proposal/version 행 생성 →
   각 파일에 대해 `pageId` 발급 + `createSignedUploadUrl(path)`로 단발성 URL 반환.
   요청 본문에 파일별 `{ filename, contentType, size, width, height }` 포함 →
   서버가 타입(png/jpeg/webp)·크기(≤25MB) 검증 후 URL 발급.
2. **전송**: 브라우저가 받은 signed URL로 각 파일을 Storage에 직접 PUT.
3. **확정**: `POST /api/proposals/[id]/versions/[vid]/pages`
   → 업로드된 객체 존재 확인 → `proposal_pages` 행(width/height/page_order/storage_path) 기록
   → 완료 시 `proposals.current_version_id = vid`, `updated_at` 갱신.

부분 실패(2단계 일부 PUT 실패) 시 3단계에서 성공한 페이지만 기록하고 사용자에게 재시도 안내.

## 5. 버전 & 복원

- **신규 시안**: 생성 시 v1 자동 생성, 업로드한 페이지가 v1에 귀속, current=v1.
- **새 버전**: `POST /api/proposals/[id]/versions` → `version_no = max+1`, 선택 `note`,
  업로드 플로우로 페이지 추가, 완료 시 current=새 버전.
- **복원** `POST /api/proposals/[id]/restore` (body: `{ versionId }`):
  대상 버전의 `proposal_pages`를 **새 버전(vN+1)으로 복제**(같은 `storage_path` 재참조 →
  객체 재업로드 없음), `note`는 "vN에서 복원", current=새 버전. 비파괴.

## 6. 공개 뷰어 + 비번 게이트

- 라우트 `app/p/[publicId]/page.tsx` — **최소 렌더**: 서버에서 visibility/쿠키 판정 →
  허용 시 페이지별 signed read URL(만료 1h) 발급 → `<img>` 세로 나열(순서대로).
- **접근 판정**:
  - `private` → editor/admin 세션만(미인증/비편집자는 차단). 게스트 접근 불가.
  - `public` 비번 없음 → 누구나.
  - `public` + 비번 → 유효한 unlock 쿠키가 있어야 데이터+signed URL 제공. 없으면 비번 입력 화면.
- **비번 해시/검증** `lib/access/password.ts`: `node:crypto.scrypt`,
  `hashPassword(pw) → "salt:hash"`, `verifyPassword(pw, stored) → boolean`. 순수 로직, 단위 테스트.
- **unlock 쿠키** `lib/access/cookie.ts`: HMAC-SHA256(`ACCESS_TOKEN_SECRET`)로 서명한 토큰
  `{publicId}.{exp}.{sig}`, HttpOnly·Secure·SameSite=Lax, 만료 ~12h. 발급/검증 순수 로직, 단위 테스트.
- **unlock 처리**: `app/p/[publicId]/unlock` server action — 비번 입력 → `verifyPassword` →
  성공 시 쿠키 발급 후 뷰어로 리다이렉트, 실패 시 에러 메시지.
- 이미지는 항상 signed URL로만 노출(직접 객체 URL 접근 불가) → 비번 우회 차단.

## 7. API 표면 (BFF)

| 메서드/경로 | 권한 | 동작 |
|---|---|---|
| `GET /api/proposals` | editor | 전체 시안 목록(글로벌 권한) |
| `POST /api/proposals` | editor | 시안 생성 + v1 + 업로드 URL 발급 |
| `GET /api/proposals/[id]` | editor | 시안 + 버전 목록 |
| `PATCH /api/proposals/[id]` | editor | title·visibility·비번 걸기/풀기/바꾸기 |
| `DELETE /api/proposals/[id]` | editor | 시안 삭제(행 cascade + Storage 객체 삭제) |
| `POST /api/proposals/[id]/versions` | editor | 새 버전 + 업로드 URL |
| `POST /api/proposals/[id]/versions/[vid]/pages` | editor | 업로드 확정·페이지 기록·current 갱신 |
| `POST /api/proposals/[id]/restore` | editor | 지정 버전을 새 버전으로 복원 |
| `app/p/[publicId]` (server) | 게이트 | 공개 뷰어 데이터/ signed URL |
| `app/p/[publicId]/unlock` (action) | 게이트 | 비번 검증 → unlock 쿠키 |

- 편집 API는 전부 `requireEditor()`(기존 `lib/auth/session.ts`).
- 공개 조회는 visibility + unlock 쿠키 기반 서버 게이트(별도 헬퍼).

## 8. 화면 (App Router)

```
app/(dashboard)/proposals/
├─ page.tsx              시안 리스트(제목·public_id·visibility 뱃지·버전 수·수정일·링크)
├─ new/page.tsx          제목 + 다중 이미지 드롭존 → 생성
└─ [id]/
   ├─ page.tsx           편집: 페이지 미리보기·버전 히스토리·새 버전 올리기
   └─ settings/page.tsx  visibility·비번·삭제  (또는 [id] 내 섹션)
app/p/[publicId]/
├─ page.tsx              공개 뷰어(최소 렌더) + 비번 입력 화면
└─ (unlock server action)
components/proposals/     업로더(클라이언트, width/height 측정)·버전 목록·설정 폼·행 액션
lib/access/               password.ts · cookie.ts (순수, 테스트)
lib/supabase/service.ts   서비스 롤 클라이언트(Storage)
```

## 9. 환경변수 추가

| 변수 | 위치 | 용도 |
|------|------|------|
| `ACCESS_TOKEN_SECRET` | 서버 전용 | 공개 시안 unlock 쿠키 HMAC 서명 키 |

`.env.example`에 placeholder 추가, `.env.local`에 실제 무작위 값. 절대 커밋 금지.

## 10. 테스트 전략

기존 패턴(순수 로직 단위 테스트)을 따른다:
- `lib/access/password.ts` — 해시/검증 라운드트립, 오답 거부
- `lib/access/cookie.ts` — 서명/검증, 만료·변조 거부, publicId 불일치 거부
- `lib/proposals/public-id.ts` — 형식·문자셋·길이
- 접근 게이트 판정 헬퍼(순수화 가능 부분) — private/public/비번 분기

I/O가 얽힌 API route·업로드 플로우는 수동 검증 단계(plan의 각 태스크)로 확인.

## 11. Done 기준 (Phase 1b)

- 편집자가 시안을 만들고 이미지를 업로드하면 v1이 자동 생성되고 페이지가 순서대로 저장된다.
- 새 버전 업로드/복원이 동작하고 이력이 보존된다(복원은 비파괴 새 버전).
- visibility(private/public)와 비번 걸기/풀기/바꾸기가 동작한다.
- `/p/[publicId]`에서 공개 시안을 최소 렌더로 열람할 수 있고, 비번 시안은 unlock 후에만 보인다.
- 이미지는 항상 signed URL로만 노출되고, 직접 객체 URL 접근은 불가.
- 모든 데이터 접근은 API route의 Drizzle 경유(브라우저→Supabase 데이터 직결 없음).
  추가 테이블은 RLS `FORCE` + anon/authenticated deny 백스톱.

**다음 단계:** Phase 2 — 프리뷰 UX(1920 풀스크린 슬라이드 + 캔버스 뷰).
