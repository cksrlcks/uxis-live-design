# 비밀번호 재설정 (이메일 링크) 설계

> 작성일: 2026-06-23
> 선행: 로그인/회원가입/비밀번호 변경(로그인 상태) 플로우 존재. 본 작업은 **비밀번호 찾기(잊어버림)** 플로우 신설
> 비고: Supabase Auth의 `resetPasswordForEmail` + `token_hash`/`verifyOtp` 방식으로, 이메일 링크를 통해 비로그인 사용자가 비밀번호를 재설정하는 end-to-end 플로우를 만든다. 기존 패턴(API route + `.server.ts` 서버 액션 + react-hook-form/zod + Base UI)을 그대로 따른다.

로그인 화면에서 "비밀번호를 잊으셨나요?"로 진입 → 이메일 입력 → Supabase가 재설정 링크 메일 발송 → 링크 클릭 시 `verifyOtp`로 recovery 세션 생성 → 새 비밀번호 입력 → `updateUser` 후 로그아웃 → 로그인 화면으로 복귀.

## 0. 용어
| 용어 | 의미 |
|---|---|
| **recovery 세션** | `verifyOtp({ type: 'recovery', token_hash })` 성공 시 생성되는 인증 세션. 새 비밀번호 설정 페이지 접근의 전제 |
| **token_hash** | 재설정 메일 링크에 담기는 해시 토큰. PKCE `code`와 달리 요청 기기/브라우저와 무관하게 검증 가능 |
| **next** | 링크 핸들러(`/auth/confirm`)가 검증 성공 후 이동할 내부 경로. 오픈 리다이렉트 방지 검증 필요 |
| **이메일 열거(enumeration)** | 가입된 이메일인지 응답 차이로 추측하는 공격. 요청 단계는 항상 동일 성공 응답으로 방지 |

## 1. 범위

**포함**
- A. 로그인 화면에 `/forgot-password` 진입 링크 추가
- B. 이메일 입력 → 재설정 메일 요청 (`/forgot-password` 페이지 + `POST /api/auth/forgot-password`)
- C. 메일 링크 핸들러 (`GET /auth/confirm` — `verifyOtp`로 recovery 세션 생성)
- D. 새 비밀번호 설정 페이지 (`/reset-password` — recovery 세션 가드) + `POST /api/auth/reset-password`
- E. 성공 시 로그아웃 → `/login` 복귀 (토스트 안내)
- F. 만료/무효 링크, 레이트 리밋, 이메일 열거 방지 등 엣지 케이스 처리
- G. 서버 액션 + 스키마 단위 테스트

**제외 (YAGNI)**
- 별도 메일 발송 라이브러리(Resend/SMTP 등) 도입 — Supabase 기본 Auth 메일 사용
- 비밀번호 강도 정책 강화(특수문자/대문자 등) — 기존 `signupSchema`와 동일하게 min 8자만
- 재설정 후 전체 기기 세션 무효화(전역 로그아웃) — 본인 세션 로그아웃만
- recovery 세션을 일반 세션과 별도 마킹/제한 — `updateUser` 직후 즉시 `signOut`하므로 불필요
- 이메일 확인(가입 컨펌) 플로우 — 본 작업 범위 밖(현재 비활성 가정 유지)

## 2. 확정된 결정
| # | 결정 | 선택 | 이유 |
|---|------|------|------|
| 1 | 작업 범위 | **전체 플로우(요청 + 재설정)** | 사용자 결정 |
| 2 | 링크→세션 방식 | **`token_hash` + `verifyOtp`** | 사용자 결정. 요청한 기기와 다른 기기/브라우저에서 메일을 열어도 동작. Supabase가 SSR에 권장 |
| 3 | 재설정 성공 후 | **로그아웃 → `/login`** | 사용자 결정. 새 비밀번호로 재로그인 검증, 보안상 깔끔 |
| 4 | redirectTo 결정 | **요청 origin 기반(폴백 `NEXT_PUBLIC_SITE_URL`)** | 로컬·운영 환경 무관 동작. 이메일 템플릿은 `{{ .RedirectTo }}` 사용 |
| 5 | 이메일 존재 노출 | **요청 단계 항상 성공 응답** | 이메일 열거 방지. `resetPasswordForEmail`은 미존재 이메일에도 기본 성공 |
| 6 | 비밀번호 규칙 | **min 8자 + 확인 일치** | 기존 `signupSchema`와 일관 |

## 3. 현재 구조 요약 (출발점)

```
app/
  (auth)/login/page.tsx              /login      (returnTo 지원)
  (auth)/signup/page.tsx             /signup
  api/auth/login/route.ts            POST signIn
  api/auth/logout/route.ts           POST signOut
  api/auth/signup/route.ts           POST signUp
  api/auth/password/route.ts         POST 비밀번호 변경(로그인 상태, currentPassword 필요)

src/
  features/auth/
    api/auth.server.ts               signIn/signUp/...(서버, zod parse + supabase 호출, 에러코드 throw)
    api/auth.ts                      클라이언트 http 래퍼(login 등)
    api/use-auth.ts                  react-query useMutation 훅
    model/schema.ts                  loginSchema/signupSchema/changePasswordSchema
    ui/login-form.tsx                react-hook-form + zod + Base UI, 에러코드→한국어
  pages/login/                       LoginPage 조립
  shared/supabase/{client,server,service}.ts
  shared/api/to-error-response.ts    에러→HTTP 응답 매핑
  shared/auth/guards.server.ts       getSessionUser/getProfile/requireEditor
```

비고: **루트 `middleware.ts` 없음** — 가드는 라우트별 서버 컴포넌트에서 수행. 본 설계도 동일하게 `/reset-password` 페이지에서 직접 세션 가드.

## 4. 추가/수정 파일

### 4.1 라우트 (app/)
| 경로 | 종류 | 역할 |
|---|---|---|
| `app/(auth)/forgot-password/page.tsx` | 페이지 | 이메일 요청 폼. `error` searchParam 수신(만료/무효 안내) |
| `app/(auth)/reset-password/page.tsx` | 페이지(서버) | recovery 세션 가드(`getSessionUser` 없으면 `/forgot-password?error=expired`) 후 새 비밀번호 폼 렌더 |
| `app/auth/confirm/route.ts` | Route Handler(GET) | `token_hash`,`type`,`next` 읽어 `verifyOtp` → 성공 시 `next`로 redirect, 실패 시 `/forgot-password?error=invalid` |
| `app/api/auth/forgot-password/route.ts` | Route Handler(POST) | `requestPasswordReset` 호출, 204 |
| `app/api/auth/reset-password/route.ts` | Route Handler(POST) | `resetPassword` 호출, 204 |

> `(auth)`는 라우트 그룹(괄호)이라 URL 세그먼트를 만들지 않음 → 실제 경로 `/auth/confirm`(route.ts)와 충돌하지 않음.

### 4.2 페이지 조립 (src/pages/)
- `src/pages/forgot-password/` — 기존 `src/pages/login` 패턴 따라 폼 + 레이아웃 조립
- `src/pages/reset-password/`

### 4.3 기능 (src/features/auth/)

**`model/schema.ts` 추가**
```ts
export const forgotPasswordSchema = z.object({
  email: z.email("올바른 이메일을 입력하세요"),
});

export const resetPasswordSchema = z
  .object({
    newPassword: z.string().min(8, "비밀번호는 8자 이상이어야 합니다"),
    confirmPassword: z.string().min(1, "비밀번호 확인을 입력하세요"),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "비밀번호가 일치하지 않습니다",
    path: ["confirmPassword"],
  });
```

**`api/auth.server.ts` 추가**
- `requestPasswordReset(input)`:
  - `forgotPasswordSchema.parse(input)`
  - `redirectTo` = 요청 origin(`headers()`의 `origin`/`referer`, 없으면 `NEXT_PUBLIC_SITE_URL`) + `/auth/confirm`
  - `supabase.auth.resetPasswordForEmail(email, { redirectTo })`
  - `error.status === 429` → `RATE_LIMITED` throw, **그 외 에러는 삼키고 성공 처리**(열거 방지)
- `resetPassword(input)`:
  - `resetPasswordSchema.parse(input)`
  - `supabase.auth.getUser()` 없으면 `UNAUTHORIZED` throw (recovery 세션 필수)
  - `supabase.auth.updateUser({ password: newPassword })` → 에러 시 적절 코드 throw
  - 성공 후 `supabase.auth.signOut()`

**`api/auth.ts` 추가(클라이언트)**
- `requestPasswordReset(input): Promise<void>` → `POST /api/auth/forgot-password`
- `resetPassword(input): Promise<void>` → `POST /api/auth/reset-password`

**`api/use-auth.ts` 추가**
- `useRequestPasswordReset()`, `useResetPassword()` (`useMutation`)

**UI**
- `ui/forgot-password-form.tsx`: 이메일 1필드. 성공 시 폼 → "메일을 보냈습니다(받은 편지함/스팸 확인)" 안내 화면 전환. 429 → "요청이 많습니다. 잠시 후 다시 시도하세요"
- `ui/reset-password-form.tsx`: newPassword/confirmPassword 2필드. 성공 시 `window.location.replace("/login?reset=success")` (기존 login-form의 full-document redirect 패턴 따름). **로그인 페이지가 `reset=success` 파라미터를 읽어 sonner 토스트 "비밀번호가 변경되었습니다. 새 비밀번호로 로그인하세요" 표시**

**진입점**
- `ui/login-form.tsx`에 `/forgot-password`로 가는 "비밀번호를 잊으셨나요?" 링크 추가

### 4.4 공유 헬퍼
- `next` 검증: 기존 오픈 리다이렉트 가드(`isSafeInternalPath` 류)가 있으면 재사용, 없으면 `/auth/confirm`에서 `/`로 시작 + `//` 아님만 통과(아니면 `/reset-password`)

## 5. redirectTo / 이메일 템플릿 (환경 무관)

서버 액션에서 요청 origin으로 `redirectTo`를 만들어 로컬·운영 모두 동작:
- `redirectTo = ${origin}/auth/confirm`
- 이메일 템플릿이 `{{ .RedirectTo }}`(= 위 redirectTo)에 토큰 쿼리를 덧붙임

## 6. Supabase 대시보드 수동 설정 (사람이 직접 — 코드로 불가)

1. **Authentication → URL Configuration → Redirect URLs** 에 추가
   - `http://localhost:3000/**`
   - `https://<운영도메인>/**`
2. **Authentication → Email Templates → Reset Password** 링크를 아래로 변경
   ```html
   <a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password">
     비밀번호 재설정
   </a>
   ```
3. (선택) **Site URL**을 운영 도메인으로 설정해 둘 것

> 코드 머지 후에도 위 설정이 안 되어 있으면 링크가 동작하지 않음 → 구현 완료 시 사용자에게 체크리스트로 재안내.

## 7. 보안 / 엣지 케이스
| 항목 | 처리 |
|---|---|
| 이메일 열거 | 요청 단계는 존재 여부 무관 동일 성공 응답(429만 구분) |
| 오픈 리다이렉트 | `/auth/confirm`의 `next`는 안전한 내부 상대경로만 허용 |
| 만료/무효 링크 | `verifyOtp` 실패 → `/forgot-password?error=invalid`; 세션 없이 `/reset-password` 직접 접근 → `?error=expired`. 둘 다 "다시 요청" 안내 |
| 레이트 리밋 | 429 → 사용자 친화 메시지(요청 단계). Supabase 기본 메일 한도(시간당 제한) 인지 |
| 비밀번호 규칙 | min 8자 + 확인 일치(`resetPasswordSchema`) |
| 재설정 직후 | `updateUser` 성공 → 즉시 `signOut` → `/login` |

## 8. 환경 변수
- 신규: `NEXT_PUBLIC_SITE_URL`(origin 폴백용). `.env.example`에 추가. origin 헤더가 있으면 그걸 우선.

## 9. 테스트
- **서버 액션** (Supabase 클라이언트 mock):
  - `requestPasswordReset`: 정상 호출 시 `resetPasswordForEmail`에 올바른 `redirectTo` 전달 / 429 → `RATE_LIMITED` / 그 외 에러 → 성공 처리(throw 안 함)
  - `resetPassword`: 세션 없음 → `UNAUTHORIZED` / 성공 시 `updateUser` 후 `signOut` 호출 순서
- **스키마**: `forgotPasswordSchema`(이메일 형식), `resetPasswordSchema`(min 8, 불일치 시 confirmPassword 에러)
- **next 검증 헬퍼**: 안전/위험 경로 케이스

## 10. 구현 순서(개요)
1. 스키마 + 서버 액션(`requestPasswordReset`/`resetPassword`) + 단위 테스트
2. API 라우트 2개 + `/auth/confirm` 핸들러(+ next 검증)
3. 클라이언트 api + 훅
4. UI 폼 2개 + 페이지 조립 + 로그인 진입점
5. `.env.example`/문서 갱신, 대시보드 설정 체크리스트 전달
