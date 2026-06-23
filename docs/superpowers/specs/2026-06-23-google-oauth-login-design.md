# 로그인 페이지 Google OAuth 버튼 — 설계

작성일: 2026-06-23
상태: 승인됨 (구현 대기)

## 목표

로그인 폼의 "로그인" 버튼 아래에 **"또는" 구분선 + "Google로 계속하기" 버튼**을 추가하고,
Supabase Google OAuth로 로그인되게 한다.

신규 구글 사용자는 기존 `handle_new_user` 트리거(`auth.users` AFTER INSERT)에 의해
`role='pending'` 프로필이 자동 생성되므로, 이메일 가입자와 동일한 권한 모델로 처리된다.
별도의 계정 생성 로직은 필요 없다.

## 비목표 (YAGNI)

- 구글 외 다른 소셜 provider (Apple, Kakao 등) — 이번 범위 아님
- 회원가입 페이지(`/signup`)에는 추가하지 않음 — 로그인 페이지만 대상
- 구글 사용자의 `display_name` 별도 보정 — 트리거가 `display_name` 메타가 없으면 NULL로 두며,
  이는 현재 스키마상 허용됨 (nullable). 추후 필요 시 별도 작업.

## 흐름 (서버 주도 PKCE)

이 레포는 모든 인증 로직을 `auth.server.ts`에 두고 브라우저 supabase 클라이언트를
인증에 쓰지 않는다. 일관성을 위해 **서버 주도 방식**을 채택한다.

1. **버튼 클릭** → `GET /api/auth/oauth/google?next=<returnTo>`로 전체 페이지 이동
2. **init 라우트**가 `getGoogleOAuthUrl(next)` 호출
   → Supabase 서버 클라이언트가 PKCE code-verifier 쿠키를 응답에 심고,
     구글 동의 화면 URL을 반환(`skipBrowserRedirect: true`)
   → 그 URL로 `NextResponse.redirect`
3. 구글 인증 후 → Supabase → 우리 앱 `GET /auth/callback?code=...&next=...`로 복귀
4. **callback 라우트**가 `exchangeCodeForSession(code)`로 세션 쿠키 설정
   → `next`(안전 경로 검증)로 이동. 실패 시 `/login?error=oauth`

### 대안 (채택 안 함)

버튼 onClick에서 브라우저 클라이언트의 `signInWithOAuth`를 직접 호출하면 init 라우트
파일 1개를 절약할 수 있으나, 인증 로직이 클라이언트 번들로 새어 기존 "인증은 서버에서"
규칙과 어긋난다. 비추천.

## 변경/추가 파일

| 파일 | 작업 |
|---|---|
| `src/features/auth/api/auth.server.ts` | `getGoogleOAuthUrl(next: string)` 추가. 기존 `resolveOrigin()` 재사용. `signInWithOAuth({ provider:'google', options:{ redirectTo: ${origin}/auth/callback?next=..., skipBrowserRedirect:true }})` 호출 후 `data.url` 반환 |
| `app/api/auth/oauth/google/route.ts` | **신규** GET. `next` 쿼리 읽어 `isSafeInternalPath`로 검증(기본 `/`), `getGoogleOAuthUrl` 호출, 반환 URL로 `redirect`. 실패 시 `/login?error=oauth` |
| `app/auth/callback/route.ts` | **신규** GET. `code`·`next` 읽어 `exchangeCodeForSession(code)`. 성공 시 `next`(검증)로, 실패/코드없음 시 `/login?error=oauth`로 redirect |
| `src/features/auth/ui/login-form.tsx` | "로그인" 버튼 아래에 "또는" 구분선 + 구글 버튼 추가. 버튼은 `/api/auth/oauth/google?next=<returnTo>`로 이동하는 링크. 흰 배경 + G 로고 인라인 SVG |
| `src/pages/login/ui/login-page.tsx` | `error?: string` prop 추가 → destructive 스타일 메시지 표시 |
| `app/(auth)/login/page.tsx` | searchParams에서 `error` 읽어 `error==='oauth'`이면 안내 문구를 `LoginPage`에 전달 |

## 에러 처리

- OAuth 취소/실패 → callback(또는 init)이 `/login?error=oauth`로 보냄
  → 로그인 페이지가 destructive 스타일로 "구글 로그인에 실패했습니다. 다시 시도해주세요." 표시
- `next`는 기존 `isSafeInternalPath`로 검증 (오픈 리다이렉트 방지). 검증 실패 시 `/`로 폴백
- init/callback 라우트의 Supabase 에러는 사용자에게 일반화된 메시지로만 노출

## 컴포넌트 경계

- **`getGoogleOAuthUrl`**: 입력 `next` 문자열 → 출력 구글 OAuth URL 문자열.
  PKCE 쿠키 설정은 Supabase 서버 클라이언트의 쿠키 어댑터가 담당(`createSupabaseServer`와 동일).
  의존: `createSupabaseServer`, `resolveOrigin`.
- **init 라우트**: HTTP 진입점. next 검증 + redirect만 담당. 인증 로직은 `getGoogleOAuthUrl`에 위임.
- **callback 라우트**: code → 세션 교환 + redirect. `exchangeCodeForSession`와 next 검증만 담당.
- **LoginForm 구글 버튼**: 순수 표현 + 링크 이동. 클라이언트에 supabase import 없음.

## 테스트

- 순수 헬퍼(안전 경로 검증)는 기존 `isSafeInternalPath` 테스트로 커버됨.
- OAuth 왕복은 외부(구글)+Supabase 의존이라 **수동 E2E**로 검증한다 (비밀번호 재설정과 동일 정책).
  - 시나리오: 구글 버튼 클릭 → 동의 → 앱 복귀 → 로그인 상태 + `returnTo` 이동 확인
  - 신규 구글 계정 첫 로그인 시 `profiles`에 `role='pending'` 행 생성 확인
  - 취소 시 `/login?error=oauth` 메시지 노출 확인

## 사전 조건 (대시보드, 코드 외)

- Supabase Google provider 활성화 — **완료됨** (사용자 확인)
- Supabase Auth Redirect URLs 허용 목록에 `/auth/callback` 추가 필요
  (로컬 `http://localhost:3000/auth/callback` + 운영 `NEXT_PUBLIC_SITE_URL/auth/callback`)
- 관련: `/auth/confirm`(비밀번호 재설정)도 동일 목록에 있어야 함 — 별도 미설정 항목
