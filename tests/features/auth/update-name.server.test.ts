import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const getUser = vi.fn();
vi.mock("@/shared/supabase/server", () => ({
  createSupabaseServer: vi.fn(async () => ({ auth: { getUser } })),
}));

// db.update(...).set(...).where(...) 체인 mock. vi.mock은 import 위로 호이스팅되고
// factory가 update를 즉시 참조하므로, 호이스트 시점에 먼저 초기화되는 vi.hoisted로 만든다.
const { update, set, where } = vi.hoisted(() => {
  const where = vi.fn(async () => undefined);
  const set = vi.fn(() => ({ where }));
  const update = vi.fn(() => ({ set }));
  return { update, set, where };
});
vi.mock("@/shared/db", () => ({ db: { update } }));

import { updateDisplayName } from "@/features/auth/api/auth.server";

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
