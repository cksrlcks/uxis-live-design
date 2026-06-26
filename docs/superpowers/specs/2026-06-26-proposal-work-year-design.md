# 시안 작업연도 필드 추가 설계

**날짜:** 2026-06-26  
**상태:** 승인됨

## 개요

시안(proposal)에 작업연도(`work_year`) 필드를 추가한다. 등록 폼에 셀렉트 박스, 목록 칼럼, 목록 상단 필터(연도 + 공개/비공개)를 구현한다.

---

## 1. DB 변경

- `proposals` 테이블에 `work_year INTEGER NULL` 컬럼 추가
- 기존 데이터는 NULL (연도 미지정 상태)
- 마이그레이션 파일: `drizzle/migrations/0024_proposal_work_year.sql`
- Drizzle journal: `drizzle/migrations/meta/_journal.json` 항목 추가

## 2. 등록 / 수정 폼

### 등록 폼 (`proposal-create-form.tsx`)
- 제목 입력 아래에 "작업연도" `<select>` 추가
- 선택지: 플레이스홀더("연도 선택") + 현재 연도 ~ 2000년 역순
- 선택 사항(optional), 미선택 시 null 저장
- Zod 스키마에 `workYear: z.number().int().optional()` 추가

### 설정 폼 (`proposal-settings.tsx`)
- 기존 참여자 필드 근처에 "작업연도" 셀렉트 추가
- PATCH 요청으로 저장 (기존 패턴 동일)

## 3. 목록 칼럼

- 기존 컬럼 순서: 제목 / 참여자 / 공개ID / 도메인 / 상태 / 태깅 / 작성일 / 수정일 / 작업
- **연도** 칼럼을 참여자 다음에 삽입
- 값 없으면 "—" 표시

## 4. 필터 UI

### 위치
검색 인풋 바로 옆 (같은 행)

### 레이아웃
```
[ 🔍 검색 ────── ]  [ 연도 ▼ ]  [ 공개상태 ▼ ]     전체 N개
```

### 연도 필터
- 선택지: "전체 연도" + DB에 실제 존재하는 연도 목록 (역순)
- URL 파라미터: `?year=2024`

### 공개상태 필터
- 선택지: "전체" / "공개" / "비공개"
- URL 파라미터: `?visibility=public` or `?visibility=private`

### 동작
- 필터 변경 시 페이지를 1로 리셋
- 기존 검색어(`q`)와 조합 가능
- URL 파라미터로 상태 관리 (공유/새로고침 유지)

## 5. API 변경

### `GET /api/proposals`
- 기존 파라미터: `page`, `q`
- 추가 파라미터: `year` (integer), `visibility` (`public` | `private`)
- 서버 쿼리에 WHERE 조건 추가

### `POST /api/proposals` (시안 생성)
- body에 `workYear?: number` 추가

### `PATCH /api/proposals/[id]`
- body에 `workYear?: number | null` 추가

## 6. 영향 파일

| 레이어 | 파일 |
|--------|------|
| DB 마이그레이션 | `drizzle/migrations/0024_proposal_work_year.sql` (신규) |
| DB journal | `drizzle/migrations/meta/_journal.json` |
| DB 스키마 | `drizzle/schema.ts` |
| 타입 | `src/entities/proposal/model/types.ts` |
| Zod 스키마 | `src/entities/proposal/model/create-schema.ts` |
| 서버 액션 | `src/entities/proposal/api/create-proposal.server.ts` |
| 목록 서버 쿼리 | `src/entities/proposal/api/get-proposals.server.ts` |
| 목록 API | `app/api/proposals/route.ts` |
| 상세 API | `app/api/proposals/[id]/route.ts` |
| 등록 폼 | `src/features/create-proposal/ui/proposal-create-form.tsx` |
| 설정 폼 | `src/features/edit-proposal-settings/ui/proposal-settings.tsx` |
| 목록 페이지 | `src/pages/proposals-list/ui/proposals-list-page.tsx` |
