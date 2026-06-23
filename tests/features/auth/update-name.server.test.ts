import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/shared/supabase/server", () => {
  const getUser = vi.fn();
  const createSupabaseServer = vi.fn(async () => ({ auth: { getUser } }));
  return {
    createSupabaseServer,
    __getUser: getUser,
  };
});

vi.mock("@drizzle/schema", () => ({
  profiles: {},
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
import * as supabaseModule from "@/shared/supabase/server";
import * as dbModule from "@/shared/db";

const getUser = (supabaseModule as any).__getUser;
const dbMocks = {
  update: (dbModule as any).__update,
  set: (dbModule as any).__set,
  where: (dbModule as any).__where,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("updateDisplayName", () => {
  it("throws UNAUTHORIZED when not signed in", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    await expect(updateDisplayName({ name: "홍길동" })).rejects.toThrow("UNAUTHORIZED");
    expect(dbMocks.update).not.toHaveBeenCalled();
  });

  it("updates display_name for the current user", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    await updateDisplayName({ name: "  홍길동  " });
    expect(dbMocks.set).toHaveBeenCalledWith({ displayName: "홍길동" }); // trim 적용
    expect(dbMocks.where).toHaveBeenCalled();
  });

  it("rejects a blank name before touching the db", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    await expect(updateDisplayName({ name: "   " })).rejects.toBeTruthy();
    expect(dbMocks.update).not.toHaveBeenCalled();
  });
});
