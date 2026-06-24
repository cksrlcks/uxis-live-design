# 피그마 플러그인 구글 로그인 — 설계

작성일: 2026-06-24
브랜치: `feat/figma-plugin-google-login`

## 배경 / 동기

피그마 플러그인은 현재 이메일/비밀번호 로그인만 지원한다([`figma-plugin/src/ui/lib/api.ts`](../../../figma-plugin/src/ui/lib/api.ts) → `/api/plugin/auth/login`). 웹 서비스는 구글 OAuth 로그인을 제공하므로, **구글로만 가입한 사용자는 비밀번호가 없어 플러그인에 로그인할 수 없다.** 이 사용자들이 플러그인을 쓸 수 있게 구글 로그인을 추가한다.

## 핵심 제약

피그마 플러그인 UI는 샌드박스 iframe(null origin)이다.
- 인라인 OAuth 리다이렉트 불가, 팝업 콜백 수신 불가.
- 가능한 것은 `figma.openExternal(url)`로 외부(시스템) 브라우저를 여는 것뿐. 그 결과를 되돌려받을 길이 없다.
- 네트워크는 UI iframe에서 수행하며 `/api/plugin/*`만 CORS `*`로 호출 가능([`proxy.ts`](../../../proxy.ts)).

따라서 "버튼만 추가"로는 동작하지 않는다. **외부 브라우저에서 구글 로그인 → 서버가 토큰을 임시 보관 → 플러그인이 폴링으로 회수**하는 페어링 흐름이 필요하다(device-authorization 패턴).

## 전체 흐름

```
[플러그인]  readKey 생성(랜덤 32B) → writeKey = SHA-256(readKey) 계산
   │  figma.openExternal(`${API_BASE}/api/plugin/auth/oauth/google?k=<writeKey>`)
   ▼
[외부 브라우저] ── 구글 동의 화면 (PKCE; 검증 쿠키는 이 브라우저에 저장됨)
   │
   ▼
[콜백] GET /api/plugin/auth/oauth/callback?k=<writeKey>&code=...
   │  code→세션 교환, 프로필(role) 조회 → 토큰 payload를 DB에 <writeKey>로 임시 저장(TTL 5분)
   │  "로그인 완료, 피그마로 돌아가세요" HTML 응답
   ▼
[플러그인]  POST /api/plugin/auth/oauth/poll { readKey } 를 ~1.5초 간격 폴링
            서버: SHA-256(readKey)로 행 조회 → 있으면 토큰 반환 + 행 즉시 삭제(1회용)
                                          → 없으면 { status: 'pending' }
            → 기존 로그인과 동일하게 session.setSession → clientStorage 저장 → 완료
```

## 보안 모델

- 브라우저/구글 리다이렉트 URL에는 **해시값(writeKey)만** 노출된다. 폴링 비밀(readKey 원본)은 **플러그인↔poll 엔드포인트 사이에서만** 오간다.
- SHA-256은 역산 불가 → URL이 브라우저 히스토리/리퍼러에 남아도 readKey를 복원해 토큰을 가로챌 수 없다.
- 토큰은 **5분 TTL + 최초 폴링 시 삭제(1회용)** 로만 DB에 존재. refresh 토큰이 잠깐 평문으로 저장되는 점은, 짧은 TTL·1회용·고엔트로피 키로 완화한다(내부 도구 수용 범위).
- poll 엔드포인트는 `/api/plugin/*` 하위라 CORS `*` 허용 + CSRF 검사 제외(Bearer 표면). poll 자체는 readKey 비밀로 보호.

## 변경 범위

### 백엔드 — 신규 라우트 3개

1. `GET /api/plugin/auth/oauth/google`
   - 쿼리 `k`(writeKey) 필수. Supabase `signInWithOAuth({ provider: 'google', skipBrowserRedirect: true, redirectTo: ${origin}/api/plugin/auth/oauth/callback?k=<k>, queryParams: { prompt: 'select_account' } })`.
   - PKCE 검증 쿠키가 응답에 실려야 하므로 `createSupabaseServer()`(쿠키 쓰기 가능 클라이언트) 사용. 받은 url로 브라우저 리다이렉트.
   - 웹의 [`getGoogleOAuthUrl`](../../../src/features/auth/api/auth.server.ts) 패턴 재사용(콜백 경로만 플러그인용).

2. `GET /api/plugin/auth/oauth/callback`
   - 쿼리 `k`, `code` 수신. `exchangeCodeForSession(code)`로 세션 획득.
   - 교환 클라이언트는 **쿠키 읽기만 하고 세션 쿠키는 안 심는** 어댑터(getAll=요청 쿠키, setAll=no-op). 외부 브라우저에 웹 세션을 심지 않아 플러그인의 쿠키리스 철학 유지. (PKCE 검증 쿠키는 읽어야 하므로 getAll은 실제 쿠키 반환.)
   - `profiles`에서 role/displayName 조회([`pluginLogin`](../../../src/features/auth/api/plugin-auth.server.ts) 로직 재사용).
   - payload `{ accessToken, refreshToken, expiresAt, user: { id, email, name, role } }`를 DB에 key=`k`, expires_at=now+5분으로 upsert.
   - 사람이 보는 완료 HTML(자동 안내 문구) 응답. 실패 시 에러 HTML.

3. `POST /api/plugin/auth/oauth/poll`
   - 본문 `{ readKey }`. 서버가 `sha256(readKey)`로 행 조회.
   - 행 존재 & 미만료 → payload 반환(로그인 응답과 동일 shape) + 행 삭제(1회용).
   - 없음/만료 → `{ status: 'pending' }` (만료 행은 조회 시 제외 + 정리 삭제).

서버 로직은 [`src/features/auth/api/plugin-auth.server.ts`](../../../src/features/auth/api/plugin-auth.server.ts)에 함수로 추가(`pluginOAuthCallback`, `pluginOAuthPoll`, writeKey/redirect URL 빌더). 라우트는 얇게 유지.

### DB — 마이그레이션 1개

테이블 `plugin_oauth_pairings`:
- `key text primary key` — writeKey 해시(SHA-256 hex).
- `payload jsonb not null` — 토큰 + user.
- `expires_at timestamptz not null`.
- `created_at timestamptz not null default now()`.

Drizzle 스키마([`drizzle/schema.ts`](../../../drizzle/schema.ts), alias `@drizzle/schema`) 추가 + `drizzle/migrations/` 에 마이그레이션 생성. (적용은 Node ≥22 환경에서.)

### 플러그인 UI

- [`figma-plugin/src/ui/components/Login.tsx`](../../../figma-plugin/src/ui/components/Login.tsx): "또는" 구분선 + "Google로 계속하기" 버튼(웹 [`login-form.tsx`](../../../src/features/auth/ui/login-form.tsx)와 동일한 구글 SVG). 폴링 중 busy/취소 상태 표시.
- 신규 훅 `figma-plugin/src/ui/hooks/useOAuthLogin.ts`: readKey 생성(`crypto.getRandomValues`) → writeKey 계산(`crypto.subtle.digest('SHA-256')`) → `openUrl(authorizeUrl)` → poll 루프(간격 ~1.5초, 타임아웃 ~3분, 취소 가능) → 성공 시 `session.setSession`.
- [`figma-plugin/src/ui/lib/api.ts`](../../../figma-plugin/src/ui/lib/api.ts): `pollOAuth(readKey)` (POST, 무인증) + authorize URL 빌더.
- [`figma-plugin/src/ui/App.tsx`](../../../figma-plugin/src/ui/App.tsx): 훅 연결, `onGoogleLogin` 핸들러를 `Login`에 전달.
- 에러 메시지 humanize는 [`errors.ts`](../../../figma-plugin/src/ui/lib/errors.ts)에 신규 코드(`OAUTH_TIMEOUT`, `OAUTH_FAILED`) 추가.

### 수동 작업 — 필수 1건

Supabase 대시보드 → Authentication → URL Configuration → Redirect URLs에 추가:
- `https://uxis-cova.vercel.app/api/plugin/auth/oauth/callback`
- (로컬 개발용) `http://localhost:3000/api/plugin/auth/oauth/callback`

미설정 시 구글 리다이렉트가 Supabase에서 거부된다. (구글 provider/Secret 자체는 웹 구글 로그인에서 이미 설정됨.)

## 에러 / 엣지

- 권한 `pending` 계정도 로그인 허용(기존 이메일 로그인과 동일 정책; UI가 "편집 권한 없음" 경고를 이미 표시).
- 폴링 타임아웃/취소 → 명확한 에러, 버튼 재시도 가능.
- 콜백 실패(code 없음/교환 실패) → 에러 HTML, DB 미기록 → 플러그인은 타임아웃까지 pending 후 에러.
- `crypto.subtle`/`crypto.getRandomValues`는 Figma 데스크톱(Chromium) iframe에서 사용 가능.
- 동일 readKey 재폴링: 첫 성공에서 행이 삭제되므로 이후 pending. 플러그인은 성공 즉시 폴링 중단.

## 테스트

- 서버: `pluginOAuthPoll` 해시 조회/만료/1회용 삭제 단위 테스트. callback payload 빌드 로직(프로필 조회 매핑).
- 플러그인: `useOAuthLogin`/`api.pollOAuth` 단위 테스트(기존 [`api.test.ts`](../../../figma-plugin/src/ui/lib/api.test.ts) 패턴), 해시 계산 검증.
- 수동 E2E: 구글 계정으로 실제 로그인 → 토큰 회수 → 업로드 동작까지(운영 또는 로컬). Supabase redirect URL 설정 후.

## 범위 밖 (YAGNI)

- 만료 행 백그라운드 정리 크론(조회 시 필터 + 삭제로 충분).
- 멀티 provider(깃허브 등) — 지금은 구글만.
- 플러그인 내 회원가입의 구글화(회원가입은 기존대로 웹으로 보냄).
