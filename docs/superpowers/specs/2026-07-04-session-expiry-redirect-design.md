# 세션 만료 시 로그인 리다이렉트 — 설계

- 날짜: 2026-07-04
- 상태: 승인됨 (구현 계획 작성 예정)
- 브랜치: master 기준

## 배경 / 문제

세션이 만료된 뒤(주로 refresh token까지 만료된 상태에서) 탭에 오래 머물다 돌아오면,
React Query가 window-focus refetch를 돌리고 → 인증 API가 **401**을 반환한다.
현재 이 401은 전역에서 아무도 처리하지 않아, 각 리스트가 독립적으로 인라인 에러
("...불러오지 못했습니다.")만 띄우고 앱 셸은 그대로 남는다. 사용자는 세션이 끊긴 줄
모른 채 깨진 화면을 마주한다.

### 현재 동작(확인된 사실)

- 인증: Supabase 쿠키 세션(`@supabase/ssr`). access token은 `proxy.ts`와 브라우저
  클라이언트가 자동 갱신하고, refresh token이 살아있는 동안은 조용히 갱신된다.
  탭을 아주 오래 두면 결국 세션이 만료되어 갱신이 실패한다.
- 유일한 자동 리다이렉트는 `proxy.ts:83-89` — 비로그인으로 `/studio`에 **페이지
  이동(네비게이션)** 할 때만 `/login`으로 보낸다. 이미 열린 화면에서 나가는
  in-page fetch(리스트 refetch)는 이 경로를 타지 않는다.
- 클라이언트 fetch 래퍼 `src/shared/api/http.ts`는 401을 `HttpError(401,
  "LOGIN_REQUIRED")`로 던지고 특별 처리하지 않는다.
- React Query 설정 `src/shared/api/query-client.ts`는 4xx를 재시도하지 않으며
  **전역 onError 핸들러가 없다**. `refetchOnWindowFocus`는 기본값 `true`,
  `staleTime`은 30초.
- 서버 가드 `src/shared/auth/guards.server.ts`의 `requireEditor`/`requireAdmin`는
  세션 없으면 `LOGIN_REQUIRED`(→401), 권한 부족이면 `FORBIDDEN`(→403)을 던진다.
  매핑은 `src/shared/api/to-error-response.ts`.

### 공개 뷰어 안전성(전역 적용의 근거)

`/p/[publicId]` 공개 뷰어의 읽기 쿼리(변형/핀/스트로크)는 전부
`resolveViewerGate`를 거쳐 `allow/password/forbidden`으로 판정된다 →
게스트에게는 **403/404만** 반환되고 **401은 발생하지 않는다**
(`src/entities/proposal/api/get-viewer-variants.server.ts:10-12`, pins/strokes 동일).
쓰기(핀/화이트보드 작성)는 요청 전에 `isGuest` 다이얼로그로 먼저 막는다.
따라서 **401이 발생하는 유일한 경로는 실제 인증이 필요한 엔드포인트**이며, 그 경우
(로그인했던 사용자의 세션 만료)에 로그인으로 보내는 것은 올바른 동작이다.

## 목표 / 비목표

**목표**
- 세션 만료(401)를 전역에서 감지해, 만료 안내 토스트 후 `/login?returnTo=현재경로`로
  자동 이동한다.
- 리스트/화면별 개별 수정 없이 한 곳에서 처리한다.

**비목표(YAGNI)**
- Supabase `onAuthStateChange` 기반 선제 감지 — 배경 탭에서 refresh token 만료 시
  이벤트가 신뢰성 있게 뜨지 않고, 사용자가 실제로 보는 "API 401" 경로를 직접
  해결하지 못함.
- 만료 전 경고 배너 / 카운트다운.
- 작성 중 내용 보존 모달 — 사용자가 명시적으로 "튕기기"를 선택함.
- 403(권한 부족) 처리 — 이미 studio 레이아웃이 `/pending`으로 라우팅함.

## 결정된 동작(사용자 확정)

1. **UX**: 만료 감지 시 토스트("세션이 만료되었습니다. 다시 로그인해 주세요.") 후
   `/login?returnTo=현재경로`로 자동 이동. 동시 다발 401이어도 이동은 1회만.
2. **범위**: 전역 적용 + 가드. 단, 이미 인증 페이지면 무시.
3. **대상 상태코드**: **401만**. 403은 제외.

## 접근

React Query의 `QueryCache`/`MutationCache`에 `onError`를 붙여, 에러가
`HttpError(401)`이면 전역 세션-만료 처리를 호출한다(접근 A). fetch 래퍼 가로채기(B)와
Supabase 이벤트 감지(C)는 각각 계층 위반/신뢰성 문제로 제외.

## 상세 설계

### 1. 새 단위 — `src/shared/auth/session-expiry.ts` (클라이언트, "use client" 소비 전용)

한 가지 책임: "이 에러가 401 세션 만료인가"를 판정하고, 가드된 리다이렉트를 수행.

```ts
import { HttpError } from "@/shared/api/http";

/** 401 세션 만료 에러인지 판정. 403(권한 부족)은 제외. */
export function isAuthExpiredError(error: unknown): boolean {
  return error instanceof HttpError && error.status === 401;
}

// 동시 다발 401을 1회 이동으로 합치는 모듈 레벨 가드
let redirecting = false;

const AUTH_PATHS = ["/login", "/signup", "/forgot-password", "/reset-password"];

/**
 * 세션 만료를 처리한다: 만료 토스트 → 로컬 세션 정리 → /login?returnTo=현재경로 로 이동.
 * - 이미 인증 페이지거나 이미 이동 중이면 no-op.
 * - 테스트를 위해 의존성을 주입 가능하게 둔다(win/notify/signOut).
 */
export function handleSessionExpired(deps?: {
  win?: Window;                    // 기본 globalThis.window
  notify?: (msg: string) => void;  // 기본 sonner toast.error
  signOutLocal?: () => void;       // 기본 supabase.auth.signOut({ scope: "local" })
}): void {
  const win = deps?.win ?? window;
  if (redirecting) return;

  const { pathname, search } = win.location;
  if (AUTH_PATHS.some((p) => pathname.startsWith(p))) return;

  redirecting = true;
  (deps?.notify ?? defaultNotify)("세션이 만료되었습니다. 다시 로그인해 주세요.");
  (deps?.signOutLocal ?? defaultSignOutLocal)(); // await 하지 않음(죽은 쿠키 정리)

  const current = pathname + search;
  const returnTo = isSafeInternalPath(current) ? current : "/";
  win.location.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
}
```

- `defaultNotify` → `import { toast } from "sonner"; toast.error(msg)`.
- `defaultSignOutLocal` → 브라우저 Supabase 클라이언트(`src/shared/supabase/client.ts`)로
  `auth.signOut({ scope: "local" })`. 실패해도 무시(then/catch no-op). 목적은 죽은
  쿠키/로컬 세션 정리라 이동을 막지 않도록 await 하지 않는다.
- `isSafeInternalPath`는 기존 헬퍼 `src/shared/lib/safe-redirect.ts`를 재사용.
- `window.location.replace`를 쓰는 이유: (a) React Query 트리 밖이라 라우터 훅을 못 씀,
  (b) 풀 리로드로 stale 인증 상태를 깨끗이 비움, (c) `replace`라 뒤로가기로 깨진
  화면에 복귀하지 않음.

의존 관계: `HttpError`(shared/api/http), `toast`(sonner), 브라우저 supabase 클라이언트,
`isSafeInternalPath`(shared/lib), `window.location`.

### 2. 배선 — `src/shared/api/query-client.ts`

```ts
import { QueryCache, MutationCache, QueryClient } from "@tanstack/react-query";
import { HttpError } from "./http";
import { handleSessionExpired, isAuthExpiredError } from "@/shared/auth/session-expiry";

function onAnyError(error: unknown) {
  if (isAuthExpiredError(error)) handleSessionExpired();
}

export function makeQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({ onError: onAnyError }),
    mutationCache: new MutationCache({ onError: onAnyError }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (failureCount, error) => {
          if (error instanceof HttpError && error.status >= 400 && error.status < 500) return false;
          return failureCount < 2;
        },
      },
    },
  });
}
```

- 기존 `staleTime`/`retry`는 그대로 유지.
- `QueryCache.onError`는 각 쿼리가 에러로 확정될 때, `MutationCache.onError`는 각
  뮤테이션 에러 시 호출된다. 두 곳 모두 배선해 쿼리·뮤테이션 401을 빠짐없이 커버.

### 3. 상호작용 / 엣지 케이스

- **다중 401 dedupe**: `redirecting` 플래그로 여러 쿼리가 동시에 401이어도 이동은 1회.
  (`replace` 직후 페이지가 언로드되므로 실질적으로도 1회.)
- **뮤테이션 로컬 onError 토스트**: 기존 "...에 실패했습니다" 토스트는 그대로 뜰 수
  있으나, 곧바로 리다이렉트되므로 만료 토스트+이동이 사실상 우선. 별도 제거하지 않음.
- **화이트보드 4xx 재싱크**(`whiteboard-layer.tsx:115-126`): 401 시에도 재싱크
  invalidate가 돌 수 있으나 곧 리다이렉트되므로 무해.
- **로그인 페이지에서의 401**: `AUTH_PATHS` 가드로 무시(리다이렉트 루프 방지).
- **returnTo 소비**: 로그인 페이지가 이미 지원 — `app/(auth)/login/page.tsx:8`이
  `returnTo`를 읽고, `src/features/auth/ui/login-form.tsx:45`가 로그인 성공 시
  `isSafeInternalPath(returnTo)` 검증 후 원위치로 `replace`. **추가 작업 없음.**

## 테스트 계획

`tests/auth/session-expiry.test.ts` (Vitest).

> 프로젝트 관례: 테스트는 `src` 콜로케이션이 아니라 최상위 `tests/` 아래에 둔다
> (`vitest.config.ts`의 `include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"]`).
> 또한 `environment: "node"`라 jsdom이 없다 → **`win`(및 notify/signOutLocal)을 반드시
> 주입**해서 테스트한다. 이 때문에 `handleSessionExpired`는 의존성 주입형으로 설계한다.
> import는 경로 별칭 사용: `import { ... } from "@/shared/auth/session-expiry"`
> (`tests/auth/roles.test.ts` 관례와 동일).

- `isAuthExpiredError`
  - `HttpError(401)` → `true`
  - `HttpError(403)` / `HttpError(500)` → `false`
  - 일반 `Error` / `undefined` → `false`
- `handleSessionExpired` (win/notify/signOutLocal 주입)
  - 인증 페이지(`/login` 등)에서는 no-op (notify/replace 호출 안 됨)
  - 정상 경로에서 notify 호출 + `replace('/login?returnTo=...')` 인코딩 확인
  - 재진입 시(이미 `redirecting=true`) 두 번째 호출은 no-op → 이동 1회
  - 안전하지 않은 현재 경로면 `returnTo`가 `/`로 대체되는지 (필요 시)

> 참고: `redirecting`은 모듈 레벨 상태이므로, dedupe 테스트를 위해 테스트에서 모듈을
> 재로딩하거나(`vi.resetModules`) 리셋 훅을 노출한다. 구현 시 테스트 편의를 위한
> 내부 `__resetForTest()` 노출 여부는 구현자 판단.

## 영향 파일 요약

- 신규: `src/shared/auth/session-expiry.ts`, `tests/auth/session-expiry.test.ts`
- 수정: `src/shared/api/query-client.ts` (queryCache/mutationCache 배선)
- 변경 없음(확인만): 로그인 페이지 returnTo 처리, 공개 뷰어 쿼리, 뮤테이션 토스트

## 검증(수동)

1. 로그인 후 studio 리스트 화면을 연다.
2. 세션을 무효화한다(예: Supabase 쿠키 삭제 또는 만료 시뮬레이트) 후 탭 포커스로
   refetch 유발.
3. "세션이 만료되었습니다" 토스트가 뜨고 `/login?returnTo=원래경로`로 이동하는지 확인.
4. 로그인하면 원래 경로로 복귀하는지 확인.
5. 로그인 페이지에서 401이 발생해도 루프가 없는지 확인.
6. 공개 뷰어를 게스트로 열었을 때(로그아웃 상태) 잘못된 로그인 이동이 없는지 확인.
