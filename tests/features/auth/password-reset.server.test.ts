import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

// auth.server가 이제 @/shared/db를 import한다(updateDisplayName). 이 파일은 db를 쓰지 않지만
// @/shared/db는 import 시 DATABASE_URL 미설정이면 throw하므로, no-op 모킹으로 로드만 통과시킨다.
vi.mock("@/shared/db", () => ({ db: {} }));

const resetPasswordForEmail = vi.fn();
const getUser = vi.fn();
const updateUser = vi.fn();
const signOut = vi.fn();

vi.mock("@/shared/supabase/server", () => ({
  createSupabaseServer: vi.fn(async () => ({
    auth: { resetPasswordForEmail, getUser, updateUser, signOut },
  })),
}));

const headersGet = vi.fn();
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({ get: headersGet })),
}));

import { requestPasswordReset, resetPassword } from "@/features/auth/api/auth.server";

beforeEach(() => {
  vi.clearAllMocks();
  headersGet.mockImplementation((k: string) => (k === "origin" ? "http://localhost:3000" : null));
});

describe("requestPasswordReset", () => {
  it("builds redirectTo from the request origin", async () => {
    resetPasswordForEmail.mockResolvedValue({ error: null });
    await requestPasswordReset({ email: "a@b.com" });
    expect(resetPasswordForEmail).toHaveBeenCalledWith("a@b.com", {
      redirectTo: "http://localhost:3000/auth/confirm",
    });
  });

  it("throws RATE_LIMITED on a 429", async () => {
    resetPasswordForEmail.mockResolvedValue({ error: { status: 429 } });
    await expect(requestPasswordReset({ email: "a@b.com" })).rejects.toThrow("RATE_LIMITED");
  });

  it("swallows non-429 errors (no email enumeration)", async () => {
    resetPasswordForEmail.mockResolvedValue({ error: { status: 500 } });
    await expect(requestPasswordReset({ email: "a@b.com" })).resolves.toBeUndefined();
  });

  it("rejects an invalid email before hitting Supabase", async () => {
    await expect(requestPasswordReset({ email: "nope" })).rejects.toBeTruthy();
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });
});

describe("resetPassword", () => {
  it("throws UNAUTHORIZED without a recovery session", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    await expect(
      resetPassword({ newPassword: "Passw0rd!", confirmPassword: "Passw0rd!" }),
    ).rejects.toThrow("UNAUTHORIZED");
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("updates the password then signs out", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    updateUser.mockResolvedValue({ error: null });
    signOut.mockResolvedValue({ error: null });
    await resetPassword({ newPassword: "Passw0rd!", confirmPassword: "Passw0rd!" });
    expect(updateUser).toHaveBeenCalledWith({ password: "Passw0rd!" });
    expect(signOut).toHaveBeenCalled();
  });

  it("maps weak_password to WEAK_PASSWORD and does not sign out", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    updateUser.mockResolvedValue({ error: { code: "weak_password" } });
    await expect(
      resetPassword({ newPassword: "Passw0rd!", confirmPassword: "Passw0rd!" }),
    ).rejects.toThrow("WEAK_PASSWORD");
    expect(signOut).not.toHaveBeenCalled();
  });
});
