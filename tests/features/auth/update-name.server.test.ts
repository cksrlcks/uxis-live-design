import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const getUser = vi.fn();
vi.mock("@/shared/supabase/server", () => ({
  createSupabaseServer: vi.fn(async () => ({ auth: { getUser } })),
}));

vi.mock("@/shared/db", () => {
  const where = vi.fn(async () => undefined);
  const set = vi.fn(() => ({ where }));
  const update = vi.fn(() => ({ set }));
  return {
    db: { update },
    __where: where,
    __set: set,
    __update: update,
  };
});

import { updateDisplayName } from "@/features/auth/api/auth.server";
import * as dbModule from "@/shared/db";

const { __update: update, __set: set, __where: where } = dbModule as any;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("updateDisplayName", () => {
  it("throws UNAUTHORIZED when not signed in", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    await expect(updateDisplayName({ name: "홍길동" })).rejects.toThrow("UNAUTHORIZED");
    expect(update).not.toHaveBeenCalled();
  });

  it("updates display_name for the current user", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    await updateDisplayName({ name: "  홍길동  " });
    expect(set).toHaveBeenCalledWith({ displayName: "홍길동" }); // trim 적용
    expect(where).toHaveBeenCalled();
  });

  it("rejects a blank name before touching the db", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    await expect(updateDisplayName({ name: "   " })).rejects.toBeTruthy();
    expect(update).not.toHaveBeenCalled();
  });
});
