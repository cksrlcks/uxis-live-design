import { toast } from "sonner";
import { HttpError } from "@/shared/api/http";
import { isSafeInternalPath } from "@/shared/lib/safe-redirect";
import { createSupabaseBrowser } from "@/shared/supabase/client";

const EXPIRED_MESSAGE = "세션이 만료되었습니다. 다시 로그인해 주세요.";

// 이 경로들에서는 만료 리다이렉트를 하지 않는다(로그인 루프 방지).
const AUTH_PATHS = ["/login", "/signup", "/forgot-password", "/reset-password"];

/** 401 세션 만료 에러인지 판정. 403(권한 부족)은 대상이 아니다. */
export function isAuthExpiredError(error: unknown): boolean {
  return error instanceof HttpError && error.status === 401;
}

// 동시 다발 401을 1회 이동으로 합치는 모듈 레벨 가드.
let redirecting = false;

type Deps = {
  win?: Window;
  notify?: (message: string) => void;
  signOutLocal?: () => void;
};

/**
 * 세션 만료를 전역에서 처리한다:
 * 만료 토스트 → 로컬 세션 정리 → /login?returnTo=현재경로 로 이동.
 * - 이미 인증 페이지거나 이미 이동 중이면 no-op.
 * - win/notify/signOutLocal 은 테스트를 위해 주입 가능(기본값은 실제 구현).
 */
export function handleSessionExpired(deps: Deps = {}): void {
  const win = deps.win ?? window;
  if (redirecting) return;

  const { pathname, search } = win.location;
  if (AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return;

  redirecting = true;

  // 토스트/로컬 세션 정리는 부가 작업 — 실패해도 리다이렉트를 막지 않는다.
  try {
    (deps.notify ?? defaultNotify)(EXPIRED_MESSAGE);
    (deps.signOutLocal ?? defaultSignOutLocal)();
  } catch {
    // no-op
  }

  const current = pathname + search;
  const returnTo = isSafeInternalPath(current) ? current : "/";
  win.location.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
}

/**
 * QueryClient 의 QueryCache/MutationCache onError 에 물릴 게이트.
 * 401 세션 만료일 때만 만료 처리로 위임한다.
 */
export function reactToAuthError(
  error: unknown,
  onExpired: () => void = handleSessionExpired,
): void {
  if (isAuthExpiredError(error)) onExpired();
}

function defaultNotify(message: string): void {
  toast.error(message);
}

function defaultSignOutLocal(): void {
  // 죽은 쿠키/로컬 세션 정리. 이동을 막지 않도록 await 하지 않는다.
  void createSupabaseBrowser()
    .auth.signOut({ scope: "local" })
    .catch(() => {});
}
