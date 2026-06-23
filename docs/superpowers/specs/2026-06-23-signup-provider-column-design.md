# 사용자 관리 — 가입수단 컬럼 — 설계

작성일: 2026-06-23
상태: 구현 대기

## 목표

사용자 관리 테이블([admin-users-page.tsx](../../../src/pages/admin-users/ui/admin-users-page.tsx))에
**"가입수단" 컬럼**을 추가한다. 각 사용자가 어떤 방식으로 가입/로그인했는지(이메일, 구글)를
표시하며, **둘 다 연결한 사용자는 모두 표시**한다("이메일 + 구글").

## 배경 — 데이터 판별 가능 여부 (체크 완료)

- 가입수단 정보는 우리 DB(`public.profiles`)에는 **없다.** `profiles`는 `email / display_name /
  role / created_at`만 가진다([drizzle/schema.ts](../../../drizzle/schema.ts)).
- 실제 가입수단은 **Supabase `auth` 스키마**에 있다:
  - `auth.identities.provider` — provider당 1 row (`"email"`, `"google"`)
  - `auth.users.app_metadata.providers` — 배열(`["email","google"]`)
- 한 사용자가 이메일·구글을 모두 연결(linked)하면 `auth.identities`에 **2 row**가 생기고
  같은 `user_id`로 묶인다. 따라서 다중 가입수단도 데이터로 판별 가능하다.

## 방식: A — auth.identities 조인 (채택)

`getUsers`에서 `profiles`에 `auth.identities`를 `user_id`로 묶어 LEFT JOIN한다.
provider를 `array_agg`로 모아 사용자당 `providers: string[]`을 만든다.

```sql
SELECT p.id, p.display_name, p.email, p.role, p.created_at,
       coalesce(
         array_agg(i.provider ORDER BY i.provider) FILTER (WHERE i.provider IS NOT NULL),
         '{}'
       ) AS providers
FROM profiles p
LEFT JOIN auth.identities i ON i.user_id = p.id
GROUP BY p.id
ORDER BY p.created_at DESC;
```

- `array_agg(... ORDER BY i.provider)` — 순서 결정적(매번 같은 정렬).
- `FILTER (WHERE i.provider IS NOT NULL)` + `coalesce(..., '{}')` — identity가 없는
  이상 케이스도 빈 배열로 안전하게 처리.
- `auth.identities`는 drizzle 스키마([drizzle/schema.ts](../../../drizzle/schema.ts))에
  정의돼 있지 않으므로 **`sql` 태그 raw 쿼리**로 작성한다(별도 테이블 정의 추가하지 않음).

### 대안 (채택 안 함)

- **B. `profiles`에 컬럼 신설** — 가입 시점에 `profiles.provider`를 기록.
  단일 컬럼이면 "둘 다 등록"을 표현할 수 없고(배열 컬럼 필요), 기존 가입자 backfill도
  별도로 필요하다. A 대비 이점 없음 → 비채택.
- **C. Supabase Admin API** (`createSupabaseService().auth.admin.listUsers()`) —
  page 기본 50건 페이징·정렬/조인 불편. A의 단일 SQL이 더 단순 → 비채택.

## 권한 / 보안

- `getUsers`는 이미 `requireAdmin()`로 보호됨([get-users.server.ts](../../../src/entities/user/api/get-users.server.ts)).
  추가 인가 변경 없음.
- `db`는 `DATABASE_URL`로 Postgres에 직접 연결([db/index.ts](../../../src/shared/db/index.ts))되므로
  `auth.identities` 조회 가능. **사전 조건**: `DATABASE_URL` 롤이 `auth.identities` SELECT
  권한을 가져야 한다(Supabase 기본 `postgres`/풀러 롤은 보유). 권한 없으면 쿼리 실패 →
  배포 전 확인 필요.

## 변경/추가 파일

| 파일 | 작업 |
|---|---|
| `src/entities/user/model/types.ts` | `AdminUser`에 `providers: AuthProvider[]` 추가. `type AuthProvider = "email" \| "google" \| (string & {})`(미지 provider 원문 보존) |
| `src/entities/user/api/get-users.server.ts` | 위 raw SQL로 교체. `array_agg` 결과를 `providers: string[]`로 매핑 |
| `src/pages/admin-users/ui/admin-users-page.tsx` | 헤더에 "가입수단" 컬럼 추가(이름·이메일 **뒤**, 가입일 앞). 셀에 provider 라벨 렌더. 로딩/에러/빈 행의 `colSpan` 4 → **5** |
| `src/entities/user/ui/provider-badge.tsx`(신규, 선택) | provider 값 → 라벨 변환 + 뱃지. 다중이면 나열("이메일 + 구글") |

## UI

- 컬럼 순서: **이름 · 이메일 · 가입수단 · 가입일 · 작업**
- provider 라벨 매핑: `email → "이메일"`, `google → "구글"`, 그 외 → 원문 그대로
- 다중 provider: 뱃지 2개 또는 "이메일 + 구글" 텍스트
- `providers`가 빈 배열: `—`(muted)로 표시
- 검색은 기존 이름·이메일 대상 그대로 — 가입수단은 검색 대상에 포함하지 않음(YAGNI)

## 엣지 케이스

- **identity 0개**: 데이터 이상(트리거로 profile만 생성되고 identity 미연결 등) → 빈 배열 → `—`.
- **link 안 된 분리 계정**: 같은 사람이 이메일·구글을 **다른 `auth.users`로** 가지고 있으면
  `profiles`도 2 row → 사용자 목록에 2번 표시되고 각각 단일 provider로 보인다.
  이는 **계정이 분리된 것**으로 본 작업 범위가 아니다(가입수단 컬럼의 문제가 아님).
  필요 시 별도 계정 병합 작업으로 다룬다.
- **미지 provider 값**(향후 Apple/Kakao 추가 시): 라벨 매핑에 없으면 원문 그대로 노출 → 깨지지 않음.

## 테스트

- provider 라벨 매핑(`email→이메일`, `google→구글`, 미지값→원문) 순수 함수는 단위 테스트로 커버.
- SQL 조인은 Supabase `auth` 스키마 의존이라 **수동 확인**:
  - 이메일 전용 사용자 → "이메일"
  - 구글 전용 사용자 → "구글"
  - 둘 다 연결한 사용자 → "이메일 + 구글" (한 행)
  - `colSpan` 변경 후 로딩/에러/빈 상태 정렬 확인

## 사전 조건 (코드 외)

- `DATABASE_URL` 롤의 `auth.identities` SELECT 권한 확인(없으면 쿼리 실패).
- 실제 "둘 다 연결" 케이스가 같은 `user_id`로 link돼 있는지 `auth.identities`에서 1회 확인
  (분리 계정이면 위 엣지 케이스대로 2행 표시됨).
