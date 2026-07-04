import { describe, it, expect, beforeEach, vi } from "vitest";

// 모듈 레벨 `redirecting` 가드 때문에 각 테스트는 신선한 모듈 인스턴스를 로드한다.
// 같은 모듈 그래프에서 HttpError도 함께 가져와 `instanceof` 가 일치하도록 한다.
beforeEach(() => vi.resetModules());

async function load() {
  const mod = await import("@/shared/auth/session-expiry");
  const { HttpError } = await import("@/shared/api/http");
  return { ...mod, HttpError };
}

function fakeWin(pathname: string, search = "") {
  return {
    location: { pathname, search, replace: vi.fn() },
  } as unknown as Window;
}

describe("isAuthExpiredError", () => {
  it("401 HttpError → true", async () => {
    const { isAuthExpiredError, HttpError } = await load();
    expect(isAuthExpiredError(new HttpError(401, "LOGIN_REQUIRED"))).toBe(true);
  });

  it("403 HttpError → false (권한 부족은 대상 아님)", async () => {
    const { isAuthExpiredError, HttpError } = await load();
    expect(isAuthExpiredError(new HttpError(403, "FORBIDDEN"))).toBe(false);
  });

  it("500 HttpError → false", async () => {
    const { isAuthExpiredError, HttpError } = await load();
    expect(isAuthExpiredError(new HttpError(500, "SERVER_ERROR"))).toBe(false);
  });

  it("일반 Error / 비-에러 → false", async () => {
    const { isAuthExpiredError } = await load();
    expect(isAuthExpiredError(new Error("nope"))).toBe(false);
    expect(isAuthExpiredError(undefined)).toBe(false);
    expect(isAuthExpiredError(null)).toBe(false);
  });
});

describe("handleSessionExpired", () => {
  it("일반 경로: 만료 토스트 + 로컬 세션 정리 + /login?returnTo=현재경로 로 replace", async () => {
    const { handleSessionExpired } = await load();
    const win = fakeWin("/studio/proposals", "?page=2");
    const notify = vi.fn();
    const signOutLocal = vi.fn();

    handleSessionExpired({ win, notify, signOutLocal });

    expect(notify).toHaveBeenCalledWith("세션이 만료되었습니다. 다시 로그인해 주세요.");
    expect(signOutLocal).toHaveBeenCalledTimes(1);
    expect(win.location.replace).toHaveBeenCalledTimes(1);
    expect(win.location.replace).toHaveBeenCalledWith(
      "/login?returnTo=" + encodeURIComponent("/studio/proposals?page=2"),
    );
  });

  it("인증 페이지(/login)에서는 no-op (루프 방지)", async () => {
    const { handleSessionExpired } = await load();
    const win = fakeWin("/login", "?returnTo=/studio");
    const notify = vi.fn();
    const signOutLocal = vi.fn();

    handleSessionExpired({ win, notify, signOutLocal });

    expect(notify).not.toHaveBeenCalled();
    expect(signOutLocal).not.toHaveBeenCalled();
    expect(win.location.replace).not.toHaveBeenCalled();
  });

  it("notify/signOutLocal 이 throw 해도 리다이렉트는 수행된다", async () => {
    const { handleSessionExpired } = await load();
    const win = fakeWin("/studio/x");

    handleSessionExpired({
      win,
      notify: () => {
        throw new Error("toast boom");
      },
      signOutLocal: () => {
        throw new Error("signout boom");
      },
    });

    expect(win.location.replace).toHaveBeenCalledWith(
      "/login?returnTo=" + encodeURIComponent("/studio/x"),
    );
  });

  it("동시 다발 호출은 1회 이동으로 dedupe", async () => {
    const { handleSessionExpired } = await load();
    const win1 = fakeWin("/studio/a");
    const win2 = fakeWin("/studio/b");

    handleSessionExpired({ win: win1, notify: vi.fn(), signOutLocal: vi.fn() });
    handleSessionExpired({ win: win2, notify: vi.fn(), signOutLocal: vi.fn() });

    expect(win1.location.replace).toHaveBeenCalledTimes(1);
    expect(win2.location.replace).not.toHaveBeenCalled();
  });

  it("안전하지 않은 현재 경로면 returnTo 는 / 로 대체", async () => {
    const { handleSessionExpired } = await load();
    const win = fakeWin("//evil.example.com");

    handleSessionExpired({ win, notify: vi.fn(), signOutLocal: vi.fn() });

    expect(win.location.replace).toHaveBeenCalledWith(
      "/login?returnTo=" + encodeURIComponent("/"),
    );
  });
});

describe("reactToAuthError (QueryClient onError 게이트)", () => {
  it("401 → onExpired 호출", async () => {
    const { reactToAuthError, HttpError } = await load();
    const onExpired = vi.fn();
    reactToAuthError(new HttpError(401, "LOGIN_REQUIRED"), onExpired);
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it("403 / 500 / 일반 에러 → onExpired 미호출", async () => {
    const { reactToAuthError, HttpError } = await load();
    const onExpired = vi.fn();
    reactToAuthError(new HttpError(403, "FORBIDDEN"), onExpired);
    reactToAuthError(new HttpError(500, "SERVER_ERROR"), onExpired);
    reactToAuthError(new Error("nope"), onExpired);
    expect(onExpired).not.toHaveBeenCalled();
  });
});

describe("makeQueryClient 배선 (통합)", () => {
  it("queryCache 와 mutationCache 둘 다 동일한 onError 로 배선됨", async () => {
    vi.resetModules();
    const { makeQueryClient } = await import("@/shared/api/query-client");
    const qc = makeQueryClient();

    const queryOnError = qc.getQueryCache().config.onError;
    const mutationOnError = qc.getMutationCache().config.onError;

    expect(queryOnError).toBeTypeOf("function");
    expect(mutationOnError).toBe(queryOnError);
  });

  it("실제 makeQueryClient onError: 401 에러에서 /login 으로 리다이렉트", async () => {
    vi.resetModules();
    const replace = vi.fn();
    vi.stubGlobal("window", {
      location: { pathname: "/studio/list", search: "", replace },
    });

    const { makeQueryClient } = await import("@/shared/api/query-client");
    const { HttpError } = await import("@/shared/api/http");
    const qc = makeQueryClient();

    qc.getQueryCache().config.onError?.(new HttpError(401, "LOGIN_REQUIRED"), {} as never);

    expect(replace).toHaveBeenCalledWith(
      "/login?returnTo=" + encodeURIComponent("/studio/list"),
    );
    vi.unstubAllGlobals();
  });
});
