# 피그마 플러그인 구글 로그인 — 설계

작성일: 2026-06-24 (2026-06-24 방향 수정: 웹 로그인 페이지 재사용 폴링 페어링)
브랜치: `feat/figma-plugin-google-login`

## 배경 / 동기

피그마 플러그인은 현재 이메일/비밀번호 로그인만 지원한다([`figma-plugin/src/ui/lib/api.ts`](../../../figma-plugin/src/ui/lib/api.ts) → `/api/plugin/auth/login`). 웹 서비스는 구글 OAuth 로그인을 제공하므로, **구글로만 가입한 사용자는 비밀번호가 없어 플러그인에 로그인할 수 없다.**

## 핵심 제약

피그마 플러그인 UI는 샌드박스 iframe(null origin)이다.
- 인라인 OAuth 리다이렉트 불가, 팝업 콜백 수신 불가.
- 가능한 것은 `figma.openExternal(url)`로 외부(시스템) 브라우저를 여는 것뿐. 그 결과를 되돌려받을 길이 없다.
- 네트워크는 UI iframe에서 수행하며 `/api/plugin/*`만 CORS `*`로 호출 가능([`proxy.ts`](../../../proxy.ts)).

따라서 표준 "폴링 페어링" 패턴을 쓴다(사용자 제공 레퍼런스와 동일):
1. 플러그인이 uuid(페어링 키)를 만든다.
2. 그 키를 담은 사인인 링크를 외부 브라우저로 연다.
3. 사용자가 웹에서 로그인하면 서버가 (유저정보+토큰)을 그 키로 DB에 저장한다.
4. 플러그인이 그 키로 계속 폴링하다가 정보를 받으면 로그인 완료.

## 핵심 결정: 웹 로그인 페이지 재사용

브라우저가 여는 페이지를 **구글 OAuth 직접**이 아니라 **기존 웹 로그인 페이지**로 한다. 웹 `/login`은 이미 이메일+구글 로그인을 모두 제공하므로, 플러그인에 로그인 UI를 중복 구현하지 않고 그대로 위임한다. 결과적으로 이메일·구글·구글전용계정 전부 동작하며, 구글 전용 서버 라우트(시작/콜백)가 필요 없다.

플러그인 첫 화면은 **"로그인하기" 버튼 하나**다. 누르면 브라우저가 열리고, 플러그인은 **"로그인 중입니다…"** 안내만 표시하다가 폴링으로 세션을 받으면 메인 화면으로 전환한다.

## 전체 흐름

```
[플러그인]  key = crypto.randomUUID()
   │  figma.openExternal(`${API_BASE}/plugin-auth?k=<key>`)
   │  → 화면: "로그인 중입니다…" (+ 취소)
   ▼
[외부 브라우저] GET /plugin-auth?k=<key>  (서버 컴포넌트)
   │  getUser() → 미로그인이면  redirect(`/login?returnTo=/plugin-auth?k=<key>`)
   │  → 사용자가 웹에서 로그인(이메일 or 구글) → returnTo로 복귀 → 이제 로그인됨
   │  getSession()으로 토큰 + 프로필(role) 조회 → payload를 key로 DB 저장(TTL 5분)
   │  → "로그인 완료! 피그마로 돌아가세요" 표시
   ▼
[플러그인]  POST /api/plugin/auth/poll { key } 를 ~1.5초 간격 폴링
            서버: key로 행 조회 → 있으면 payload 반환 + 행 즉시 삭제(1회용), 없으면 { status:'pending' }
            → session.setSession → clientStorage 저장 → 로그인 완료
```

`isSafeInternalPath('/plugin-auth?k=...')`는 `/`로 시작·`//`아님 → 허용. 웹 로그인 페이지([`src/pages/login/ui/login-page.tsx`](../../../src/pages/login/ui/login-page.tsx))는 `returnTo`를 [`login-form.tsx`](../../../src/features/auth/ui/login-form.tsx)까지 전달하고, 이메일 로그인은 `window.location.replace(returnTo)`, 구글 로그인은 `googleHref`의 `next=returnTo`로 모두 `returnTo` 복귀한다.

## 보안 모델

- 페어링 키(uuid v4, 122비트)는 추측 불가. 외부 브라우저 URL에 노출되지만, 토큰은 **5분 TTL + 최초 폴링 시 삭제(1회용)** 로만 DB에 존재한다.
- refresh 토큰이 잠깐 평문으로 저장되는 점은 짧은 TTL·1회용·고엔트로피 키로 완화(내부 도구 수용 범위). 레퍼런스 패턴과 동일한 트레이드오프.
- poll 엔드포인트는 `/api/plugin/*` 하위라 CORS `*` 허용 + CSRF 검사 제외(Bearer/무쿠키 표면). 키 비밀로 보호.
- `/plugin-auth` 페이지의 토큰 저장은 **로그인된 쿠키 세션을 읽어**(getUser 검증 + getSession 토큰) 수행한다. 미로그인이면 저장 없이 로그인으로 보낸다.

## 변경 범위

### 백엔드

- **DB 마이그레이션 1개** — 테이블 `plugin_auth_pairings`: `key text pk`, `payload jsonb`, `expires_at timestamptz`, `created_at timestamptz`. Drizzle 스키마([`drizzle/schema.ts`](../../../drizzle/schema.ts)) + `drizzle/migrations/`.
- **서버 함수** ([`plugin-auth.server.ts`](../../../src/features/auth/api/plugin-auth.server.ts)):
  - `storePluginPairing(key)` — 쿠키 세션(getUser+getSession) 읽어 payload를 key로 upsert. 미로그인 시 false.
  - `pollPluginPairing(input)` — `{key}`로 조회 → payload 반환+삭제 / `{status:'pending'}`. 만료 행 정리.
  - 더 이상 쓰지 않는 `pluginLogin` 제거. `pluginRefresh`(토큰 갱신)는 유지.
- **웹 페이지** — `app/plugin-auth/page.tsx`: getUser → 미로그인 redirect, 로그인 시 store + 완료 안내.
- **API 라우트** — `app/api/plugin/auth/poll/route.ts`(POST). 더 이상 쓰지 않는 `app/api/plugin/auth/login/route.ts` 제거.

### 플러그인 UI

- [`api.ts`](../../../figma-plugin/src/ui/lib/api.ts): `login()` 제거, `pollPairing(key)`(POST) + `signInUrl(base, key)` 빌더 추가.
- 신규 훅 `usePairingLogin.ts`: `crypto.randomUUID()` → `openUrl(signInUrl)` → poll 루프(간격 ~1.5초, 타임아웃 ~3분, 취소 가능) → `session.setSession`.
- [`Login.tsx`](../../../figma-plugin/src/ui/components/Login.tsx): 이메일/비번 폼 제거 → "로그인하기" 버튼 1개 + "로그인 중입니다…" 상태 + 취소.
- [`App.tsx`](../../../figma-plugin/src/ui/App.tsx): 이메일 로그인 핸들러 제거, 훅 연결.
- [`errors.ts`](../../../figma-plugin/src/ui/lib/errors.ts): `OAUTH_TIMEOUT`, `OAUTH_FAILED` 추가.
- [`styles.css`](../../../figma-plugin/src/ui/styles.css): 로그인 화면 단순화에 맞춘 소폭 조정.

### 수동 작업 — 필수 1건

Supabase 대시보드 → Authentication → URL Configuration → Redirect URLs에 추가(구글 로그인이 `/auth/callback`을 거치므로 이미 있어야 함; 없으면 추가):
- `https://uxis-cova.vercel.app/auth/callback`
- (로컬) `http://localhost:3000/auth/callback`

> 이 방식은 구글 콜백 경로를 새로 만들지 않고 **기존 `/auth/callback`을 재사용**하므로, 이미 웹 구글 로그인이 동작한다면 추가 Supabase 설정이 없을 수도 있다. ([google-oauth-login] 메모 참조 — `/auth/callback` 등록 필요.)

## 에러 / 엣지

- 권한 `pending` 계정도 로그인 허용(기존 정책; UI가 "편집 권한 없음" 경고 유지).
- 폴링 타임아웃/취소 → 명확한 에러, 버튼 재시도 가능.
- `/plugin-auth`에서 `k` 없음 → 에러 안내. 미로그인 → 로그인으로 redirect.
- `crypto.randomUUID()`는 Figma 데스크톱(Chromium) iframe에서 사용 가능.
- 동일 key 재폴링: 첫 성공에서 행 삭제 → 이후 pending. 플러그인은 성공 즉시 폴링 중단.

## 테스트

- 서버: `pollPluginPairing` 조회/만료/1회용 로직은 DB 통합이라 typecheck + 수동 E2E. (순수 로직 거의 없음.)
- 플러그인: `signInUrl`/`pollPairing` 경로 빌더 단위 테스트(기존 [`api.test.ts`](../../../figma-plugin/src/ui/lib/api.test.ts) 패턴).
- 수동 E2E: "로그인하기" → 브라우저 이메일/구글 로그인 → 복귀 자동 로그인 → 업로드까지. 구글 전용 계정 포함.

## 범위 밖 (YAGNI)

- 만료 행 백그라운드 정리 크론(조회 시 필터 + 삭제로 충분).
- 플러그인 내 회원가입 UI(회원가입은 기존대로 웹 로그인 페이지에서).
- 구글 전용 플러그인 OAuth 라우트(웹 로그인 재사용으로 불필요).
