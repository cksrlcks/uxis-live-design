# 구글 가입 이름 채우기 + 마이페이지 이름 변경 — 설계

## 배경 / 문제

구글 OAuth로 처음 가입하면 `profiles.display_name`이 빈 값(NULL)으로 들어간다.
원인은 가입 트리거 `handle_new_user`가 `raw_user_meta_data->>'display_name'` 키만 읽는데,
구글은 이름을 `display_name`이 아니라 `full_name` / `name` 키로 제공하기 때문이다.

앱 전체가 이름을 읽는 유일한 출처는 `profiles.display_name`이다
(`getProfile`, `getUsers`, `deriveViewerName`). 따라서 이 컬럼만 채우면 된다.

## 목표

1. **가입 시 이름 자동 채우기** — 구글 실명을 우선 사용하고, 정말 못 받아오면
   이메일의 `@` 앞부분(local-part)을 이름으로 저장한다. 빈 이름이 DB에 남지 않게 한다.
2. **마이페이지 이름 변경** — 마이페이지에서 이름을 클릭하면 변경 모달이 열리고,
   저장하면 `profiles.display_name`이 갱신된다.

범위 밖(YAGNI): 별도 온보딩 페이지, auth 메타데이터 동기화, 아바타/기타 프로필 필드.

## 결정 사항

- **이름 폴백 우선순위**: `display_name` → `full_name` → `name` → 이메일 local-part.
  "이름을 못 받아오면"의 자연스러운 해석 — 구글이 실명을 주면 그대로 쓰고, 정말 없을 때만 골뱅이 앞.
- **저장 대상**: `profiles.display_name` 단일 컬럼만. 앱이 이름을 읽는 곳이 그곳 한 군데뿐이라 충분.
  (`auth.users` user_metadata는 동기화하지 않는다.)

## Part 1 — 가입 트리거 수정

새 마이그레이션으로 `handle_new_user` 함수를 교체(`CREATE OR REPLACE`)한다.
트리거 자체(`on_auth_user_created`)는 유지.

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'display_name', ''),
      NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
      NULLIF(NEW.raw_user_meta_data->>'name', ''),
      split_part(NEW.email, '@', 1)
    ),
    'pending'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
```

- 라이브 DB는 데이터 0건이므로 함수 교체는 안전. 단, 라이브 Supabase에 **수동 적용 필요**
  (적용 전까지는 구글 신규 가입 시 여전히 NULL → 마이페이지에서 직접 입력해야 함).
- drizzle 스키마(`schema.ts`)는 컬럼 구조 변경이 없으므로 손대지 않는다(함수는 SQL-only 마이그레이션).

## Part 2 — 마이페이지 이름 변경 모달

기존 mutation 패턴(API 라우트 + `http()` + react-query)과 `ChangePasswordDialog` 모달 패턴을 따른다.

### 2.1 스키마 — `src/features/auth/model/schema.ts`

```ts
export const updateNameSchema = z.object({
  name: z.string().trim().min(1, "이름을 입력하세요").max(50, "이름은 50자 이하여야 합니다"),
});
export type UpdateNameInput = z.infer<typeof updateNameSchema>;
```

### 2.2 서버 — `src/features/auth/api/auth.server.ts`

```ts
export async function updateDisplayName(input: unknown): Promise<void> {
  const { name } = updateNameSchema.parse(input);
  const user = await getSessionUser();        // guards.server에서 재사용
  if (!user) throw new Error("UNAUTHORIZED");
  await db.update(profiles).set({ displayName: name }).where(eq(profiles.id, user.id));
}
```

`db`는 RLS를 우회하는 드리즐 직접 연결(`getUsers`/`getProfile`과 동일 경로).

### 2.3 API 라우트 — `app/api/auth/profile/route.ts`

`PATCH` 핸들러: 바디를 `updateDisplayName`에 넘기고, `UNAUTHORIZED`는 401, zod 검증 실패는 400으로 매핑.
기존 auth 라우트(`signup`/`password`)의 에러 처리 형태를 따른다.

### 2.4 클라이언트 API / 훅

- `src/features/auth/api/auth.ts`: `updateName(input: UpdateNameInput)` → `http("/api/auth/profile", { method: "PATCH", ... })`
- `src/features/auth/api/use-auth.ts`: `useUpdateName()` → `useMutation({ mutationFn: updateName })`

### 2.5 UI — `EditNameDialog`(client) + MyPage 교체

새 컴포넌트 `src/features/auth/ui/edit-name-dialog.tsx`:
- props: `displayName: string | null`
- `DialogTrigger`로 현재 이름 텍스트를 감싼다(클릭 가능, hover 시 편집 가능함을 암시).
- 모달 본문: 현재 이름이 미리 채워진 입력 1칸 + 취소/저장.
- 저장 성공 시 `router.refresh()`로 서버 컴포넌트 prop(`displayName`)을 다시 받아 화면 갱신.
- 에러 메시지: `RATE_LIMITED`/검증 실패/일반 오류를 한국어로 매핑(`ChangePasswordDialog` 형태).

[my-page.tsx](../../../src/pages/my-page/ui/my-page.tsx)에서 `<p>{name}</p>` 를
`<EditNameDialog displayName={displayName} />` 로 교체한다. MyPage/AccountPage는 서버 컴포넌트로 유지하고
상호작용 부분만 클라이언트로 분리한다.

`auth` feature의 public export(`index.ts`)에 `EditNameDialog`를 추가한다(my-page에서 import).

## 컴포넌트 경계

| 단위 | 책임 | 의존 |
| --- | --- | --- |
| `handle_new_user` 트리거 | 가입 시 이름 폴백 채우기 | auth.users 메타데이터, profiles |
| `updateDisplayName` (server) | 현재 유저의 이름 갱신 | getSessionUser, db, updateNameSchema |
| `PATCH /api/auth/profile` | HTTP 경계 + 에러 매핑 | updateDisplayName |
| `useUpdateName` (client) | mutation 상태 | updateName |
| `EditNameDialog` (client) | 이름 표시 + 편집 모달 + refresh | useUpdateName, Dialog UI |
| `MyPage` (server) | 페이지 셸, prop 전달 | EditNameDialog |

## 에러 처리

- 미인증: `updateDisplayName` → `UNAUTHORIZED` → 401. (마이페이지는 이미 `getProfile` 가드 뒤라 정상 흐름엔 없음.)
- 검증 실패: zod throw → 400, 모달에 필드 에러 표시.
- 레이트리밋/일반 오류: 모달 하단에 한국어 메시지.

## 테스트

- `updateNameSchema`: 공백 trim, 빈 문자열 거부, 50자 초과 거부 (기존 `schema.test.ts` 패턴).
- (선택) `updateDisplayName` 서버: 미인증 시 `UNAUTHORIZED` throw.
- 트리거는 SQL이라 단위 테스트 대상 외 — 수동 E2E(구글 신규 가입 → 이름 = 골뱅이 앞 또는 실명)로 검증.

## 적용 체크리스트(머지 후)

- [ ] 라이브 Supabase에 트리거 마이그레이션 수동 적용
- [ ] 구글 신규 가입 E2E: 실명 있으면 실명, 없으면 이메일 앞부분
- [ ] 마이페이지에서 이름 클릭 → 변경 → 새로고침 후 반영 확인
